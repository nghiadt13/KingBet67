# API Contract

> Dựa trên: [03_UI_SCREENS.md](./03_UI_SCREENS.md), [05_DOMAIN_MODEL.md](./05_DOMAIN_MODEL.md), [06_ARCHITECTURE.md](./06_ARCHITECTURE.md)
>
> Vì dùng Supabase, "API" gồm 4 loại:
>
> 1. **Auth** — Supabase Auth SDK (đăng ký, đăng nhập)
> 2. **Direct Queries** — gọi DB trực tiếp qua SDK (đọc data)
> 3. **RPC Functions** — Postgres functions cho logic atomic (đặt cược, nạp tiền)
> 4. **Edge Functions** — serverless functions cho logic phức tạp (sync API, settle bets)

---

## 1. Auth (Supabase Auth SDK)

### Đăng ký — UC-01, S-02

```typescript
supabase.auth.signUp({
  email: "user@email.com",
  password: "12345678",
  options: {
    data: { username: "player1" }, // lưu vào auth.users.raw_user_meta_data
  },
});
```

**Response OK:** `{ user, session }`
**Errors:** email trùng, password < 8 ký tự

> DB Trigger: khi auth.users có row mới → tự tạo row trong `public.users` với balance mặc định.

---

### Đăng nhập — UC-02, S-01

```typescript
supabase.auth.signInWithPassword({
  email: "user@email.com",
  password: "12345678",
});
```

**Response OK:** `{ user, session }`
**Errors:** email không tồn tại, password sai, user bị ban

> Kiểm tra `is_banned` sau khi đăng nhập: query `public.users` → nếu banned → sign out + hiện thông báo.

---

### Đăng xuất — UC-09, S-09

```typescript
supabase.auth.signOut();
```

---

## 2. Direct Queries (supabase.from)

### Danh sách trận đấu — UC-05, S-03

```typescript
supabase
  .from("matches")
  .select(
    `
    *,
    home_team:teams!home_team_id (id, name, short_name, tla, crest_url),
    away_team:teams!away_team_id (id, name, short_name, tla, crest_url)
  `,
  )
  .eq("matchday", 31) // filter theo matchday
  .order("utc_date", { ascending: true });
```

**Response:** `Match[]` với thông tin 2 đội lồng bên trong

**Filter thêm theo status (cho tabs):**

```typescript
.eq('status', 'IN_PLAY')    // Đang đá
.eq('status', 'TIMED')      // Sắp đá
.eq('status', 'FINISHED')   // Kết thúc
```

---

### Chi tiết trận đấu — UC-06, S-04

```typescript
supabase
  .from("matches")
  .select(
    `
    *,
    home_team:teams!home_team_id (*),
    away_team:teams!away_team_id (*)
  `,
  )
  .eq("id", matchId)
  .single();
```

**Response:** `Match` với đầy đủ thông tin 2 đội + odds (JSON) + tỉ số

---

### Bảng xếp hạng giải — UC-07, S-06

```typescript
supabase.from("teams").select("*").order("position", { ascending: true });
```

**Response:** `Team[]` (20 đội, có position, points, won, draw, lost, goal_difference)

---

### Lịch sử cược — UC-09, S-07

```typescript
supabase
  .from("bets")
  .select(
    `
    *,
    match:matches (
      id, matchday, utc_date, status, home_score, away_score,
      home_team:teams!home_team_id (name, short_name, crest_url),
      away_team:teams!away_team_id (name, short_name, crest_url)
    )
  `,
  )
  .eq("user_id", userId)
  .order("created_at", { ascending: false });
```

**Filter theo status:**

```typescript
.eq('status', 'PENDING')  // hoặc 'WON' hoặc 'LOST'
```

**Response:** `Bet[]` với thông tin trận đấu lồng bên trong

> RLS: user chỉ thấy bets của chính mình.

---

### Admin: Danh sách users — UC-A03, S-A02

