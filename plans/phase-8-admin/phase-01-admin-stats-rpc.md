# Phase 1: SQL — get_admin_stats RPC

## Context

- [DB Schema: get_admin_stats](file:///d:/works/vsc_test/docs/09_DB_SCHEMA.md#L350-L404)
- [API Contract: get_admin_stats](file:///d:/works/vsc_test/docs/08_API_CONTRACT.md#L265-L292)
- [Business Rules: Admin](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L138-L144)

## Overview

- **Priority:** P0 (blocker for Dashboard)
- **Status:** Pending
- **Effort:** ~30min

## Files

### [MODIFY] `supabase/schema.sql`

SQL already defined in docs. Copy as-is:

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
  -- Check admin (BR-K03: only admin can access)
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

**Business rules enforced:**
- BR-K03: `is_admin()` guard
- BR-K04: hottest_match = most bets (COUNT, not SUM)

### [MODIFY] `types/database.ts`

Add RPC type:

```typescript
get_admin_stats: {
  Args: Record<string, never>;
  Returns: {
    total_users: number;
    total_bets: number;
    total_money_circulation: number;
    pending_bets: number;
    hottest_match: {
      id: string;
      home_team_name: string;
      away_team_name: string;
      bet_count: number;
    } | null;
    top_users: { username: string; total_winnings: number }[];
  };
};
```

## Todo List

- [ ] Append `get_admin_stats` RPC to `schema.sql`
- [ ] Run SQL on Supabase Dashboard
- [ ] Add type to `types/database.ts`
- [ ] Verify: `supabase.rpc('get_admin_stats')` returns data (admin user only)

## Success Criteria

- Admin user can call RPC → receives stats
- Non-admin user gets UNAUTHORIZED error
- Response matches API Contract structure
