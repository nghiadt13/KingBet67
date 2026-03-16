# Phase 2: S-03 Match List (Home Tab)

## Context

- [Wireframe S-03](file:///d:/works/vsc_test/docs/03_wireframe/S-03_match_list.md)
- [UI Design System](file:///d:/works/vsc_test/docs/10_UI_DESIGN_SYSTEM.md)
- [Business Rules: Matches](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L88-L95)
- [Existing Home placeholder](file:///d:/works/vsc_test/app/(user-tabs)/index.tsx)

## Overview

- **Priority:** P1
- **Status:** Pending
- **Effort:** ~2h

Screen phức tạp nhất trong Phase 4: header, filter tabs, matchday selector, match cards list.

## UI Structure (from wireframe)

```
┌─────────────────────────────────┐
│  ⚽ BetKing          Matchday 31│  ← Header (custom, not tab header)
├─────────────────────────────────┤
│ Đang đá │ Sắp đá │ Kết thúc    │  ← Filter tabs (horizontal scroll)
├─────────────────────────────────┤
│ ◀ MD 30 │ Matchday 31 │ MD 32 ▶│  ← Matchday selector
├─────────────────────────────────┤
│  [MatchCard] × N                │  ← FlatList
│  ... (scroll)                   │
├─────────────────────────────────┤
│ Tab bar                         │
└─────────────────────────────────┘
```

## Files

### [NEW] `components/status-badge.tsx`

Status badge cho match cards.

```typescript
// Props: status: MatchStatus
// Visual map:
//   IN_PLAY → 🔴 "LIVE" (red dot + text, animated pulse)
//   TIMED/SCHEDULED → "21/03 20:00" (utc_date formatted)
//   FINISHED → "FT" (muted)
//   PAUSED → "HT" (half-time break)
//   POSTPONED → "PPD" (muted, warning)
//   CANCELLED → "CAN" (muted, error)
```

Design tokens:
- LIVE: `#DC2626` text, pulsing dot
- TIMED: `#3B82F6` text
- FINISHED: `#64748B` text
- PPD/CAN: `#94A3B8` text

### [NEW] `components/match-card.tsx`

Reusable card hiển thị 1 trận.

```typescript
interface MatchCardProps {
  match: MatchWithTeams;
  onPress: () => void;
}
```

**Layout:**

```
┌──────────────────────────────────┐
│ [StatusBadge]            [time]  │  ← status + matchday/time
│                                  │
│ [crest] Arsenal           2      │  ← home team + score
│ [crest] Chelsea           1      │  ← away team + score
│                                  │
│           or                     │
│ [crest] Fulham                   │  ← for TIMED: no score
│ [crest] Burnley          vs      │
└──────────────────────────────────┘
```

Design:
- Card pattern: white bg, radius 14, subtle shadow
- Team crest: `Image` component, 28×28, borderRadius 4
- Team name: 15px, weight 600, `#1E293B`
- Score: 20px, weight 700, `#1E293B` (hoặc `null` → "vs")
- `TouchableOpacity` → `router.push('/match/[id]')`

### [MODIFY] `app/(user-tabs)/index.tsx`

Replace placeholder → full Match List screen.

**Key elements:**
1. **Custom header** (hide tab header via `_layout.tsx` hoặc dùng `headerTitle`):
   - Logo badge (small) + "BetKing" + matchday number
2. **Filter tabs** — `ScrollView horizontal`:
   - "All" | "Đang đá" | "Sắp đá" | "Kết thúc"
   - Active: primary bg, white text; Inactive: transparent bg, muted text
   - `setStatusFilter()` on press
3. **Matchday selector** — `View` row with left/right arrows:
   - `◀` button, "Matchday {N}" center, `▶` button
   - `setMatchday(N-1)` / `setMatchday(N+1)`
   - Range: 1-38 (Premier League)
4. **Match list** — `FlatList`:
   - Data: filtered by `statusFilter`
   - Render: `<MatchCard>`
   - onPress: `router.push('/match/[match.id]')`
   - Empty state: "Không có trận nào" with soccer icon
5. **Loading** — `ActivityIndicator` center
6. **useEffect** — call `fetchMatches(currentMatchday)` on mount + matchday change

**Client-side filtering:**
- `statusFilter === "ALL"`: show all
- `statusFilter === "IN_PLAY"`: include `IN_PLAY` + `PAUSED`
- `statusFilter === "TIMED"`: include `TIMED` + `SCHEDULED`
- `statusFilter === "FINISHED"`: `FINISHED` only

> Filter on client side (not query) vì data per matchday is small (max 10 matches).

### [MODIFY] `app/(user-tabs)/_layout.tsx`

Update Home tab:
- `headerShown: false` cho `index` tab (custom header trong screen)
- Hoặc custom `headerTitle` component

## Todo List

- [ ] Create `components/status-badge.tsx`
- [ ] Create `components/match-card.tsx`
- [ ] Implement filter tabs (All / Đang đá / Sắp đá / KT)
- [ ] Implement matchday selector (◀ MD N ▶)
- [ ] Implement match list FlatList
- [ ] Loading state (ActivityIndicator)
- [ ] Empty state (no matches)
- [ ] Navigate to match detail on card press
- [ ] `useEffect` fetch on mount + matchday change

## Success Criteria

- Home tab hiển thị match cards thật (từ DB)
- Filter tabs hoạt động (client-side filter)
- Matchday selector chuyển matchday → refetch
- Tap card → navigate đến `/match/[id]`
- Loading spinner khi fetching
- Empty state khi không có matches
- Team crests hiển thị đúng (từ crest_url)
- Status badge đúng màu (LIVE = đỏ, TIMED = xanh, FT = xám)
