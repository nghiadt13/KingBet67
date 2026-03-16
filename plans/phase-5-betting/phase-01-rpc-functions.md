# Phase 1: SQL — RPC Functions (place_bet + deposit)

## Context

- [DB Schema: place_bet RPC](file:///d:/works/vsc_test/docs/09_DB_SCHEMA.md#L159-L229)
- [DB Schema: deposit RPC](file:///d:/works/vsc_test/docs/09_DB_SCHEMA.md#L234-L257)
- [API Contract: place_bet](file:///d:/works/vsc_test/docs/08_API_CONTRACT.md#L182-L203)
- [API Contract: deposit](file:///d:/works/vsc_test/docs/08_API_CONTRACT.md#L207-L221)
- [Existing schema.sql](file:///d:/works/vsc_test/supabase/schema.sql)
- [Business Rules: Betting](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L33-L44)
- [Business Rules: Balance](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L22-L30)

## Overview

- **Priority:** P0 (blocker for all other phases)
- **Status:** Pending
- **Effort:** ~30min

Deploy 2 RPC functions to Supabase. Code đã defined trong `09_DB_SCHEMA.md`, chỉ cần copy vào `schema.sql` + chạy trên Dashboard.

## Files

### [MODIFY] `supabase/schema.sql`

Thêm 2 RPC functions vào cuối file. **SQL đã có sẵn trong docs, không cần viết mới.**

#### `place_bet` (from `09_DB_SCHEMA.md` line 162-229)

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
```

**Business rules enforced:**
- BR-C01/C02: match must be TIMED/SCHEDULED
- BR-C03/C04: amount > 0 (DB CHECK), balance >= amount
- BR-B04: balance deducted immediately
- BR-E08: odds locked from match.odds at bet time
- BR-A06: banned users cannot bet

#### `deposit` (from `09_DB_SCHEMA.md` line 237-256)

```sql
CREATE OR REPLACE FUNCTION deposit(p_amount BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance BIGINT;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;

  UPDATE users
  SET balance = balance + p_amount
  WHERE id = auth.uid()
  RETURNING balance INTO v_new_balance;

  RETURN jsonb_build_object('new_balance', v_new_balance);
END;
$$;
```

**Business rules enforced:**
- BR-B01: cộng thẳng vào balance
- BR-B02: amount > 0

### [MODIFY] `types/database.ts`

Thêm 2 RPC functions vào `Database.Functions`:

```typescript
Functions: {
  is_admin: { ... },
  check_username_available: { ... },
  // NEW
  place_bet: {
    Args: {
      p_match_id: string;
      p_bet_type: string;
      p_bet_choice: string;
      p_amount: number;
    };
    Returns: {
      id: string;
      bet_type: string;
      bet_choice: string;
      amount: number;
      odds: number;
    };
  };
  deposit: {
    Args: { p_amount: number };
    Returns: { new_balance: number };
  };
};
```

## Deployment Steps

1. Append SQL vào `supabase/schema.sql` (dưới Phase 2 section)
2. Copy SQL → paste vào Supabase Dashboard → SQL Editor → Run
3. Verify: `SELECT * FROM pg_proc WHERE proname IN ('place_bet', 'deposit');`

## Todo List

- [ ] Append `place_bet` RPC to `schema.sql`
- [ ] Append `deposit` RPC to `schema.sql`
- [ ] Run SQL on Supabase Dashboard
- [ ] Add `place_bet` + `deposit` to `types/database.ts` Functions
- [ ] Verify RPCs exist: query `pg_proc`

## Success Criteria

- `supabase.rpc('place_bet', {...})` từ frontend → trả về bet record
- `supabase.rpc('deposit', {...})` → trả về new_balance
- Error cases: MATCH_NOT_OPEN, INSUFFICIENT_BALANCE, INVALID_BET
- Atomic: bet insert + balance deduct in one transaction
