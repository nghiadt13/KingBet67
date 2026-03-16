# DB Schema

> Dựa trên: [05_DOMAIN_MODEL.md](./05_DOMAIN_MODEL.md), [08_API_CONTRACT.md](./08_API_CONTRACT.md)
> Database: PostgreSQL (Supabase)

---

## 1. Tables

### users

```sql
CREATE TABLE public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    VARCHAR(50)  UNIQUE NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  role        VARCHAR(10)  NOT NULL DEFAULT 'user'
              CHECK (role IN ('user', 'admin')),
  balance     BIGINT       NOT NULL DEFAULT 1000000,  -- tiền khởi tạo (TBD), dùng BIGINT tránh lỗi float
  is_banned   BOOLEAN      NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

> `id` liên kết với `auth.users.id` của Supabase Auth.
> `balance` dùng BIGINT (đơn vị: coins, không có phần thập phân) để tránh floating point issues.

---

### teams

```sql
CREATE TABLE public.teams (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id      INTEGER     UNIQUE NOT NULL,  -- ID từ football-data.org
  name             VARCHAR(100) NOT NULL,
  short_name       VARCHAR(50)  NOT NULL,
  tla              VARCHAR(5)   NOT NULL,         -- Three-Letter Abbreviation (ARS, CHE...)
  crest_url        TEXT,
  position         INTEGER,                       -- thứ hạng (1-20)
  points           INTEGER     DEFAULT 0,
  played_games     INTEGER     DEFAULT 0,
  won              INTEGER     DEFAULT 0,
  draw             INTEGER     DEFAULT 0,
  lost             INTEGER     DEFAULT 0,
  goal_difference  INTEGER     DEFAULT 0,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
```

> Data hoàn toàn từ API, không do user tạo. Edge Function sync sẽ upsert theo `external_id`.

---

### matches

```sql
CREATE TABLE public.matches (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id     INTEGER     UNIQUE NOT NULL,  -- ID từ football-data.org
  matchday        INTEGER     NOT NULL,
  utc_date        TIMESTAMPTZ NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'TIMED'
                  CHECK (status IN ('TIMED', 'SCHEDULED', 'IN_PLAY', 'PAUSED', 'FINISHED', 'POSTPONED', 'CANCELLED')),
  home_team_id    UUID        NOT NULL REFERENCES teams(id),
  away_team_id    UUID        NOT NULL REFERENCES teams(id),
  home_score      INTEGER,    -- NULL khi chưa đá
  away_score      INTEGER,
  half_time_home  INTEGER,    -- NULL khi chưa có
  half_time_away  INTEGER,
  odds            JSONB,      -- tất cả odds cho 5 loại kèo
  is_settled      BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

> `odds` JSONB structure:
>
> ```json
> {
>   "match_result":  { "home": 1.45, "draw": 3.20, "away": 2.80 },
>   "over_under":    { "over": 1.85, "under": 1.95 },
>   "btts":          { "yes": 1.70, "no": 2.10 },
>   "half_time":     { "home": 2.10, "draw": 2.20, "away": 3.50 },
>   "correct_score": { "1-0": 6.50, "2-1": 7.00, "0-0": 8.50, "0-1": 7.50, "1-1": 5.50, "2-0": 8.00, ... }
> }
> ```
>
> Key cấp 1 = `bet_type`, key cấp 2 = `bet_choice`. Lấy odds: `odds -> bet_type ->> bet_choice`.

---

### bets

```sql
CREATE TABLE public.bets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id),
  match_id    UUID        NOT NULL REFERENCES matches(id),
  bet_type    VARCHAR(20) NOT NULL
              CHECK (bet_type IN ('match_result', 'correct_score', 'over_under', 'btts', 'half_time')),
  bet_choice  VARCHAR(10) NOT NULL,  -- 'home', 'draw', 'away', 'over', 'under', 'yes', 'no', '2-1', ...
  amount      BIGINT      NOT NULL CHECK (amount > 0),
  odds        NUMERIC(6,2) NOT NULL, -- odds tại thời điểm đặt (BR-E08: không đổi sau khi đặt)
  status      VARCHAR(10) NOT NULL DEFAULT 'PENDING'
              CHECK (status IN ('PENDING', 'WON', 'LOST')),
  winnings    BIGINT      DEFAULT 0,  -- amount * odds, chỉ khi WON (làm tròn)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

> `odds` lưu riêng trong bet (không reference match.odds) vì odds có thể thay đổi sau khi user đặt.

---

## 2. Indexes

```sql
-- matches: query theo matchday + status (S-03 Match List)
CREATE INDEX idx_matches_matchday ON matches(matchday);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_matchday_status ON matches(matchday, status);

-- bets: query theo user (S-07 Bet History)
CREATE INDEX idx_bets_user_id ON bets(user_id);
CREATE INDEX idx_bets_user_created ON bets(user_id, created_at DESC);

-- bets: query cho settlement
CREATE INDEX idx_bets_match_status ON bets(match_id, status);

-- teams: query bảng xếp hạng
CREATE INDEX idx_teams_position ON teams(position);
```

---

## 3. Helper Functions

```sql
-- Kiểm tra user hiện tại có phải admin không (dùng trong RLS)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM public.users WHERE id = auth.uid()),
    false
  );
