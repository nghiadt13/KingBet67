# Phase 4: S-07 Bet History Screen

## Context

- [Wireframe S-07](file:///d:/works/vsc_test/docs/03_wireframe/S-07_bet_history.md)
- [API Contract: Bet History](file:///d:/works/vsc_test/docs/08_API_CONTRACT.md#L120-L146)
- [UI Design System](file:///d:/works/vsc_test/docs/10_UI_DESIGN_SYSTEM.md)
- [Business Rules: Betting](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L33-L44)
- [Business Rules: Profile Stats](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L119-L125)
- [Existing history.tsx placeholder](file:///d:/works/vsc_test/app/(user-tabs)/history.tsx)

## Overview

- **Priority:** P1
- **Status:** Pending
- **Effort:** ~2h

Replace placeholder → full bet history screen with filter tabs and bet cards.

## UI Structure (from wireframe)

```
┌─────────────────────────────────┐
│  📋 Lịch sử cược               │  ← Tab header
├─────────────────────────────────┤
│ All │ Pending │ Won │ Lost      │  ← Filter tabs
├─────────────────────────────────┤
│                                 │
│  ┌──────────────────────────┐  │
│  │ ⚽ Arsenal vs Chelsea     │  │
│  │ 1X2: Home Win    @1.45   │  │  ← bet_type + bet_choice + odds
│  │ 100,000 → +145,000       │  │  ← amount → winnings (if WON)
│  │ ✅ WON           21/03   │  │  ← status + date
│  └──────────────────────────┘  │
│                                 │
│  ┌──────────────────────────┐  │
│  │ ⚽ Fulham vs Burnley      │  │
│  │ BTTS: Yes         @1.70  │  │
│  │ 80,000                    │  │  ← amount only (PENDING)
│  │ ⏳ PENDING        22/03   │  │
│  └──────────────────────────┘  │
│                                 │
│  ... (scroll)                   │
├─────────────────────────────────┤
│ Tab bar                         │
└─────────────────────────────────┘
```

## Files

### [NEW] `components/bet-card.tsx`

```typescript
interface BetCardProps {
  bet: BetWithMatch;
}
```

**Layout:**

```
┌────────────────────────────────────┐
│ [crest] [crest] Arsenal vs Chelsea │  ← crests + match label
├────────────────────────────────────┤
│ 1X2: Home Win              @1.45  │  ← bet type label + choice + odds
│ 💰 100,000  →  +145,000          │  ← amount + winnings (if WON)
├────────────────────────────────────┤
│ ✅ WON                    21/03  │  ← status badge + date
└────────────────────────────────────┘
```

**Status colors:**
- PENDING: `#F59E0B` (amber) + `⏳`-like icon → `clock-outline`
- WON: `#16A34A` (green) + `check-circle-outline`
- LOST: `#DC2626` (red) + `close-circle-outline`

**Bet type labels** (human-readable mapping):

```typescript
const BET_TYPE_LABELS: Record<BetType, string> = {
  match_result: "1X2",
  over_under: "Tài/Xỉu",
  btts: "BTTS",
  half_time: "Hiệp 1",
  correct_score: "Tỉ số",
};

const BET_CHOICE_LABELS: Record<string, string> = {
  home: "Home Win",
  draw: "Draw",
  away: "Away Win",
  over: "Tài (>2.5)",
  under: "Xỉu (<2.5)",
  yes: "Có",
  no: "Không",
  // correct_score choices like "1-0" display as-is
};
```

**Amount display:**
- PENDING: `"💰 {amount.toLocaleString()}"` (chỉ số tiền đặt)
- WON: `"💰 {amount.toLocaleString()} → +{winnings.toLocaleString()}"` (green winnings)
- LOST: `"💰 -{amount.toLocaleString()}"` (red, struck-through effect)

> Wait — wireframe dùng emoji nhưng AGENTS.md nói **không dùng emoji làm icons**. Dùng `MaterialCommunityIcons` thay:
> - `cash` icon thay 💰 → hoặc đơn giản chỉ hiện text, không cần icon prefix cho amount

### [MODIFY] `app/(user-tabs)/history.tsx`

Replace placeholder → full bet history screen.

**Key elements:**

1. **Filter tabs** (same pattern as Match List filters):
   - "Tất cả" | "Pending" | "Thắng" | "Thua"
   - `betStore.setHistoryFilter(filter)`

2. **Bet list** — `FlatList`:
   - Data: `betStore.bets` filtered by `historyFilter`
   - `keyExtractor: (item) => item.id`
   - `renderItem: ({ item }) => <BetCard bet={item} />`
   - Pull-to-refresh
   - Empty state: "Chưa có cược nào"

3. **Data source:**
```typescript
const { bets, isLoadingBets, historyFilter, fetchBetHistory, setHistoryFilter } = useBetStore();

useEffect(() => {
  fetchBetHistory();
}, []);
```

4. **Client-side filtering** (same approach as match list — all bets loaded):
```typescript
const filteredBets = useMemo(() => {
  if (historyFilter === "ALL") return bets;
  return bets.filter((b) => b.status === historyFilter);
}, [bets, historyFilter]);
```

### [UPDATE] `stores/betStore.ts`

Add `fetchBetHistory` implementation:

```typescript
fetchBetHistory: async () => {
  set({ isLoadingBets: true });
  
  const userId = useAuthStore.getState().user?.id;
  if (!userId) { set({ isLoadingBets: false }); return; }

  const { data, error } = await supabase
    .from("bets")
    .select(`
      *,
      match:matches (
        id, matchday, utc_date, status, home_score, away_score,
        home_team:teams!home_team_id (name, short_name, crest_url),
        away_team:teams!away_team_id (name, short_name, crest_url)
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    set({ error: error.message, isLoadingBets: false });
    return;
  }

  set({ bets: (data as unknown as BetWithMatch[]) ?? [], isLoadingBets: false });
}
```

## Bet Type/Choice Label Mapping

Full mapping for display purposes:

| bet_type | bet_choice | Display |
|----------|------------|---------|
| match_result | home | "1X2: Home Win" |
| match_result | draw | "1X2: Draw" |
| match_result | away | "1X2: Away Win" |
| over_under | over | "Tài/Xỉu: Tài (>2.5)" |
| over_under | under | "Tài/Xỉu: Xỉu (<2.5)" |
| btts | yes | "BTTS: Có" |
| btts | no | "BTTS: Không" |
| half_time | home | "Hiệp 1: Home Win" |
| half_time | draw | "Hiệp 1: Draw" |
| half_time | away | "Hiệp 1: Away Win" |
| correct_score | "1-0" | "Tỉ số: 1-0" |
| correct_score | "2-1" | "Tỉ số: 2-1" |

> **Note:** For 1X2 types, ideally replace "Home Win" with actual team name. But bet card shows match label separately, so generic labels are acceptable.

## Todo List

- [ ] Create `components/bet-card.tsx` (match info + bet details + status)
- [ ] Replace `history.tsx` placeholder → full screen
- [ ] Filter tabs (All / Pending / Won / Lost)
- [ ] FlatList with bet cards
- [ ] Implement `fetchBetHistory` in `betStore`
- [ ] Client-side filtering by status
- [ ] Status badges with colors (pending=amber, won=green, lost=red)
- [ ] Bet type/choice label mapping
- [ ] Amount + winnings display
- [ ] Date formatting (dd/MM)
- [ ] Team crests in bet card
- [ ] Empty state
- [ ] Pull-to-refresh
- [ ] Loading state

## Success Criteria

- Bet History shows all placed bets, newest first
- Filter tabs work (All/Pending/Won/Lost)
- Each bet card shows: match, bet type, choice, odds, amount, winnings, status, date
- Status badges colored correctly
- Pull-to-refresh refetches bets
- Empty state when no bets
- After placing a new bet → navigate to History → bet appears
