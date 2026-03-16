# Phase 2: Hook Settlement vào sync-matches

## Context

- [Existing sync-matches](file:///d:/works/vsc_test/supabase/functions/sync-matches/index.ts)
- [API Contract: sync-matches response](file:///d:/works/vsc_test/docs/08_API_CONTRACT.md#L314-L323)
- [Business Rules: BR-G03](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L102) — auto settle when sync detects FINISHED
- [Business Rules: BR-J03](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L132) — trigger auto settle

## Overview

- **Priority:** P1
- **Status:** Pending
- **Effort:** ~30min

After sync-matches updates match statuses, automatically settle any newly-FINISHED matches.

## File

### [MODIFY] `supabase/functions/sync-matches/index.ts`

**Add settlement step after odds calculation (step 7 → new step 8):**

Insert between current step 7 (odds calculation) and step 8 (return summary):

```typescript
// 8. Auto-settle FINISHED matches (BR-G03, BR-J03)
const { data: unsettledMatches } = await supabaseAdmin
  .from("matches")
  .select("id")
  .eq("status", "FINISHED")
  .eq("is_settled", false);

let betsSettled = 0;
let totalWinnings = 0;

for (const match of unsettledMatches ?? []) {
  const { data } = await supabaseAdmin
    .rpc("settle_match_bets", { p_match_id: match.id });

  if (data) {
    betsSettled += (data.bets_won ?? 0) + (data.bets_lost ?? 0);
    totalWinnings += data.total_winnings ?? 0;
  }
}
```

**Update summary response:**

```typescript
const summary = {
  teams_updated: teamsToUpsert.length,
  matches_updated: validMatches.length,
  odds_calculated: oddsCalculated,
  // NEW fields
  matches_settled: (unsettledMatches ?? []).length,
  bets_settled: betsSettled,
  total_winnings: totalWinnings,
  timestamp: new Date().toISOString(),
};
```

**This matches the API Contract response format (08_API_CONTRACT.md line 316-322).**

## Important Notes

1. **Order matters:** Settlement must run AFTER match upsert (step 6) so `is_settled` and `status` are current
2. **Settlement uses RPC** `settle_match_bets` — atomic per match, same as `settle-bets` Edge Function
3. **No duplicate work:** If `settle-bets` Edge Function is also called separately (by admin), `is_settled=true` prevents re-settlement
4. **Error handling:** If settle fails for one match, log error but continue with others. Don't fail the entire sync.

## Todo List

- [ ] Add settlement block to `sync-matches/index.ts` after odds step
- [ ] Update summary response with settlement fields
- [ ] Error handling: try/catch per match, log and continue

## Success Criteria

- After sync: any newly-FINISHED match is auto-settled
- Bets change from PENDING → WON/LOST
- User balances updated for WON bets
- Summary includes `matches_settled`, `bets_settled`, `total_winnings`
- Existing sync functionality unaffected (teams, matches, odds still work)
