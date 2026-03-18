-- ============================================
-- KingBet67 DB Schema — IDEMPOTENT
-- Safe to run multiple times: IF NOT EXISTS, OR REPLACE, DROP IF EXISTS
-- Run on Supabase Dashboard → SQL Editor
-- Source: docs/09_DB_SCHEMA.md
-- ============================================

-- ==================
-- 1. TABLES
-- ==================

-- users
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    VARCHAR(50)  UNIQUE NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  role        VARCHAR(10)  NOT NULL DEFAULT 'user'
              CHECK (role IN ('user', 'admin')),
  balance     BIGINT       NOT NULL DEFAULT 1000000,
  is_banned   BOOLEAN      NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- teams
CREATE TABLE IF NOT EXISTS public.teams (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id      INTEGER     UNIQUE NOT NULL,
  name             VARCHAR(100) NOT NULL,
  short_name       VARCHAR(50)  NOT NULL,
  tla              VARCHAR(5)   NOT NULL,
  crest_url        TEXT,
  position         INTEGER,
  points           INTEGER     DEFAULT 0,
  played_games     INTEGER     DEFAULT 0,
  won              INTEGER     DEFAULT 0,
  draw             INTEGER     DEFAULT 0,
  lost             INTEGER     DEFAULT 0,
  goal_difference  INTEGER     DEFAULT 0,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- leagues
CREATE TABLE IF NOT EXISTS public.leagues (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(20) UNIQUE NOT NULL,
  name        VARCHAR(120) NOT NULL,
  country     VARCHAR(80),
  emblem_url  TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- matches
CREATE TABLE IF NOT EXISTS public.matches (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id     INTEGER     UNIQUE NOT NULL,
  league_id       UUID        REFERENCES leagues(id),
  matchday        INTEGER     NOT NULL,
  utc_date        TIMESTAMPTZ NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'TIMED'
                  CHECK (status IN ('TIMED', 'SCHEDULED', 'IN_PLAY', 'PAUSED', 'FINISHED', 'POSTPONED', 'CANCELLED')),
  home_team_id    UUID        NOT NULL REFERENCES teams(id),
  away_team_id    UUID        NOT NULL REFERENCES teams(id),
  home_score      INTEGER,
  away_score      INTEGER,
  half_time_home  INTEGER,
  half_time_away  INTEGER,
  odds            JSONB,
  is_settled      BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill-safe alter for existing DBs created before multi-league
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES public.leagues(id);

-- bets (status allows CANCELLED for refunded bets)
CREATE TABLE IF NOT EXISTS public.bets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id),
  match_id    UUID        NOT NULL REFERENCES matches(id),
  bet_type    VARCHAR(20) NOT NULL
              CHECK (bet_type IN ('match_result', 'correct_score', 'over_under', 'over_under_1_5', 'over_under_3_5', 'btts', 'half_time', 'spreads')),
  bet_choice  VARCHAR(10) NOT NULL,
  amount      BIGINT      NOT NULL CHECK (amount > 0),
  odds        NUMERIC(6,2) NOT NULL,
  status      VARCHAR(10) NOT NULL DEFAULT 'PENDING'
              CHECK (status IN ('PENDING', 'WON', 'LOST', 'CANCELLED')),
  winnings    BIGINT      DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- deposit requests
CREATE TABLE IF NOT EXISTS public.deposit_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount       BIGINT NOT NULL CHECK (amount > 0),
  status       VARCHAR(10) NOT NULL DEFAULT 'PENDING'
               CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by  UUID REFERENCES public.users(id),
  reviewed_at  TIMESTAMPTZ,
  admin_note   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migrate existing bet_type constraint to include new types
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bets_bet_type_check' AND conrelid = 'public.bets'::regclass
  ) THEN
    ALTER TABLE public.bets DROP CONSTRAINT bets_bet_type_check;
    ALTER TABLE public.bets ADD CONSTRAINT bets_bet_type_check
      CHECK (bet_type IN ('match_result', 'correct_score', 'over_under', 'over_under_1_5', 'over_under_3_5', 'btts', 'half_time', 'spreads'));
  END IF;
END $$;

-- Migrate existing constraint if it doesn't include CANCELLED
DO $$
BEGIN
  -- Drop old constraint and recreate with CANCELLED included
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bets_status_check' AND conrelid = 'public.bets'::regclass
  ) THEN
    ALTER TABLE public.bets DROP CONSTRAINT bets_status_check;
    ALTER TABLE public.bets ADD CONSTRAINT bets_status_check
      CHECK (status IN ('PENDING', 'WON', 'LOST', 'CANCELLED'));
  END IF;
