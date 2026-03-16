# Phase 3: S-04 Match Detail + Odds Display

## Context

- [Wireframe S-04](file:///d:/works/vsc_test/docs/03_wireframe/S-04_match_detail.md)
- [UI Design System: Card](file:///d:/works/vsc_test/docs/10_UI_DESIGN_SYSTEM.md#L168-L174)
- [Business Rules: Bet Types](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L47-L72)
- [Business Rules: Odds](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L75-L84)
- [DB Schema: odds JSONB](file:///d:/works/vsc_test/docs/09_DB_SCHEMA.md#L78-L91)
- [Existing match/[id].tsx](file:///d:/works/vsc_test/app/match/[id].tsx)

## Overview

- **Priority:** P1
- **Status:** Pending
- **Effort:** ~1.5h

Match detail screen hiển thị team info, scores, trạng thái, và 5 nhóm kèo.

## UI Structure (from wireframe)

```
┌─────────────────────────────────┐
│  ← Back              Match Info │  ← Stack header (auto from _layout)
├─────────────────────────────────┤
│                                 │
│   [crest] Arsenal  [crest] CHE  │  ← Team crests + names
│   Hạng 1              Hạng 5   │  ← Position from teams
│                                 │
│          2    -    1            │  ← Score (or "vs")
│         HT: 1 - 0              │  ← Half-time (if available)
│                                 │
│   [StatusBadge]     [DateTime]  │
│                                 │
├─────────── ODDS ────────────────┤  ← Only if TIMED/SCHEDULED
│                                 │
│  Kết quả trận (1X2)            │
│  [Home 1.45] [Draw 3.20] [Away]│
│                                 │
│  Tài / Xỉu 2.5                │
│  [Tài 1.85]    [Xỉu 1.95]    │
│                                 │
│  Cả 2 ghi bàn (BTTS)          │
│  [Yes 1.70]    [No 2.10]      │
│                                 │
│  Hiệp 1 (1X2)                 │
│  [Home 2.10] [Draw 2.20] [Away]│
│                                 │
│  Tỉ số chính xác              │
│  [1-0 6.50] [2-1 7.00] [0-0]  │
│  [0-1 7.50] [1-1 5.50] [2-0]  │
│  [▼ Xem thêm tỉ số]           │
│                                 │
└─────────────────────────────────┘
```

## Files

### [NEW] `components/odds-section.tsx`

Hiển thị 1 nhóm kèo (1 section).

```typescript
interface OddsSectionProps {
  title: string;
  odds: Record<string, number>;
  labels?: Record<string, string>; // Custom labels (e.g. "home" → "Arsenal")
  columns?: 2 | 3; // layout: 2 for O/U + BTTS, 3 for 1X2
  onSelectOdd?: (choice: string, odds: number) => void; // Phase 5 hook
}
```

**Design:**
- Section title: 13px, uppercase, `#94A3B8`, letterSpacing 0.5
- Odds buttons: card-style, radius 12
  - Choice label: 13px, `#64748B`
  - Odds value: 18px, weight 700, `#1E293B`
  - Background: `#F8FAFC`, border: 1px `#E2E8F0`
- Layout: `flexDirection: "row"`, `flexWrap: "wrap"`, gap 8
- Each button: flex basis `30%` (3-col) or `48%` (2-col)

> **Phase 5 hook:** `onSelectOdd` callback sẽ mở Place Bet bottom sheet. Phase 4 chỉ render, chưa implement betting.

### [NEW] `components/correct-score-grid.tsx`

Grid cho tỉ số chính xác với "Xem thêm".

```typescript
interface CorrectScoreGridProps {
  scores: Record<string, number>; // { "1-0": 6.50, ... }
  defaultShowCount?: number; // default 6
  onSelectScore?: (score: string, odds: number) => void;
}
```

- Mặc định hiện 6 ô đầu, nút "Xem thêm" expand ra full 24

### [MODIFY] `app/match/[id].tsx`

Replace placeholder → full Match Detail screen.

**Key sections:**
1. **Match Header** — team crests, names, positions
2. **Score Display** — fullTime score + halfTime (conditional)
3. **Status + DateTime**
4. **Odds Sections** (conditional: chỉ hiện khi TIMED/SCHEDULED)
   - 1X2: `<OddsSection title="..." odds={match.odds.match_result} columns={3} />`
   - O/U: `<OddsSection ... columns={2} />`
   - BTTS: `<OddsSection ... columns={2} />`
   - HT 1X2: `<OddsSection ... columns={3} />`
   - Correct Score: `<CorrectScoreGrid scores={match.odds.correct_score} />`

**Data flow:**
```typescript
const { id } = useLocalSearchParams<{ id: string }>();
const { selectedMatch, isLoadingDetail, fetchMatchDetail } = useMatchStore();

useEffect(() => {
  if (id) fetchMatchDetail(id);
}, [id]);
```

**Conditional rendering:**
- `match.status IN ('TIMED', 'SCHEDULED')` → show odds sections
- Otherwise → hide odds, show only scores + status (BR-C01, BR-C02)
- Score: show `home_score - away_score` if not null, else "vs"
- Half-time: show `HT: X - Y` if `half_time_home` is not null

**Custom labels for 1X2:**
```typescript
labels={{
  home: match.home_team.short_name,  // "Arsenal" instead of "Home"
  draw: "Hòa",
  away: match.away_team.short_name,
}}
```

## Todo List

- [ ] Create `components/odds-section.tsx`
- [ ] Create `components/correct-score-grid.tsx`
- [ ] Implement match header (crests, names, positions)
- [ ] Implement score display (fullTime + halfTime)
- [ ] Implement status + date/time
- [ ] Implement 5 odds sections (conditional on status)
- [ ] "Xem thêm" expand for correct scores
- [ ] ScrollView for scrollable content
- [ ] Loading state
- [ ] `useEffect` fetch match detail on mount

## Success Criteria

- Match detail hiển thị team info + scores đúng
- Odds sections hiển thị đúng 5 nhóm kèo
- Correct score mặc định 6, expand ra 24
- Odds sections ẩn khi match không phải TIMED/SCHEDULED
- Crests hiển thị đúng
- Score "vs" khi chưa đá, số khi FINISHED/IN_PLAY
- Loading spinner khi fetching
- Các odds buttons chưa cần functional (Phase 5)