```typescript
supabase.from("users").select("*").order("created_at", { ascending: false });
```

**Search:**

```typescript
.or(`username.ilike.%${query}%,email.ilike.%${query}%`)
```

> RLS: chỉ admin mới đọc được tất cả users.

---

### Admin: Ban/Unban user — UC-A04, S-A02

```typescript
// Ban
supabase.from("users").update({ is_banned: true }).eq("id", userId);

// Unban
supabase.from("users").update({ is_banned: false }).eq("id", userId);
```

> RLS: chỉ admin mới update được. FE check không cho ban chính mình (BR-K01).

---

## 3. RPC Functions (Postgres Functions)

### place_bet — UC-08, S-05

```typescript
supabase.rpc("place_bet", {
  p_match_id: "uuid-xxx",
  p_bet_type: "MATCH_RESULT", // MATCH_RESULT | CORRECT_SCORE | OVER_UNDER | BTTS | HALF_TIME
  p_bet_choice: "HOME", // HOME | DRAW | AWAY | "2-1" | OVER | UNDER | YES | NO
  p_amount: 100000,
});
```

**Logic bên trong (atomic transaction):**

1. Check match.status IN ('TIMED', 'SCHEDULED') → nếu không → error
2. Check user.balance >= p_amount → nếu không → error
3. Lấy odds từ match.odds JSON cho bet_type + bet_choice
4. INSERT INTO bets (user_id, match_id, bet_type, bet_choice, amount, odds, status='PENDING')
5. UPDATE users SET balance = balance - p_amount
6. RETURN bet record

**Response OK:** `{ id, bet_type, bet_choice, amount, odds, status }`
**Errors:** 'MATCH_NOT_OPEN', 'INSUFFICIENT_BALANCE', 'INVALID_BET_TYPE'

---

### deposit — UC-04, S-09

```typescript
supabase.rpc("deposit", {
  p_amount: 500000,
});
```

**Logic:**

1. Check p_amount > 0
2. UPDATE users SET balance = balance + p_amount WHERE id = auth.uid()
3. RETURN new balance

**Response OK:** `{ new_balance: 2000000 }`

---

### get_leaderboard — UC-10, S-08

```typescript
supabase.rpc("get_leaderboard", {
  p_type: "winners", // "winners" | "losers"
  p_limit: 50,
});
```

**Logic:**

- winners: SELECT username, SUM(winnings) as total FROM bets WHERE status='WON' GROUP BY user_id ORDER BY total DESC
- losers: SELECT username, SUM(amount) as total FROM bets WHERE status='LOST' GROUP BY user_id ORDER BY total DESC

**Response:** `{ rank, username, total }[]`

---

### get_user_stats — UC-03, S-09

```typescript
supabase.rpc("get_user_stats");
// user_id lấy từ auth.uid() bên trong function
```

**Response:**

```json
{
  "total_bets": 45,
  "won_count": 28,
  "lost_count": 12,
  "pending_count": 5,
  "win_rate": 70.0,
  "total_winnings": 2500000
}
```

---

### get_admin_stats — UC-A02, S-A01

```typescript
supabase.rpc("get_admin_stats");
```

**Response:**

```json
{
  "total_users": 42,
  "total_bets": 1234,
  "total_money_circulation": 50000000,
  "pending_bets": 156,
  "hottest_match": {
    "id": "uuid",
    "home_team_name": "Arsenal",
    "away_team_name": "Chelsea",
    "bet_count": 89
  },
  "top_users": [
    { "username": "player1", "total_winnings": 2500000 },
    { "username": "player2", "total_winnings": 1800000 }
  ]
}
```

> RLS: chỉ admin gọi được.

---

## 4. Edge Functions (Serverless)

### sync-matches — UC-A05, UC-S01

```typescript
supabase.functions.invoke("sync-matches");
```

**Logic:**

