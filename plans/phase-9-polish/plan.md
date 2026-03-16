---
title: "Phase 9: Polish — Error Handling, Edge Cases, Demo Ready"
description: "Final polish: error handling, edge cases (POSTPONED/CANCELLED), UX consistency, demo flow."
status: completed
priority: P1
effort: 3h
tags: [frontend, polish, edge-cases, ux]
created: 2026-03-15
---

# Phase 9: Polish

## Overview

Final pass trước khi demo. Fix những gì đang thiếu, harden edge cases, đảm bảo UX mượt.

## Audit: What's Done vs What's Missing

| Item | Status | Detail |
|------|--------|--------|
| Loading states (spinner) | ✅ Done | All screens have ActivityIndicator |
| Empty states | ✅ Done | History, leaderboard, users, match list all have empty states |
| Pull-to-refresh | ✅ Done | Home, history, leaderboard, admin users |
| User banned check on open | ✅ Done | fetchUserProfile → signOut if is_banned (BR-A06) |
| POSTPONED badge | ✅ Done | StatusBadge shows "PPD" |
| CANCELLED badge | ✅ Done | StatusBadge shows "CAN" |
| **POSTPONED → hide odds** | ❌ Missing | Match detail shows odds for POSTPONED matches |
| **CANCELLED → refund bets** | ❌ Missing | No refund logic exists |
| **Error handling (network)** | 🔶 Partial | Some screens silently swallow API errors |
| **Home screen focus refresh** | ❌ Missing | Home uses `useEffect` not `useFocusEffect` |
| **Match detail betting guard** | 🔶 Partial | RPC blocks server-side, but UI still shows odds |
| Full demo flow test | ❌ Manual | Not automatable |

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Edge Cases (POSTPONED/CANCELLED) | Completed ✅ | 1h | [phase-01](./phase-01-edge-cases.md) |
| 2 | Error Handling & UX Polish | Completed ✅ | 1.5h | [phase-02](./phase-02-error-handling.md) |
| 3 | Demo Flow Verification | Pending (manual) | 0.5h | [phase-03](./phase-03-demo-verify.md) |

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