$$;
```

---

## 4. RPC Functions

### place_bet

```sql
CREATE OR REPLACE FUNCTION place_bet(
  p_match_id  UUID,
  p_bet_type  VARCHAR,
  p_bet_choice VARCHAR,
  p_amount    BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  v_balance  BIGINT;
  v_banned   BOOLEAN;
  v_match    RECORD;
  v_odds     NUMERIC;
  v_bet_id   UUID;
BEGIN
  -- 1. Check user
  SELECT balance, is_banned INTO v_balance, v_banned
  FROM users WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;
  IF v_banned THEN
    RAISE EXCEPTION 'USER_BANNED';
  END IF;

  -- 2. Check match
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCH_NOT_FOUND';
  END IF;
  IF v_match.status NOT IN ('TIMED', 'SCHEDULED') THEN
    RAISE EXCEPTION 'MATCH_NOT_OPEN';
  END IF;

  -- 3. Check balance
  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;

  -- 4. Get odds from match.odds JSON
  v_odds := (v_match.odds -> p_bet_type ->> p_bet_choice)::NUMERIC;

  IF v_odds IS NULL THEN
    RAISE EXCEPTION 'INVALID_BET';
  END IF;

  -- 5. Insert bet
  INSERT INTO bets (user_id, match_id, bet_type, bet_choice, amount, odds)
  VALUES (v_user_id, p_match_id, p_bet_type, p_bet_choice, p_amount, v_odds)
  RETURNING id INTO v_bet_id;

  -- 6. Deduct balance
  UPDATE users SET balance = balance - p_amount WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'id', v_bet_id,
    'bet_type', p_bet_type,
    'bet_choice', p_bet_choice,
    'amount', p_amount,
    'odds', v_odds
  );
END;
$$;
```

---

### deposit

```sql
CREATE OR REPLACE FUNCTION deposit(p_amount BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance BIGINT;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  UPDATE users
  SET balance = balance + p_amount
  WHERE id = auth.uid()
  RETURNING balance INTO v_new_balance;

  RETURN jsonb_build_object('new_balance', v_new_balance);
END;
$$;
```

---

### get_leaderboard

```sql
CREATE OR REPLACE FUNCTION get_leaderboard(
  p_type  VARCHAR DEFAULT 'winners',  -- 'winners' | 'losers'
  p_limit INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result JSONB;
  v_my_rank JSONB;
BEGIN
  IF p_type = 'winners' THEN
    SELECT jsonb_agg(row_to_jsonb(t)) INTO v_result
    FROM (
      SELECT u.username, COALESCE(SUM(b.winnings), 0) AS total
      FROM users u
      LEFT JOIN bets b ON b.user_id = u.id AND b.status = 'WON'
      WHERE u.role = 'user'
      GROUP BY u.id, u.username
      ORDER BY total DESC
      LIMIT p_limit
    ) t;
  ELSE
    SELECT jsonb_agg(row_to_jsonb(t)) INTO v_result
    FROM (
      SELECT u.username, COALESCE(SUM(b.amount), 0) AS total
      FROM users u
      LEFT JOIN bets b ON b.user_id = u.id AND b.status = 'LOST'
      WHERE u.role = 'user'
      GROUP BY u.id, u.username
      ORDER BY total DESC
      LIMIT p_limit
    ) t;
  END IF;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
```

---

### get_user_stats

```sql
CREATE OR REPLACE FUNCTION get_user_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_total   INTEGER;
  v_won     INTEGER;
  v_lost    INTEGER;
  v_pending INTEGER;
  v_winnings BIGINT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'WON'),
    COUNT(*) FILTER (WHERE status = 'LOST'),
    COUNT(*) FILTER (WHERE status = 'PENDING'),
    COALESCE(SUM(winnings) FILTER (WHERE status = 'WON'), 0)
  INTO v_total, v_won, v_lost, v_pending, v_winnings
  FROM bets
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'total_bets', v_total,
    'won_count', v_won,
    'lost_count', v_lost,
    'pending_count', v_pending,
    'win_rate', CASE WHEN (v_won + v_lost) > 0
      THEN ROUND(v_won::NUMERIC / (v_won + v_lost) * 100, 1)
      ELSE 0 END,
    'total_winnings', v_winnings
  );
