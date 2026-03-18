-- ============================================
-- KingBet67: Parlay Betting System
-- Run on Supabase Dashboard → SQL Editor
-- ============================================

-- ==================
-- 1. PARLAY TABLES
-- ==================

CREATE TABLE IF NOT EXISTS public.parlay_bets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      BIGINT      NOT NULL CHECK (amount > 0),
  total_odds  NUMERIC(10,2) NOT NULL,
  status      VARCHAR(10) NOT NULL DEFAULT 'PENDING'
              CHECK (status IN ('PENDING', 'WON', 'LOST')),
  winnings    BIGINT      DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.parlay_bet_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  parlay_bet_id   UUID        NOT NULL REFERENCES parlay_bets(id) ON DELETE CASCADE,
  match_id        UUID        NOT NULL REFERENCES matches(id),
  bet_type        VARCHAR(20) NOT NULL,
  bet_choice      VARCHAR(10) NOT NULL,
  odds            NUMERIC(6,2) NOT NULL,
  result          VARCHAR(10) NOT NULL DEFAULT 'PENDING'
                  CHECK (result IN ('PENDING', 'WON', 'LOST')),
  UNIQUE(parlay_bet_id, match_id)
);

-- ==================
-- 2. INDEXES
-- ==================

CREATE INDEX IF NOT EXISTS idx_parlay_bets_user ON parlay_bets(user_id);
CREATE INDEX IF NOT EXISTS idx_parlay_bets_status ON parlay_bets(status);
CREATE INDEX IF NOT EXISTS idx_parlay_bets_user_created ON parlay_bets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parlay_items_parlay ON parlay_bet_items(parlay_bet_id);
CREATE INDEX IF NOT EXISTS idx_parlay_items_match ON parlay_bet_items(match_id);

-- ==================
-- 3. RLS POLICIES
-- ==================

ALTER TABLE public.parlay_bets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own parlays" ON public.parlay_bets;
CREATE POLICY "Users read own parlays"
  ON public.parlay_bets FOR SELECT
  USING (auth.uid() = user_id OR is_admin());

ALTER TABLE public.parlay_bet_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own parlay items" ON public.parlay_bet_items;
CREATE POLICY "Users read own parlay items"
  ON public.parlay_bet_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM parlay_bets WHERE id = parlay_bet_id AND (user_id = auth.uid() OR is_admin())
  ));

-- ==================
-- 4. RPC: place_parlay_bet
-- ==================

CREATE OR REPLACE FUNCTION place_parlay_bet(
  p_selections JSONB,
  p_amount BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_balance BIGINT;
  v_banned BOOLEAN;
  v_total_odds NUMERIC := 1;
  v_parlay_id UUID;
  v_sel JSONB;
  v_match RECORD;
  v_odds NUMERIC;
  v_count INTEGER;
  v_match_ids UUID[] := '{}';
BEGIN
  -- 1. Check user
  SELECT balance, is_banned INTO v_balance, v_banned
  FROM users WHERE id = v_user_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
  IF v_banned THEN RAISE EXCEPTION 'USER_BANNED'; END IF;

  -- 2. Check balance
  IF v_balance < p_amount THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;

  -- 3. Validate selections count (2-8)
  v_count := jsonb_array_length(p_selections);
  IF v_count < 2 OR v_count > 8 THEN
    RAISE EXCEPTION 'INVALID_SELECTION_COUNT';
  END IF;

  -- 4. Create parlay bet
  INSERT INTO parlay_bets (user_id, amount, total_odds)
  VALUES (v_user_id, p_amount, 1)
  RETURNING id INTO v_parlay_id;

  -- 5. Process each selection
  FOR v_sel IN SELECT * FROM jsonb_array_elements(p_selections) LOOP
    -- Check for duplicate match
    IF (v_sel->>'match_id')::UUID = ANY(v_match_ids) THEN
      RAISE EXCEPTION 'DUPLICATE_MATCH';
    END IF;
    v_match_ids := array_append(v_match_ids, (v_sel->>'match_id')::UUID);

    -- Check match exists and is bettable
    SELECT * INTO v_match FROM matches WHERE id = (v_sel->>'match_id')::UUID;
    IF NOT FOUND THEN RAISE EXCEPTION 'MATCH_NOT_FOUND'; END IF;
    IF v_match.status NOT IN ('TIMED', 'SCHEDULED') THEN
      RAISE EXCEPTION 'MATCH_NOT_OPEN';
    END IF;

    -- Get odds from match JSON
    v_odds := (v_match.odds -> (v_sel->>'bet_type') ->> (v_sel->>'bet_choice'))::NUMERIC;
    IF v_odds IS NULL THEN RAISE EXCEPTION 'INVALID_BET'; END IF;

    -- Insert parlay item
    INSERT INTO parlay_bet_items (parlay_bet_id, match_id, bet_type, bet_choice, odds)
    VALUES (v_parlay_id, (v_sel->>'match_id')::UUID, v_sel->>'bet_type', v_sel->>'bet_choice', v_odds);

    v_total_odds := v_total_odds * v_odds;
  END LOOP;

  -- 6. Update total odds
  UPDATE parlay_bets SET total_odds = ROUND(v_total_odds, 2) WHERE id = v_parlay_id;

  -- 7. Deduct balance
  UPDATE users SET balance = balance - p_amount WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'id', v_parlay_id,
    'selections', v_count,
    'total_odds', ROUND(v_total_odds, 2),
    'amount', p_amount,
    'potential_win', ROUND(p_amount * v_total_odds)
  );
END;
$$;

-- ==================
-- 5. RPC: settle_parlay_bets (called from sync-matches edge function)
-- ==================