END $$;

-- ==================
-- 2. INDEXES
-- ==================

CREATE INDEX IF NOT EXISTS idx_matches_matchday ON matches(matchday);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_matchday_status ON matches(matchday, status);
CREATE INDEX IF NOT EXISTS idx_matches_league_id ON matches(league_id);
CREATE INDEX IF NOT EXISTS idx_matches_league_status_date ON matches(league_id, status, utc_date);
CREATE INDEX IF NOT EXISTS idx_bets_user_id ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_user_created ON bets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bets_match_status ON bets(match_id, status);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_user_created ON deposit_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_status_created ON deposit_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teams_position ON teams(position);

-- Seed baseline leagues (only PL enabled by default)
INSERT INTO public.leagues (code, name, country, is_active)
VALUES
  ('PL', 'Premier League', 'England', true),
  ('CL', 'UEFA Champions League', 'Europe', true),
  ('EL', 'UEFA Europa League', 'Europe', true)
ON CONFLICT (code) DO NOTHING;

-- ==================
-- 3. HELPER FUNCTIONS
-- ==================

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

-- ============================================
-- Phase 2: Auth — DB Trigger + RLS
-- ============================================

-- 4. TRIGGER: auto-create public.users row when auth.users row is inserted
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
    1000000,
    false
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 5. RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id OR is_admin());

ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own deposit requests" ON public.deposit_requests;
CREATE POLICY "Users can read own deposit requests"
  ON public.deposit_requests
  FOR SELECT
  USING (auth.uid() = user_id OR is_admin());

-- 6. Username availability check (SECURITY DEFINER = bypass RLS, works for unauthenticated)
CREATE OR REPLACE FUNCTION check_username_available(p_username VARCHAR)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.users WHERE username = p_username
  );
$$;

-- ==================
-- Phase 5: Betting RPCs
-- ==================

-- place_bet: atomic bet + balance deduction
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

  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
  IF v_banned THEN RAISE EXCEPTION 'USER_BANNED'; END IF;

  -- 2. Check match
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'MATCH_NOT_FOUND'; END IF;
  IF v_match.status NOT IN ('TIMED', 'SCHEDULED') THEN
    RAISE EXCEPTION 'MATCH_NOT_OPEN';
  END IF;

  -- 3. Check balance (BR-B03, BR-C04)
  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;

  -- 4. Get odds from match.odds JSON (BR-E08: lock odds at bet time)
  v_odds := (v_match.odds -> p_bet_type ->> p_bet_choice)::NUMERIC;
  IF v_odds IS NULL THEN RAISE EXCEPTION 'INVALID_BET'; END IF;

  -- 5. Insert bet (BR-C07)
  INSERT INTO bets (user_id, match_id, bet_type, bet_choice, amount, odds)
  VALUES (v_user_id, p_match_id, p_bet_type, p_bet_choice, p_amount, v_odds)
  RETURNING id INTO v_bet_id;

  -- 6. Deduct balance immediately (BR-B04)
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

