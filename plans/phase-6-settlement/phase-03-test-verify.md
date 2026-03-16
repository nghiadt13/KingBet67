# Phase 3: Test Script + Verify

## Context

- [Existing test-sync.ts](file:///d:/works/vsc_test/scripts/test-sync.ts)
- [Business Rules: Settlement](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L98-L106)

## Overview

- **Priority:** P2
- **Status:** Pending
- **Effort:** ~1h

Test settlement logic locally + verify end-to-end flow.

## Files

### [NEW] `scripts/test-settle.ts`

Node.js script to test settlement locally (same pattern as `test-sync.ts`).

**Test plan:**

```typescript
// 1. Setup: pick a FINISHED match from DB
// 2. Temporarily mark it as unsettled: UPDATE matches SET is_settled = false WHERE id = X
// 3. Create test bets (if none exist): INSERT dummy PENDING bets
// 4. Call settle_match_bets RPC
// 5. Verify: bets now WON/LOST, winnings set, balance updated
// 6. Cleanup: revert test data

// Alternative: just call the settle-bets Edge Function endpoint
const res = await fetch(`${SUPABASE_URL}/functions/v1/settle-bets`, {
  method: "POST",
  headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
});
console.log(await res.json());
```

**Key test cases:**

| # | Test Case | Expected |
|---|-----------|----------|
| 1 | Match FINISHED, bet match_result "home", home wins | WON, winnings = amount × odds |
| 2 | Match FINISHED, bet match_result "home", away wins | LOST |
| 3 | Match FINISHED, bet correct_score "2-1", actual 2-1 | WON |
| 4 | Match FINISHED, bet correct_score "2-1", actual 1-0 | LOST |
| 5 | Match FINISHED, bet over_under "over", 3+ goals | WON |
| 6 | Match FINISHED, bet over_under "under", 2 goals | WON |
| 7 | Match FINISHED, bet btts "yes", both scored | WON |
| 8 | Match FINISHED, bet half_time "draw", HT score 0-0 | WON |
| 9 | Match already settled (is_settled=true) | No-op (NULL) |
| 10 | Match FINISHED but no PENDING bets | is_settled=true, 0 bets |

### End-to-End Verification

Manual test flow:

1. Sign in as test user
2. Navigate to a TIMED match → place a bet
3. (In Supabase SQL Editor) Manually set that match to FINISHED + set scores:
   ```sql
   UPDATE matches SET status = 'FINISHED', home_score = 2, away_score = 1,
     half_time_home = 1, half_time_away = 0
   WHERE id = '<match-id>';
   ```
4. Run `test-settle.ts` OR call Edge Function
5. Check:
   - Bet status changed: PENDING → WON or LOST
   - If WON: winnings = amount × odds, user balance increased
   - Match: is_settled = true
6. Check in app: History tab shows updated bet status

## Todo List

- [ ] Create `scripts/test-settle.ts`
- [ ] Test all 5 bet types
- [ ] Test double-settlement prevention
- [ ] End-to-end: place bet → settle → verify in app
- [ ] Edge Function deployment test (if Supabase CLI installed)

## Success Criteria

- All 10 test cases pass
- End-to-end flow works: bet → settle → balance updated → history shows result
- No double settlement
- Settlement summary accurate