CREATE OR REPLACE FUNCTION settle_parlay_bets()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parlay RECORD;
  v_item RECORD;
  v_match RECORD;
  v_all_won BOOLEAN;
  v_any_lost BOOLEAN;
  v_all_settled BOOLEAN;
  v_item_won BOOLEAN;
  v_actual_result VARCHAR;
  v_line NUMERIC;
  v_adj_home NUMERIC;
  v_settled_count INTEGER := 0;
  v_winnings BIGINT;
BEGIN
  FOR v_parlay IN SELECT * FROM parlay_bets WHERE status = 'PENDING' LOOP
    v_all_won := TRUE;
    v_any_lost := FALSE;
    v_all_settled := TRUE;

    FOR v_item IN SELECT * FROM parlay_bet_items WHERE parlay_bet_id = v_parlay.id LOOP
      SELECT * INTO v_match FROM matches WHERE id = v_item.match_id;

      IF v_match.status IN ('FINISHED', 'CANCELLED') THEN
        v_item_won := FALSE;

        -- CANCELLED → item loses (parlay fails)
        IF v_match.status = 'CANCELLED' THEN
          v_any_lost := TRUE;
          v_all_won := FALSE;
          UPDATE parlay_bet_items SET result = 'LOST' WHERE id = v_item.id;
          CONTINUE;
        END IF;

        -- Check result based on bet type (same logic as settle_match_bets)
        CASE v_item.bet_type
          WHEN 'match_result' THEN
            IF v_match.home_score > v_match.away_score AND v_item.bet_choice = 'home' THEN v_item_won := TRUE;
            ELSIF v_match.home_score = v_match.away_score AND v_item.bet_choice = 'draw' THEN v_item_won := TRUE;
            ELSIF v_match.home_score < v_match.away_score AND v_item.bet_choice = 'away' THEN v_item_won := TRUE;
            END IF;

          WHEN 'correct_score' THEN
            v_actual_result := v_match.home_score || '-' || v_match.away_score;
            IF v_actual_result = v_item.bet_choice THEN v_item_won := TRUE; END IF;

          WHEN 'over_under' THEN
            IF (v_match.home_score + v_match.away_score) >= 3 AND v_item.bet_choice = 'over' THEN v_item_won := TRUE;
            ELSIF (v_match.home_score + v_match.away_score) < 3 AND v_item.bet_choice = 'under' THEN v_item_won := TRUE;
            END IF;

          WHEN 'over_under_1_5' THEN
            IF (v_match.home_score + v_match.away_score) >= 2 AND v_item.bet_choice = 'over' THEN v_item_won := TRUE;
            ELSIF (v_match.home_score + v_match.away_score) < 2 AND v_item.bet_choice = 'under' THEN v_item_won := TRUE;
            END IF;

          WHEN 'over_under_3_5' THEN
            IF (v_match.home_score + v_match.away_score) >= 4 AND v_item.bet_choice = 'over' THEN v_item_won := TRUE;
            ELSIF (v_match.home_score + v_match.away_score) < 4 AND v_item.bet_choice = 'under' THEN v_item_won := TRUE;
            END IF;

          WHEN 'btts' THEN
            IF v_match.home_score >= 1 AND v_match.away_score >= 1 AND v_item.bet_choice = 'yes' THEN v_item_won := TRUE;
            ELSIF (v_match.home_score = 0 OR v_match.away_score = 0) AND v_item.bet_choice = 'no' THEN v_item_won := TRUE;
            END IF;

          WHEN 'half_time' THEN
            IF v_match.half_time_home IS NOT NULL AND v_match.half_time_away IS NOT NULL THEN
              IF v_match.half_time_home > v_match.half_time_away AND v_item.bet_choice = 'home' THEN v_item_won := TRUE;
              ELSIF v_match.half_time_home = v_match.half_time_away AND v_item.bet_choice = 'draw' THEN v_item_won := TRUE;
              ELSIF v_match.half_time_home < v_match.half_time_away AND v_item.bet_choice = 'away' THEN v_item_won := TRUE;
              END IF;
            END IF;

          WHEN 'spreads' THEN
            v_line := COALESCE((v_match.odds -> 'spreads' ->> 'line')::NUMERIC, 0);
            v_adj_home := v_match.home_score + v_line;
            IF v_adj_home > v_match.away_score AND v_item.bet_choice = 'home' THEN v_item_won := TRUE;
            ELSIF v_adj_home < v_match.away_score AND v_item.bet_choice = 'away' THEN v_item_won := TRUE;
            END IF;
        END CASE;

        -- Update item result
        IF v_item_won THEN
          UPDATE parlay_bet_items SET result = 'WON' WHERE id = v_item.id;
        ELSE
          UPDATE parlay_bet_items SET result = 'LOST' WHERE id = v_item.id;
          v_any_lost := TRUE;
          v_all_won := FALSE;
        END IF;
      ELSE
        -- Match not yet finished
        v_all_settled := FALSE;
      END IF;
    END LOOP;

    -- Only settle if ALL matches are done
    IF v_all_settled THEN
      IF v_all_won AND NOT v_any_lost THEN
        v_winnings := ROUND(v_parlay.amount * v_parlay.total_odds);
        UPDATE parlay_bets SET status = 'WON', winnings = v_winnings, settled_at = NOW()
        WHERE id = v_parlay.id;
        UPDATE users SET balance = balance + v_winnings WHERE id = v_parlay.user_id;
      ELSE
        UPDATE parlay_bets SET status = 'LOST', settled_at = NOW()
        WHERE id = v_parlay.id;
      END IF;
      v_settled_count := v_settled_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('parlays_settled', v_settled_count);
END;
$$;
