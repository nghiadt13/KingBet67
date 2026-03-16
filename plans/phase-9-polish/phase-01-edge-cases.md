# Phase 1: Edge Cases — POSTPONED & CANCELLED

## Context

- [Business Rules: BR-F03](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L92) — POSTPONED: no betting, show "Hoãn" badge
- [Business Rules: BR-F04](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L93) — CANCELLED: refund PENDING bets
- [Match Detail](file:///d:/works/vsc_test/app/match/[id].tsx) — currently shows odds for all statuses
- [place_bet RPC](file:///d:/works/vsc_test/supabase/schema.sql#L189-L191) — already blocks non-TIMED/SCHEDULED

## Overview

- **Priority:** P1
- **Status:** Pending
- **Effort:** ~1h

### Problem 1: POSTPONED matches show odds

Currently `match/[id].tsx` renders odds sections regardless of match status. The place_bet RPC rejects non-TIMED/SCHEDULED server-side, but user sees odds → taps → gets error. Bad UX.

### Problem 2: CANCELLED matches — no refund

If a match is CANCELLED and users have PENDING bets, money is trapped. BR-F04 requires refund.

## Files

### [MODIFY] `app/match/[id].tsx`

**Add status guard for odds/betting sections:**

```tsx
// Determine if match is bettable
const isBettable = canBet && ["TIMED", "SCHEDULED"].includes(match.status);

// Show info banner for non-bettable statuses
{match.status === "POSTPONED" && (
  <View style={styles.infoBanner}>
    <MaterialCommunityIcons name="clock-alert-outline" size={18} color="#F59E0B" />
    <Text style={styles.infoBannerText}>Trận đấu bị hoãn — không thể đặt cược</Text>
  </View>
)}
{match.status === "CANCELLED" && (
  <View style={styles.infoBanner}>
    <MaterialCommunityIcons name="cancel" size={18} color="#DC2626" />
    <Text style={styles.infoBannerText}>Trận đấu đã bị huỷ</Text>
  </View>
)}
{match.status === "IN_PLAY" && (
  <View style={styles.infoBanner}>
    <MaterialCommunityIcons name="soccer" size={18} color="#DC2626" />
    <Text style={styles.infoBannerText}>Trận đang diễn ra — không thể đặt cược</Text>
  </View>
)}

// Only render odds sections when bettable
{isBettable && match.odds && (
  <>
    {/* All odds sections: match_result, over_under, btts, half_time, correct_score */}
  </>
)}

// For FINISHED — show odds as readonly info (no onSelectOdd)
{match.status === "FINISHED" && match.odds && (
  <>
    {/* Same odds sections but without onSelectOdd handler — display only */}
  </>
)}
```

**Alternative simpler approach:** Just wrap existing odds sections in a conditional:

```tsx
// Simple: only show odds for TIMED/SCHEDULED
{["TIMED", "SCHEDULED"].includes(match.status) && match.odds && (
  // ... existing odds sections
)}
```

> **Recommendation:** Use the simpler approach. FINISHED matches can show score instead of odds. POSTPONED/CANCELLED/IN_PLAY show info banner. Clean and clear.

**New styles:**
```typescript
infoBanner: {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: "#FFFBEB",
  borderRadius: 10,
  paddingHorizontal: 14,
  paddingVertical: 10,
  gap: 8,
  marginBottom: 16,
},
infoBannerText: {
  flex: 1,
  fontSize: 13,
  color: "#92400E",
  fontWeight: "500",
},
```

### [MODIFY] `supabase/schema.sql` — Add CANCELLED refund to settle_match_bets

**Extend `settle_match_bets` or create new function:**

Option A: Extend existing `settle_match_bets`:
```sql
-- In settle_match_bets, add at the beginning:
-- Handle CANCELLED matches → refund all PENDING bets
IF v_match.status = 'CANCELLED' THEN
  FOR v_bet IN SELECT * FROM bets WHERE match_id = p_match_id AND status = 'PENDING'
  LOOP
    UPDATE bets SET status = 'CANCELLED' WHERE id = v_bet.id;
    UPDATE users SET balance = balance + v_bet.amount WHERE id = v_bet.user_id;
    v_bets_lost := v_bets_lost + 1; -- count as processed
    v_total_winnings := v_total_winnings + v_bet.amount; -- refunded amount
  END LOOP;
  UPDATE matches SET is_settled = true WHERE id = p_match_id;
  RETURN jsonb_build_object(...);
END IF;
```

Option B: Separate `refund_cancelled_match(p_match_id UUID)` function.

**Recommendation:** Option A — extend `settle_match_bets` to also handle CANCELLED status. The function name still works ("settle" = resolve any match).

**Changes to settle_match_bets:**
1. Change WHERE clause: `WHERE id = p_match_id AND status IN ('FINISHED', 'CANCELLED') AND is_settled = false`
2. Add early branch for CANCELLED: refund instead of check win/loss
3. New bet status: 'CANCELLED' (or reuse special handling)

Wait — `bets.status` is VARCHAR, no enum constraint. So we can set it to 'CANCELLED' for refunded bets. But the frontend filter tabs only handle ALL/PENDING/WON/LOST. Need to handle CANCELLED in UI too.

**Actually, for simplicity:** Mark refunded bets as 'LOST' with `winnings = amount` (full refund) and credit balance. This way existing UI works without changes. But this is semantically wrong.

**Better approach for student project:** Just add 'CANCELLED' as a filter option, or let CANCELLED bets show under "All" tab. The BetCard already handles unknown status with fallback styling.

### [MODIFY] `supabase/functions/sync-matches/index.ts`

**In the settlement hook (step 8), also handle CANCELLED matches:**

Change the query from:
```typescript
.eq("status", "FINISHED")
.eq("is_settled", false);
```
To:
```typescript
.in("status", ["FINISHED", "CANCELLED"])
.eq("is_settled", false);
```

### [MODIFY] `supabase/functions/settle-bets/index.ts`

Same query change as sync-matches.

## Todo List

- [ ] Hide odds sections for non-TIMED/SCHEDULED matches
- [ ] Show info banner for POSTPONED/CANCELLED/IN_PLAY
- [ ] Extend `settle_match_bets` to handle CANCELLED (refund)
- [ ] Update settle Edge Functions queries to include CANCELLED
- [ ] Test: POSTPONED match → no odds shown
- [ ] Test: CANCELLED match with PENDING bets → refund on settle

## Success Criteria

- POSTPONED match detail → "Hoãn" banner, no odds (BR-F03)
- CANCELLED match detail → "Huỷ" banner, no odds
- IN_PLAY match → "Đang đá" banner, no odds
- TIMED/SCHEDULED → odds shown, betting available
- CANCELLED + PENDING bets → settle refunds and credits balance (BR-F04)
