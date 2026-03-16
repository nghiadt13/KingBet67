# Phase 1: Edge Function `settle-bets`

## Context

- [API Contract: settle-bets](file:///d:/works/vsc_test/docs/08_API_CONTRACT.md#L332-L364)
- [Business Rules: Settlement](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L98-L106)
- [Business Rules: Bet Types](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L47-L72)
- [Business Rules: Balance](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L22-L30)
- [DB Schema: bets table](file:///d:/works/vsc_test/docs/09_DB_SCHEMA.md#L94-L111)
- [DB Schema: matches table](file:///d:/works/vsc_test/docs/09_DB_SCHEMA.md#L55-L91)
- [Existing sync-matches](file:///d:/works/vsc_test/supabase/functions/sync-matches/index.ts)

## Overview

- **Priority:** P0
- **Status:** Pending
- **Effort:** ~1.5h

Core settlement logic as a standalone Edge Function.

## File

### [NEW] `supabase/functions/settle-bets/index.ts`

**Architecture:**

```
Deno.serve(async (req) => {
  // 1. Init supabaseAdmin (service_role key)
  // 2. Find unsettled FINISHED matches
  // 3. For each match: settle all PENDING bets
  // 4. Return summary
})
```

**Detailed logic:**

```typescript
// Step 1: Find matches to settle
const { data: unsettledMatches } = await supabaseAdmin
  .from("matches")
  .select("id, home_score, away_score, half_time_home, half_time_away")
  .eq("status", "FINISHED")
  .eq("is_settled", false);

// Step 2: For each match
for (const match of unsettledMatches) {
  // 2a. Fetch PENDING bets for this match
  const { data: pendingBets } = await supabaseAdmin
    .from("bets")
    .select("id, user_id, bet_type, bet_choice, amount, odds")
    .eq("match_id", match.id)
    .eq("status", "PENDING");

  // 2b. Determine result for each bet
  for (const bet of pendingBets) {
    const won = checkBetResult(match, bet);
    
    if (won) {
      const winnings = Math.round(bet.amount * bet.odds);
      // Update bet → WON + set winnings
      await supabaseAdmin
        .from("bets")
        .update({ status: "WON", winnings })
        .eq("id", bet.id);
      // Credit user balance (BR-B05)
      await supabaseAdmin
        .from("users")
        .update({ balance: supabaseAdmin.rpc... })
        // Actually: use raw SQL or increment
    } else {
      // Update bet → LOST (BR-B06: money already deducted at bet time)
      await supabaseAdmin
        .from("bets")
        .update({ status: "LOST" })
        .eq("id", bet.id);
    }
  }
  
  // 2c. Mark match as settled (BR-G02: prevent re-settle)
  await supabaseAdmin
    .from("matches")
    .update({ is_settled: true })
    .eq("id", match.id);
}
```

**Balance increment problem:** Supabase JS client doesn't support `SET balance = balance + X`. Options:
1. **RPC for increment** — create a simple `credit_balance(user_id, amount)` RPC
2. **Direct SQL via `.rpc()`** — call a generic function
3. **Read-then-write** — read balance, add winnings, write back (race condition risk!)

**Best approach: RPC `settle_match_bets`**

Actually, the cleanest solution is a **single RPC** that settles all bets for one match atomically (BR-G05):

```sql
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
  v_bets_won INT := 0;
  v_bets_lost INT := 0;
  v_total_winnings BIGINT := 0;
BEGIN
  -- 1. Get match (must be FINISHED + not settled)
  SELECT * INTO v_match FROM matches
  WHERE id = p_match_id AND status = 'FINISHED' AND is_settled = false;
  
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- 2. Process each PENDING bet
  FOR v_bet IN
    SELECT * FROM bets
    WHERE match_id = p_match_id AND status = 'PENDING'
  LOOP
    v_won := false;

    -- Check by bet_type
    CASE v_bet.bet_type
      WHEN 'match_result' THEN
        -- BR-D01: compare fulltime scores
        IF v_match.home_score > v_match.away_score AND v_bet.bet_choice = 'home' THEN v_won := true;
        ELSIF v_match.home_score = v_match.away_score AND v_bet.bet_choice = 'draw' THEN v_won := true;
        ELSIF v_match.home_score < v_match.away_score AND v_bet.bet_choice = 'away' THEN v_won := true;
        END IF;

      WHEN 'correct_score' THEN
        -- BR-D02: exact score "home-away"
        v_actual_result := v_match.home_score || '-' || v_match.away_score;
        IF v_actual_result = v_bet.bet_choice THEN v_won := true; END IF;

      WHEN 'over_under' THEN
        -- BR-D03: total goals > 2.5 (>= 3)
        IF (v_match.home_score + v_match.away_score) >= 3 AND v_bet.bet_choice = 'over' THEN v_won := true;
        ELSIF (v_match.home_score + v_match.away_score) < 3 AND v_bet.bet_choice = 'under' THEN v_won := true;
        END IF;

      WHEN 'btts' THEN
        -- BR-D04: both teams scored
        IF v_match.home_score >= 1 AND v_match.away_score >= 1 AND v_bet.bet_choice = 'yes' THEN v_won := true;
        ELSIF (v_match.home_score = 0 OR v_match.away_score = 0) AND v_bet.bet_choice = 'no' THEN v_won := true;
        END IF;

      WHEN 'half_time' THEN
        -- BR-D05: half-time result
        IF v_match.half_time_home IS NOT NULL AND v_match.half_time_away IS NOT NULL THEN
          IF v_match.half_time_home > v_match.half_time_away AND v_bet.bet_choice = 'home' THEN v_won := true;
          ELSIF v_match.half_time_home = v_match.half_time_away AND v_bet.bet_choice = 'draw' THEN v_won := true;
          ELSIF v_match.half_time_home < v_match.half_time_away AND v_bet.bet_choice = 'away' THEN v_won := true;
          END IF;
        END IF;
        -- If half_time scores are NULL → bet stays as LOST (conservative)
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
```

> **Why RPC instead of Edge Function logic?**
> - Atomic per match (BR-G05/G06) — entire LOOP is one PL/pgSQL transaction
> - `balance = balance + winnings` works natively in SQL (no race conditions)
> - Edge Function just orchestrates: find unsettled matches → call RPC for each

**Edge Function becomes thin orchestrator:**

```typescript
// settle-bets/index.ts
Deno.serve(async (req) => {
  // Init supabaseAdmin

  // 1. Find unsettled FINISHED matches
  const { data: unsettled } = await supabaseAdmin
    .from("matches")
    .select("id")
    .eq("status", "FINISHED")
    .eq("is_settled", false);

  const results = [];

  // 2. Settle each match via RPC
  for (const match of unsettled ?? []) {
    const { data, error } = await supabaseAdmin
      .rpc("settle_match_bets", { p_match_id: match.id });
    
    if (data) results.push(data);
    if (error) console.error(`settle ${match.id} failed:`, error.message);
  }

  // 3. Return summary
  const summary = {
    matches_settled: results.length,
    bets_won: results.reduce((s, r) => s + (r.bets_won ?? 0), 0),
    bets_lost: results.reduce((s, r) => s + (r.bets_lost ?? 0), 0),
    total_winnings: results.reduce((s, r) => s + (r.total_winnings ?? 0), 0),
  };

  return new Response(JSON.stringify(summary), { ... });
});
```

### [MODIFY] `supabase/schema.sql`

Append `settle_match_bets` RPC function.

### [MODIFY] `types/database.ts`

Add `settle_match_bets` to Functions section.

## Settlement Logic — Full Decision Table

| bet_type | bet_choice | Win Condition |
|----------|------------|---------------|
| match_result | home | home_score > away_score |
| match_result | draw | home_score = away_score |
| match_result | away | home_score < away_score |
| correct_score | "X-Y" | `{home_score}-{away_score}` = bet_choice |
| over_under | over | home_score + away_score >= 3 |
| over_under | under | home_score + away_score < 3 |
| btts | yes | home_score >= 1 AND away_score >= 1 |
| btts | no | home_score = 0 OR away_score = 0 |
| half_time | home | half_time_home > half_time_away |
| half_time | draw | half_time_home = half_time_away |
| half_time | away | half_time_home < half_time_away |

> **Edge case:** If `half_time_home`/`half_time_away` is NULL → half_time bets are LOST.

## Todo List

- [ ] Write `settle_match_bets` RPC (SQL) and add to `schema.sql`
- [ ] Create `supabase/functions/settle-bets/index.ts` (thin orchestrator)
- [ ] Add RPC type to `types/database.ts`
- [ ] Run SQL on Supabase Dashboard
- [ ] Handle correct_score format: `"{home}-{away}"` string comparison

## Success Criteria

- RPC `settle_match_bets(match_id)` → processes all PENDING bets for that match
- WON bets: status → WON, winnings set, user balance credited
- LOST bets: status → LOST
- Match marked `is_settled = true` after processing
- No double settlement (calling twice = no-op, returns NULL)
- Edge Function `settle-bets` → finds all unsettled FINISHED matches → settles each one