-- deposit: deprecated. Use deposit-request approval flow instead.
CREATE OR REPLACE FUNCTION deposit(p_amount BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RAISE EXCEPTION 'DEPOSIT_DISABLED_USE_REQUEST';
END;
$$;

CREATE OR REPLACE FUNCTION create_deposit_request(p_amount BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_request public.deposit_requests%ROWTYPE;
  v_banned BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;

  SELECT is_banned INTO v_banned
  FROM public.users
  WHERE id = v_user_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
  IF v_banned THEN RAISE EXCEPTION 'USER_BANNED'; END IF;

  INSERT INTO public.deposit_requests (user_id, amount)
  VALUES (v_user_id, p_amount)
  RETURNING * INTO v_request;

  RETURN to_jsonb(v_request);
END;
$$;

CREATE OR REPLACE FUNCTION approve_deposit_request(
  p_request_id UUID,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_request public.deposit_requests%ROWTYPE;
  v_new_balance BIGINT;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;

  SELECT *
  INTO v_request
  FROM public.deposit_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND'; END IF;
  IF v_request.status <> 'PENDING' THEN RAISE EXCEPTION 'REQUEST_ALREADY_REVIEWED'; END IF;

  UPDATE public.users
  SET balance = balance + v_request.amount
  WHERE id = v_request.user_id
  RETURNING balance INTO v_new_balance;

  UPDATE public.deposit_requests
  SET
    status = 'APPROVED',
    reviewed_by = v_admin_id,
    reviewed_at = NOW(),
    admin_note = NULLIF(TRIM(COALESCE(p_admin_note, '')), '')
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  RETURN jsonb_build_object(
    'request', to_jsonb(v_request),
    'new_balance', v_new_balance
  );
END;
$$;

CREATE OR REPLACE FUNCTION reject_deposit_request(
  p_request_id UUID,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request public.deposit_requests%ROWTYPE;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;

  SELECT *
  INTO v_request
  FROM public.deposit_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND'; END IF;
  IF v_request.status <> 'PENDING' THEN RAISE EXCEPTION 'REQUEST_ALREADY_REVIEWED'; END IF;

  UPDATE public.deposit_requests
  SET
    status = 'REJECTED',
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    admin_note = NULLIF(TRIM(COALESCE(p_admin_note, '')), '')
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  RETURN to_jsonb(v_request);
END;
$$;

-- settle_match_bets: atomic settlement per match (BR-G05/G06, BR-F04 CANCELLED refund)
CREATE OR REPLACE FUNCTION settle_match_bets(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match RECORD;
  v_bet RECORD;
  v_won BOOLEAN;
  v_winnings BIGINT;
  v_actual_result VARCHAR;
  v_line NUMERIC;
  v_adj_home NUMERIC;
  v_bets_won INT := 0;
  v_bets_lost INT := 0;
  v_total_winnings BIGINT := 0;
BEGIN
  -- 1. Get match (must be FINISHED or CANCELLED + not settled)
  SELECT * INTO v_match FROM matches
  WHERE id = p_match_id AND status IN ('FINISHED', 'CANCELLED') AND is_settled = false;

  IF NOT FOUND THEN RETURN NULL; END IF;

  -- 1b. CANCELLED matches → refund all PENDING bets (BR-F04)
  IF v_match.status = 'CANCELLED' THEN
    FOR v_bet IN
      SELECT * FROM bets WHERE match_id = p_match_id AND status = 'PENDING'
    LOOP
      UPDATE bets SET status = 'CANCELLED', winnings = v_bet.amount WHERE id = v_bet.id;
      UPDATE users SET balance = balance + v_bet.amount WHERE id = v_bet.user_id;
      v_bets_lost := v_bets_lost + 1;
      v_total_winnings := v_total_winnings + v_bet.amount;
    END LOOP;
    UPDATE matches SET is_settled = true WHERE id = p_match_id;
    RETURN jsonb_build_object(
      'match_id', p_match_id,
      'bets_won', 0,
      'bets_lost', v_bets_lost,
      'total_winnings', v_total_winnings,
      'refunded', true
    );
  END IF;

  -- 2. Process each PENDING bet (FINISHED matches)
  FOR v_bet IN
    SELECT * FROM bets
    WHERE match_id = p_match_id AND status = 'PENDING'
  LOOP
    v_won := false;

    CASE v_bet.bet_type
      WHEN 'match_result' THEN
        IF v_match.home_score > v_match.away_score AND v_bet.bet_choice = 'home' THEN v_won := true;
        ELSIF v_match.home_score = v_match.away_score AND v_bet.bet_choice = 'draw' THEN v_won := true;
        ELSIF v_match.home_score < v_match.away_score AND v_bet.bet_choice = 'away' THEN v_won := true;
        END IF;

      WHEN 'correct_score' THEN
        v_actual_result := v_match.home_score || '-' || v_match.away_score;
        IF v_actual_result = v_bet.bet_choice THEN v_won := true; END IF;

      WHEN 'over_under' THEN
        IF (v_match.home_score + v_match.away_score) >= 3 AND v_bet.bet_choice = 'over' THEN v_won := true;
        ELSIF (v_match.home_score + v_match.away_score) < 3 AND v_bet.bet_choice = 'under' THEN v_won := true;
        END IF;

      WHEN 'btts' THEN
        IF v_match.home_score >= 1 AND v_match.away_score >= 1 AND v_bet.bet_choice = 'yes' THEN v_won := true;
        ELSIF (v_match.home_score = 0 OR v_match.away_score = 0) AND v_bet.bet_choice = 'no' THEN v_won := true;
        END IF;

      WHEN 'half_time' THEN
        IF v_match.half_time_home IS NOT NULL AND v_match.half_time_away IS NOT NULL THEN
          IF v_match.half_time_home > v_match.half_time_away AND v_bet.bet_choice = 'home' THEN v_won := true;
          ELSIF v_match.half_time_home = v_match.half_time_away AND v_bet.bet_choice = 'draw' THEN v_won := true;
          ELSIF v_match.half_time_home < v_match.half_time_away AND v_bet.bet_choice = 'away' THEN v_won := true;
          END IF;
        END IF;

      WHEN 'over_under_1_5' THEN
        IF (v_match.home_score + v_match.away_score) >= 2 AND v_bet.bet_choice = 'over' THEN v_won := true;
        ELSIF (v_match.home_score + v_match.away_score) < 2 AND v_bet.bet_choice = 'under' THEN v_won := true;
        END IF;

      WHEN 'over_under_3_5' THEN
        IF (v_match.home_score + v_match.away_score) >= 4 AND v_bet.bet_choice = 'over' THEN v_won := true;
        ELSIF (v_match.home_score + v_match.away_score) < 4 AND v_bet.bet_choice = 'under' THEN v_won := true;
        END IF;

      WHEN 'spreads' THEN
        v_line := COALESCE((v_match.odds -> 'spreads' ->> 'line')::NUMERIC, 0);
        v_adj_home := v_match.home_score + v_line;
        IF v_adj_home > v_match.away_score AND v_bet.bet_choice = 'home' THEN v_won := true;
        ELSIF v_adj_home < v_match.away_score AND v_bet.bet_choice = 'away' THEN v_won := true;
        ELSIF v_adj_home = v_match.away_score THEN
          -- Push: refund the bet
          UPDATE bets SET status = 'CANCELLED', winnings = v_bet.amount WHERE id = v_bet.id;
          UPDATE users SET balance = balance + v_bet.amount WHERE id = v_bet.user_id;
          CONTINUE;  -- skip the win/loss block below
        END IF;
    END CASE;

    IF v_won THEN
      v_winnings := ROUND(v_bet.amount * v_bet.odds);
      UPDATE bets SET status = 'WON', winnings = v_winnings WHERE id = v_bet.id;
      UPDATE users SET balance = balance + v_winnings WHERE id = v_bet.user_id;
      v_bets_won := v_bets_won + 1;
      v_total_winnings := v_total_winnings + v_winnings;
    ELSE
      UPDATE bets SET status = 'LOST' WHERE id = v_bet.id;
      v_bets_lost := v_bets_lost + 1;
    END IF;
  END LOOP;

  -- 3. Mark match settled (BR-G02)
  UPDATE matches SET is_settled = true WHERE id = p_match_id;

  RETURN jsonb_build_object(
    'match_id', p_match_id,
    'bets_won', v_bets_won,
    'bets_lost', v_bets_lost,
    'total_winnings', v_total_winnings
  );
END;
$$;

-- ==================
-- Phase 7: User Features RPCs + RLS
-- ==================

-- get_user_stats: stats for authenticated user (BR-I01/I03/I04)
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

-- get_leaderboard: top N winners/losers + user's own rank (BR-H01/H03/H05)
CREATE OR REPLACE FUNCTION get_leaderboard(
  p_type  VARCHAR DEFAULT 'winners',
  p_limit INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_my_rank JSONB;
  v_user_id UUID := auth.uid();
BEGIN
  IF p_type = 'winners' THEN
    SELECT jsonb_agg(to_jsonb(t)) INTO v_result
    FROM (
      SELECT u.username, COALESCE(SUM(b.winnings), 0) AS total
      FROM users u
      LEFT JOIN bets b ON b.user_id = u.id AND b.status = 'WON'
      WHERE u.role = 'user'
      GROUP BY u.id, u.username
      ORDER BY total DESC
      LIMIT p_limit
    ) t;

    SELECT jsonb_build_object('rank', rank, 'username', username, 'total', total)
    INTO v_my_rank
    FROM (
      SELECT u.username,
             COALESCE(SUM(b.winnings), 0) AS total,
             ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(b.winnings), 0) DESC) AS rank
      FROM users u
      LEFT JOIN bets b ON b.user_id = u.id AND b.status = 'WON'
      WHERE u.role = 'user'
      GROUP BY u.id, u.username
    ) ranked
    WHERE username = (SELECT username FROM users WHERE id = v_user_id);
  ELSE
    SELECT jsonb_agg(to_jsonb(t)) INTO v_result
    FROM (
      SELECT u.username, COALESCE(SUM(b.amount), 0) AS total
      FROM users u
      LEFT JOIN bets b ON b.user_id = u.id AND b.status = 'LOST'
      WHERE u.role = 'user'
      GROUP BY u.id, u.username
      ORDER BY total DESC
      LIMIT p_limit
    ) t;

    SELECT jsonb_build_object('rank', rank, 'username', username, 'total', total)
    INTO v_my_rank
    FROM (
      SELECT u.username,
             COALESCE(SUM(b.amount), 0) AS total,
             ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(b.amount), 0) DESC) AS rank
      FROM users u
      LEFT JOIN bets b ON b.user_id = u.id AND b.status = 'LOST'
      WHERE u.role = 'user'
      GROUP BY u.id, u.username
    ) ranked
    WHERE username = (SELECT username FROM users WHERE id = v_user_id);
  END IF;

  RETURN jsonb_build_object(
    'leaderboard', COALESCE(v_result, '[]'::jsonb),
    'my_rank', v_my_rank
  );
END;
$$;

-- ==================
-- RLS Policies (all tables, idempotent)
-- ==================

-- USERS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE USING (auth.uid() = id OR is_admin());

-- TEAMS (public read)
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can read teams" ON public.teams;
CREATE POLICY "Everyone can read teams"
  ON public.teams FOR SELECT USING (true);

-- LEAGUES (public read)
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can read leagues" ON public.leagues;
CREATE POLICY "Everyone can read leagues"
  ON public.leagues FOR SELECT USING (true);

-- MATCHES (public read)
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can read matches" ON public.matches;
CREATE POLICY "Everyone can read matches"
  ON public.matches FOR SELECT USING (true);

-- BETS (user reads own, admin reads all)
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own bets" ON public.bets;
CREATE POLICY "Users can read own bets"
  ON public.bets FOR SELECT USING (auth.uid() = user_id OR is_admin());

-- ==================
-- Phase 8: Admin RPC
-- ==================

-- get_admin_stats: dashboard stats (BR-K03 admin-only)
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
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
      SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
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

-- ==================
-- SEED: Admin account (idempotent)
-- Email: admin@betking.com  |  Password: admin
-- ==================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@betking.com') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'admin@betking.com',
      crypt('admin', gen_salt('bf')),
      NOW(),
      '{"username": "admin"}'::jsonb,
      NOW(),
      NOW(),
      '', '', '', ''
    );
  END IF;
END $$;

-- Promote to admin (safe to re-run)
UPDATE public.users SET role = 'admin' WHERE email = 'admin@betking.com';
