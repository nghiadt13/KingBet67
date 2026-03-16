---
title: "Phase 9: Polish — Error Handling, Edge Cases, Demo Ready"
description: "Final polish: error handling, edge cases (POSTPONED/CANCELLED), UX consistency, demo flow."
status: not-started
priority: P1
effort: 3h
tags: [frontend, polish, edge-cases, ux]
created: 2026-03-15
---

# Phase 9: Polish

## Overview

Final pass trước khi demo. Fix những gì đang thiếu, harden edge cases, đảm bảo UX mượt.

## Audit: What's Done vs What's Missing

> ⚠️ Tất cả items chưa bắt đầu — cần build frontend trước (Phase 1-8).

| Item | Status | Detail |
|------|--------|--------|
| Loading states (spinner) | ⏳ Pending | Cần implement sau khi có screens |
| Empty states | ⏳ Pending | Cần implement sau khi có screens |
| Pull-to-refresh | ⏳ Pending | Cần implement sau khi có screens |
| User banned check on open | ⏳ Pending | Cần auth flow (Phase 2) |
| POSTPONED → hide odds | ⏳ Pending | Cần match detail (Phase 4) |
| CANCELLED → refund bets | ✅ Done | `settle_match_bets` RPC đã handle CANCELLED |
| Error handling (network) | ⏳ Pending | Cần implement sau khi có screens |
| Full demo flow test | ⏳ Manual | Not automatable |

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Edge Cases (POSTPONED/CANCELLED) | Not Started ⏳ | 1h | [phase-01](./phase-01-edge-cases.md) |
| 2 | Error Handling & UX Polish | Not Started ⏳ | 1.5h | [phase-02](./phase-02-error-handling.md) |
| 3 | Demo Flow Verification | Not Started ⏳ | 0.5h | [phase-03](./phase-03-demo-verify.md) |

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| CANCELLED refund as settlement variant | Add CANCELLED handling to settle_match_bets or a simple RPC. Rare in PL — lightweight approach |
| Hide odds for non-bettable matches | UI guard in addition to server-side check. Better UX than showing odds then error |
| `useFocusEffect` on Home | Same pattern as all other tabs — consistency |
| Minimal error toast, not full error boundary | Student project — keep it simple. Console.warn + in-screen error state |

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| CANCELLED refund over-engineering | Low | PL rarely cancels. Simple refund RPC only if CANCELLED matches have PENDING bets |
| Breaking existing screens | Medium | Changes are additive (conditionals, error states) — no logic rewrites |
| Demo flow edge case | Low | Manual test covers happy + unhappy paths |