1. Fetch `GET /v4/competitions/PL/matches` từ football-data.org
2. Fetch `GET /v4/competitions/PL/standings` từ football-data.org
3. Upsert teams (name, short_name, crest_url, position, points, won, draw, lost, goal_difference)
4. Upsert matches (status, scores, utc_date, matchday)
5. Tính odds cho các trận TIMED/SCHEDULED dựa trên standings
6. Nếu phát hiện trận mới FINISHED → gọi settle logic
7. Return kết quả

**Response:**

```json
{
  "teams_updated": 20,
  "matches_updated": 10,
  "odds_calculated": 5,
  "matches_settled": 2,
  "bets_settled": 45,
  "total_winnings": 2300000,
  "timestamp": "2026-03-15T12:00:00.000Z"
}
```

**Triggers:**

- External cron (cron-job.org) gọi mỗi 5-10 phút
- Admin bấm "Sync Now"

---

### settle-bets — UC-A06, UC-S02

```typescript
supabase.functions.invoke("settle-bets");
```

**Logic:**

1. SELECT matches WHERE status = 'FINISHED' AND is_settled = false
2. Với mỗi match:
   a. SELECT bets WHERE match_id = X AND status = 'PENDING'
   b. Với mỗi bet, so sánh bet_choice với kết quả thực:
   - MATCH_RESULT: so home_score vs away_score → HOME/DRAW/AWAY
   - CORRECT_SCORE: so "home_score-away_score" với bet_choice
   - OVER_UNDER: so (home_score + away_score) > 2.5
   - BTTS: so home_score >= 1 AND away_score >= 1
   - HALF_TIME: so half_time_home vs half_time_away
     c. Nếu đúng → UPDATE bet SET status='WON', winnings=amount\*odds + UPDATE user balance
     d. Nếu sai → UPDATE bet SET status='LOST'
3. UPDATE match SET is_settled = true
4. Return kết quả

**Response:**

```json
{
  "matches_settled": 2,
  "bets_processed": 45,
  "bets_won": 18,
  "bets_lost": 27,
  "total_winnings": 2300000
}
```

---

## 5. RLS Policies (Row Level Security)

| Table       | SELECT                       | INSERT            | UPDATE                      | DELETE |
| ----------- | ---------------------------- | ----------------- | --------------------------- | ------ |
| **users**   | Own row (user), All (admin)  | Via trigger only  | Own row (user), All (admin) | ❌     |
| **teams**   | All (everyone)               | ❌ (Edge Fn only) | ❌ (Edge Fn only)           | ❌     |
| **matches** | All (everyone)               | ❌ (Edge Fn only) | ❌ (Edge Fn only)           | ❌     |
| **bets**    | Own bets (user), All (admin) | Via RPC only      | Via RPC/Edge Fn only        | ❌     |

> Edge Functions dùng `service_role` key → bypass RLS.
> RPC functions chạy với quyền user → RLS vẫn áp dụng (hoặc dùng SECURITY DEFINER).

---

## 6. DB Triggers

### on_auth_user_created

```
AFTER INSERT ON auth.users
→ INSERT INTO public.users (id, username, email, role, balance, is_banned)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'username', NEW.email, 'user', DEFAULT_BALANCE, false)
```

> Tự tạo user profile khi đăng ký, không cần FE gọi thêm API.

---

## Tổng hợp

| Loại               | Số lượng | Danh sách                                                                  |
| ------------------ | -------- | -------------------------------------------------------------------------- |
| **Auth calls**     | 3        | signUp, signIn, signOut                                                    |
| **Direct queries** | 6        | matches list, match detail, standings, bet history, admin users, admin ban |
| **RPC functions**  | 5        | place_bet, deposit, get_leaderboard, get_user_stats, get_admin_stats       |
| **Edge Functions** | 2        | sync-matches, settle-bets                                                  |
| **DB Triggers**    | 1        | on_auth_user_created                                                       |
| **RLS Policies**   | ~8       | SELECT/INSERT/UPDATE cho 4 tables                                          |