END;
$$;
```

---

### get_admin_stats

```sql
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Check admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT COUNT(*) FROM users WHERE role = 'user'),
    'total_bets', (SELECT COUNT(*) FROM bets),
    'total_money_circulation', (SELECT COALESCE(SUM(balance), 0) FROM users WHERE role = 'user'),
    'pending_bets', (SELECT COUNT(*) FROM bets WHERE status = 'PENDING'),
    'hottest_match', (
      SELECT jsonb_build_object(
        'id', m.id,
        'home_team_name', ht.short_name,
        'away_team_name', at.short_name,
        'bet_count', COUNT(b.id)
      )
      FROM matches m
      JOIN teams ht ON m.home_team_id = ht.id
      JOIN teams at ON m.away_team_id = at.id
      LEFT JOIN bets b ON b.match_id = m.id
      GROUP BY m.id, ht.short_name, at.short_name
      ORDER BY COUNT(b.id) DESC
      LIMIT 1
    ),
    'top_users', (
      SELECT COALESCE(jsonb_agg(row_to_jsonb(t)), '[]'::jsonb)
      FROM (
        SELECT u.username, COALESCE(SUM(b.winnings), 0) AS total_winnings
        FROM users u
        LEFT JOIN bets b ON b.user_id = u.id AND b.status = 'WON'
        WHERE u.role = 'user'
        GROUP BY u.id, u.username
        ORDER BY total_winnings DESC
        LIMIT 5
      ) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
```

---

## 5. DB Trigger

### Auto tạo user khi đăng ký

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, username, email, role, balance, is_banned)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    NEW.email,
    'user',
    1000000,  -- balance mặc định (TBD)
    false
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
```

---

## 6. RLS Policies

```sql
-- Enable RLS on all tables
ALTER TABLE users   ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams   ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets    ENABLE ROW LEVEL SECURITY;

-- USERS
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT USING (auth.uid() = id OR is_admin());

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE USING (auth.uid() = id OR is_admin());

-- TEAMS (public read, write only via Edge Functions with service_role)
CREATE POLICY "Everyone can read teams"
  ON teams FOR SELECT USING (true);

-- MATCHES (public read, write only via Edge Functions with service_role)
CREATE POLICY "Everyone can read matches"
  ON matches FOR SELECT USING (true);

-- BETS (user reads own, admin reads all, insert/update via RPC)
CREATE POLICY "Users can read own bets"
  ON bets FOR SELECT USING (auth.uid() = user_id OR is_admin());
```

> **Lưu ý:** INSERT/UPDATE cho `bets` thông qua RPC functions (SECURITY DEFINER), không trực tiếp.
> Edge Functions dùng `service_role` key → bypass RLS hoàn toàn.

---

## 7. Seed Data

```sql
-- Tạo admin account (chạy sau khi tạo auth user qua Supabase Dashboard)
-- 1. Tạo user qua Dashboard: email = admin@kingbet67.com, password = admin123456
-- 2. Chạy SQL:
UPDATE public.users
SET role = 'admin'
WHERE email = 'admin@kingbet67.com';
```

---

## 8. Odds JSON Reference

### Danh sách tỉ số chính xác (correct_score) có sẵn

```
0-0, 1-0, 0-1, 2-0, 0-2, 2-1, 1-2,
3-0, 0-3, 3-1, 1-3, 3-2, 2-3,
4-0, 0-4, 4-1, 1-4, 4-2, 2-4, 4-3, 3-4,
1-1, 2-2, 3-3
```

> Tổng: 24 tỉ số. Hiển thị mặc định 6 cái phổ biến, nút "Xem thêm" mở rộng.
> Odds cho tỉ số chính xác thường từ 5.0 đến 50.0+ (càng hiếm càng cao).

---

## Tổng hợp

| Thành phần        | Số lượng |
| ----------------- | -------- |
| Tables            | 4        |
| Indexes           | 7        |
| Helper functions  | 1        |
| RPC functions     | 5        |
| DB Trigger        | 1        |
| RLS Policies      | 5        |
| Seed data         | 1 admin  |
