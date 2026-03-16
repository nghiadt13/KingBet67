# Phase 4: S-06 Standings Table

## Context

- [Wireframe S-06](file:///d:/works/vsc_test/docs/03_wireframe/S-06_standings.md)
- [API Contract: Standings](file:///d:/works/vsc_test/docs/08_API_CONTRACT.md#L109-L116)
- [Existing standings placeholder](file:///d:/works/vsc_test/app/(user-tabs)/standings.tsx)

## Overview

- **Priority:** P2
- **Status:** Pending
- **Effort:** ~30min

Screen đơn giản nhất: bảng xếp hạng 20 đội PL.

## UI Structure (from wireframe)

```
┌─────────────────────────────────┐
│  🏆 Premier League 2025/26     │  ← Tab header
├─────────────────────────────────┤
│  #  Logo  Đội        P  GD Pts │  ← Column headers (sticky)
│ ─────────────────────────────── │
│  1  [img] Arsenal    31 +39  70│  ← FlatList rows
│  2  [img] Man City   30 +32  61│
│  3  [img] Man United 29 +11  51│
│  ...                            │
│ 20  [img] Wolves     30 -30  16│
├─────────────────────────────────┤
│ Tab bar                         │
└─────────────────────────────────┘
```

## Files

### [MODIFY] `app/(user-tabs)/standings.tsx`

Replace placeholder → full standings table.

**Implementation:**

```typescript
const { teams, isLoadingTeams, fetchStandings } = useMatchStore();

useEffect(() => {
  fetchStandings();
}, []);
```

**Row layout:**
```
[position] [crest 24x24] [team name ...flex] [P] [GD] [Pts]
```

- Use `FlatList` for 20 rows
- Sticky header row with column labels
- Team name: `short_name` (truncate if needed)
- Position colors: 1-4 green tint (CL), 5-6 blue tint (EL), 18-20 red tint (relegation)
- GD: show `+` prefix for positive, already negative for negative
- Pts: weight 700

**Design tokens:**
- Header row: `#F1F5F9` bg, text 11px uppercase `#94A3B8`
- Data row: white card style, 48px height
- Alternating rows: subtle `#F8FAFC` / `#FFFFFF`
- Position badges:
  - Top 4: `#DCFCE7` bg (CL spots)
  - 5-6: `#DBEAFE` bg (EL spots)
  - 18-20: `#FEE2E2` bg (relegation)
  - Rest: transparent

## Todo List

- [ ] Replace standings.tsx placeholder
- [ ] Column header row (sticky)
- [ ] Team row with crest, name, stats
- [ ] Position color coding (CL/EL/relegation)
- [ ] Loading state
- [ ] `useEffect` fetch on mount

## Success Criteria

- 20 teams displayed in order
- Crests load correctly
- Stats (P, GD, Pts) accurate
- Position color coding visible
- Scrollable if needed
- Loading spinner while fetching
