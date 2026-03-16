---
title: "Phase 5: Betting — Place Bet, Deposit, Bet History"
description: "Đặt cược (bottom sheet), nạp tiền, lịch sử cược. RPC place_bet + deposit."
status: partial
priority: P1
effort: 6h
tags: [frontend, backend, rpc, betting]
created: 2026-03-15
---

# Phase 5: Betting

## Overview

Implement full betting flow:

1. **SQL:** RPC `place_bet` + `deposit` (atomic transactions)
2. **S-05:** Place Bet bottom sheet (từ Match Detail)
3. **S-09:** Deposit section (thêm vào Profile)
4. **S-07:** Bet History (replace placeholder)

## Phases

| #   | Phase                                     | Status  | Effort | Link                                    |
| --- | ----------------------------------------- | ------- | ------ | --------------------------------------- |
| 1   | SQL: RPC functions (place_bet + deposit)  | Completed ✅ | 0.5h   | [phase-01](./phase-01-rpc-functions.md) |
| 2   | Bet Store + Place Bet Bottom Sheet (S-05) | Not Started ⏳ | 2.5h   | [phase-02](./phase-02-place-bet.md)     |
| 3   | Deposit (S-09 Profile)                    | Not Started ⏳ | 1h     | [phase-03](./phase-03-deposit.md)       |
| 4   | Bet History Screen (S-07)                 | Not Started ⏳ | 2h     | [phase-04](./phase-04-bet-history.md)   |

## Dependencies

- Phase 1 (Foundation) ✅ — bets table exists
- Phase 2 (Auth) ✅ — users table, auth flow
- Phase 3 (Data Sync) ✅ — matches with odds in DB
- Phase 4 (Match Screens) ✅ — Match Detail with odds buttons

## Key Decisions

| Decision                                 | Rationale                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `place_bet` as RPC (SECURITY DEFINER)    | Atomic: check balance + insert bet + deduct balance in 1 transaction. Cannot do this safely from client-side |
| `deposit` as RPC                         | Atomic: update balance. Match existing pattern                                                               |
| Bottom sheet via `@gorhom/bottom-sheet`  | De-facto standard for RN bottom sheets. Already Expo-compatible                                              |
| `betStore.ts` separate from `matchStore` | Different concern — bet history, place bet state, deposit state                                              |
| Error mapping in frontend                | RPC RAISE EXCEPTION returns error codes → map to Vietnamese messages                                         |
| Refresh user balance after bet/deposit   | Update `authStore.user.balance` locally + refetch for consistency                                            |

## Risks (Red-Team Review)

| Risk | Impact | Mitigation |
| --- | --- | --- |
| **RPC not deployed yet** — `place_bet` + `deposit` not in `schema.sql` | Blocker | Phase 1: add SQL to schema.sql + run on Supabase Dashboard |
| **GestureHandlerRootView missing** — `@gorhom/bottom-sheet` v5 requires wrapper | Blocker | Add `GestureHandlerRootView` in `app/_layout.tsx` around Stack |
| **`@gorhom/bottom-sheet`** — peer deps gesture-handler + reanimated | Low | Already installed (2.28.0 + 4.1.6) |
| **Balance stale after bet** — authStore.user.balance not updated | Medium | `refreshBalance()` after successful bet + deposit |
| **RPC type mismatch** — `place_bet` not in Database.Functions type | Low | Add to `types/database.ts` Functions section |
| **Admin betting guard** — BR-K02: admin cannot bet | Medium | Frontend: disable odds buttons. RPC has no admin check (ok for student project) |
| **Bet history stale** — history tab won't show new bet until refetch | Medium | `useFocusEffect` on history screen to refetch on tab focus |
| **API Contract doc** — shows MATCH_RESULT (uppercase) but DB uses match_result (lowercase) | Low | Code uses lowercase (correct). Doc inconsistency is cosmetic |

