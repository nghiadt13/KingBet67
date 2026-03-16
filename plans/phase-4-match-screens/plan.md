---
title: "Phase 4: Match Screens — S-03, S-04, S-06"
description: "Hiển thị trận đấu, chi tiết + odds, bảng xếp hạng. Replace 3 placeholder screens."
status: completed
priority: P1
effort: 5h
tags: [frontend, screens, ui]
created: 2026-03-15
---

# Phase 4: Match Screens

## Overview

Replace 3 placeholder screens bằng UI thật:
1. **S-03: Match List** (Home tab) — filter tabs, matchday selector, match cards
2. **S-04: Match Detail** — team info, scores, 5 nhóm odds
3. **S-06: Standings** — bảng xếp hạng 20 đội PL

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Data Layer (store + types) | Completed ✅ | 1h | [phase-01](./phase-01-data-layer.md) |
| 2 | S-03: Match List + Match Card | Completed ✅ | 2h | [phase-02](./phase-02-match-list.md) |
| 3 | S-04: Match Detail + Odds | Completed ✅ | 1.5h | [phase-03](./phase-03-match-detail.md) |
| 4 | S-06: Standings Table | Completed ✅ | 0.5h | [phase-04](./phase-04-standings.md) |

## Dependencies

- Phase 1 (Foundation) ✅ — tables, navigation skeleton
- Phase 3 (Data Sync) ✅ — DB có 20 teams + 380 matches + odds
- `types/database.ts` — Team, Match, MatchOdds types đã có

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Zustand store `matchStore.ts` | Consistent với `authStore.ts`, share data giữa screens |
| Separate components (match-card, odds-section, status-badge) | Reusable, DRY, testable |
| Inline styles per file | Follow existing pattern (profile.tsx), no shared stylesheet file |
| `Image` for crest_url | Team logos từ football-data.org CDN |
| date-fns for formatting | Đã cài (Phase 1 dependencies) |

## Risks (Red-Team Review)

| Risk | Impact | Mitigation |
|------|--------|------------|
| **SVG crests** — football-data.org trả về `.svg` URLs, RN Image không hỗ trợ SVG native | High | Transform URL `.svg` → `.png` (cả hai đều available trên CDN) |
| **currentMatchday init** — không biết matchday nào để hiển thị khi mở app | Medium | Query DB: `MIN(matchday) WHERE status IN ('TIMED', 'SCHEDULED')` = matchday sắp tới |
| **date-fns locale** — hiển thị ngày tiếng Việt | Low | Import `vi` locale từ date-fns |
