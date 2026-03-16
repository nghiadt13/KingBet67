# Phase 1: SQL — RPCs + RLS Policies

## Context

- [DB Schema: get_user_stats](file:///d:/works/vsc_test/docs/09_DB_SCHEMA.md#L307-L346)
- [DB Schema: get_leaderboard](file:///d:/works/vsc_test/docs/09_DB_SCHEMA.md#L261-L303)
- [DB Schema: RLS Policies](file:///d:/works/vsc_test/docs/09_DB_SCHEMA.md#L441-L472)
- [Business Rules: Leaderboard](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L109-L115)
- [Business Rules: Profile Stats](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L119-L125)
- [Existing schema.sql](file:///d:/works/vsc_test/supabase/schema.sql)

## Overview

- **Priority:** P0 (blocker for S-08 + S-09)
- **Status:** Pending
- **Effort:** ~30min

Deploy 2 RPCs + remaining RLS policies.

## Current RLS Status

| Table | RLS Enabled? | Existing Policies |
|-------|-------------|-------------------|
| users | ✅ YES | "Users can read own profile" |
| teams | ❌ NO | None |
| matches | ❌ NO | None |
| bets | ❌ NO | None |

## Files

### [MODIFY] `supabase/schema.sql`

Append Phase 7 SQL:

#### `get_user_stats` (from docs, no changes needed)

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

**Business rules:** BR-I01 (total = all bets), BR-I03 (win rate excl. PENDING), BR-I04 (PENDING not in win rate)

#### `get_leaderboard` (FIXED: adds user's own rank)

> ⚠️ **Docs bug:** `v_my_rank` is declared but never set. Fixed version below includes user rank.

```sql
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
    -- Top N
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

    -- My rank
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
    -- Top N losers
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

    -- My rank (losers)
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
```

**Changes vs docs:**
1. Added `SECURITY DEFINER` — needs `auth.uid()` for user rank
2. Added `v_user_id` variable
3. Added "My rank" subquery using `ROW_NUMBER()`
4. Return structure changed: `{ leaderboard: [...], my_rank: { rank, username, total } }`

**Business rules:** BR-H01 (sorted by winnings), BR-H03 (losers by amount), BR-H04 (banned included), BR-H05 (own rank sticky)

#### RLS Policies (remaining tables)

```sql
-- TEAMS (public read)
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can read teams"
  ON public.teams FOR SELECT USING (true);

-- MATCHES (public read)
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can read matches"
  ON public.matches FOR SELECT USING (true);

-- BETS (user reads own, admin reads all)
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own bets"
  ON public.bets FOR SELECT USING (auth.uid() = user_id OR is_admin());

-- USERS: add update policy (was missing)
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE USING (auth.uid() = id OR is_admin());
```

> **⚠️ IMPORTANT ORDER:** Create policies FIRST, then enable RLS. If you enable RLS before creating policies, all queries will return empty. Actually in SQL, the `ALTER TABLE ENABLE RLS` and `CREATE POLICY` can be in ANY order — RLS only takes effect after the transaction commits. So running them together in one SQL Editor session is safe.

### [MODIFY] `types/database.ts`

Add RPC types:

```typescript
Functions: {
  // existing...
  get_user_stats: {
    Args: Record<string, never>;
    Returns: {
      total_bets: number;
      won_count: number;
      lost_count: number;
      pending_count: number;
      win_rate: number;
      total_winnings: number;
    };
  };
  get_leaderboard: {
    Args: { p_type?: string; p_limit?: number };
    Returns: {
      leaderboard: { username: string; total: number }[];
      my_rank: { rank: number; username: string; total: number } | null;
    };
  };
};
```

### [MODIFY] `docs/09_DB_SCHEMA.md`

Update `get_leaderboard` SQL to include `v_my_rank` calculation (fix the declared-but-unused bug).

## Todo List

- [ ] Append `get_user_stats` RPC to `schema.sql`
- [ ] Append fixed `get_leaderboard` RPC to `schema.sql`
- [ ] Append RLS policies for teams, matches, bets to `schema.sql`
- [ ] Append users UPDATE policy to `schema.sql`
- [ ] Run SQL on Supabase Dashboard
- [ ] Add RPC types to `types/database.ts`
- [ ] Update `docs/09_DB_SCHEMA.md` with fixed get_leaderboard
- [ ] Verify: `supabase.rpc('get_user_stats')` returns stats
- [ ] Verify: `supabase.rpc('get_leaderboard')` returns list + my_rank
- [ ] Verify: RLS working — user can read teams/matches, only own bets

## Success Criteria

- `get_user_stats` returns correct stats for authenticated user
- `get_leaderboard` returns sorted list + user's own rank
- RLS enabled on all 4 tables
- Existing queries still work (teams, matches, bets)
- No permission errors for normal operations
