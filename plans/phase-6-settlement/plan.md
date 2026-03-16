---
title: "Phase 6: Settlement — Auto/Manual Settle Bets"
description: "Edge Function settle-bets + hook vào sync-matches. Xử lý kết quả bet khi trận kết thúc."
status: partial
priority: P1
effort: 3h
tags: [backend, edge-function, settlement]
created: 2026-03-15
---

# Phase 6: Settlement

## Overview

Khi trận chuyển sang FINISHED, cần so sánh bet_choice vs kết quả thật → WON/LOST → cộng tiền thắng.

1. **Edge Function `settle-bets`** — standalone function xử lý settlement
2. **Hook vào `sync-matches`** — sau khi sync xong, tự gọi settle
3. **Test script** — verify settlement logic locally

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Edge Function `settle-bets` | Completed ✅ | 1.5h | [phase-01](./phase-01-settle-function.md) |
| 2 | Hook settle vào `sync-matches` | Completed ✅ | 0.5h | [phase-02](./phase-02-hook-sync.md) |
| 3 | Test script + verify | Not Started ⏳ | 1h | [phase-03](./phase-03-test-verify.md) |

## Dependencies

- Phase 1 (Foundation) ✅ — bets table, is_settled column
- Phase 3 (Data Sync) ✅ — sync-matches Edge Function
- Phase 5 (Betting) ✅ — place_bet RPC, bets exist in DB

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Edge Function (not RPC) | Settlement runs on server-side with service_role key — bypasses RLS, can update any user's balance |
| Separate `settle-bets` function | Reusable: called by sync-matches auto AND admin manual "Settle Now" |
| Per-match transaction | Each match settled independently — if 1 fails, others still proceed. Per-match is atomic (BR-G05/G06) |
| `is_settled` flag on matches | Prevents double settlement (BR-G02). Set after all bets for that match are processed |
| Winnings = ROUND(amount × odds) | BIGINT arithmetic, no decimals. Match BR-B05 |

## Risks (Red-Team Review)

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Double settlement** — race condition if settle called twice concurrently | High | `is_settled = false` filter + set `is_settled = true` immediately per match before processing bets. Alternative: use `FOR UPDATE` lock |
| **Partial failure** — bet updates succeed but match flag fails | Medium | Process bets first → then set is_settled. If is_settled fails, next run will re-process but idempotent (bet already WON/LOST, skip) |
| **Half-time score NULL** — half_time_home/away might be NULL for some matches | Medium | If NULL and bet_type is half_time → mark LOST (conservative). Or skip settlement for that bet type |
| **Correct score bet_choice format** — "1-0" vs "1 - 0" vs "1:0" | Low | Standardize on "home-away" format (e.g. "1-0"). Sync stores this format, place_bet stores same |
| **Edge Function cold start** — settle logic added to sync-matches increases execution time | Low | Settlement only runs for FINISHED+unsettled matches (usually few). Acceptable |
