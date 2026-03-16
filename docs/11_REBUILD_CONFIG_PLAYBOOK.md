# 11_REBUILD_CONFIG_PLAYBOOK.md

Mục tiêu: lưu toàn bộ cấu hình để dựng lại một project mới cùng logic BetKing, sau đó chỉ cần dùng AI để build UI + chức năng.

---

## 1. Stack chuẩn

- Expo SDK 54
- React Native 0.81.x
- Expo Router 6.x
- Supabase (Auth + Postgres + Edge Functions)
- football-data.org API v4

---

## 2. Biến môi trường (project root `.env`)

```env
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=<publishable_or_anon_key>

# Server-side only (for Edge Functions secret)
FOOTBALL_DATA_API_KEY=<football_data_api_key>
```

Ghi chú:
- Frontend chỉ dùng `EXPO_PUBLIC_*`.
- Không dùng `service_role` key trong app client.

---

## 3. Supabase bắt buộc cấu hình

### 3.1 Database schema

Chạy toàn bộ file `supabase/schema.sql` trong `Supabase Dashboard -> SQL Editor`.

Schema sau khi chạy xong phải có 4 bảng:
- `users`
- `teams`
- `matches`
- `bets`

### 3.2 Auth URL configuration

Trong `Authentication -> URL Configuration`:

- `Site URL`: `http://localhost:8081`
- `Redirect URLs`:
  - `http://localhost:8081/**`
  - `betking://**`

Nếu web chạy cổng khác, thay đúng cổng dev hiện tại.

---

## 4. Supabase CLI + Edge Functions

### 4.1 Access token (khi terminal non-interactive)

Tạo token tại:
- `Supabase Dashboard -> Account -> Access Tokens -> Generate new token`

Set token:

PowerShell:
```powershell
$env:SUPABASE_ACCESS_TOKEN="<your-access-token>"
```

### 4.2 Deploy function + set secret + sync

```bash
npx supabase functions deploy sync-matches --project-ref <project-ref> --no-verify-jwt
npx supabase functions deploy settle-bets --project-ref <project-ref> --no-verify-jwt
npx supabase secrets set FOOTBALL_DATA_API_KEY=<football_data_api_key> --project-ref <project-ref>
curl -X POST https://<project-ref>.supabase.co/functions/v1/sync-matches
```

---

## 5. Verify nhanh sau setup

Chạy trong SQL Editor:

```sql
select count(*) as teams_count from teams;
select count(*) as matches_count from matches;
select count(*) as users_count from users;
```

Kỳ vọng:
- `teams_count > 0`
- `matches_count > 0`

Nếu `0`, UI Home/Standings sẽ trống.

---

## 6. Chạy app local

```bash
npm install
npx expo start --clear
```

---

## 7. Prompt khởi tạo project mới (dùng cho AI)

```md
Build a new Expo SDK 54 app with the same business logic as BetKing:
- Supabase auth + postgres + edge functions
- 4 tables only: users, teams, matches, bets
- Use RPC for atomic writes (place_bet, deposit)
- Read data from Supabase with RLS
- No direct football-data API calls from frontend
- Keep light theme UI and Expo Router structure

Apply this config first:
1) .env with EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_KEY
2) Run schema.sql on Supabase SQL Editor
3) Deploy edge function sync-matches and set FOOTBALL_DATA_API_KEY secret
4) Invoke sync-matches once to seed teams/matches
5) Configure auth redirect URLs for localhost and app scheme
```

---

## 8. Bảo mật

- Không commit `.env`.
- Không gửi `SUPABASE_ACCESS_TOKEN`, `service_role`, API key lên chat/public repo.
- Nếu lỡ lộ key: rotate key/token ngay.
