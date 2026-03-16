---
title: "Phase 7: User Features — Leaderboard, Profile Stats, RLS"
description: "RPC get_user_stats + get_leaderboard, S-08 Leaderboard, Profile stats, RLS policies."
status: completed
priority: P1
effort: 4h
tags: [frontend, backend, rpc, rls]
created: 2026-03-15
---

# Phase 7: User Features

## Overview

Hoàn thiện các tính năng user-facing:
1. **SQL:** Deploy RPC `get_user_stats` + `get_leaderboard` + RLS policies
2. **S-08:** Leaderboard screen (replace placeholder)
3. **S-09:** Profile stats section (enhance existing profile)

> **Lưu ý:** S-07 Bet History đã hoàn thành trong Phase 5 → skip.

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | SQL: RPCs + RLS policies | Completed ✅ | 0.5h | [phase-01](./phase-01-sql-rpc-rls.md) |
| 2 | S-08 Leaderboard | Completed ✅ | 2h | [phase-02](./phase-02-leaderboard.md) |
| 3 | S-09 Profile Stats | Completed ✅ | 1.5h | [phase-03](./phase-03-profile-stats.md) |

## Dependencies

- Phase 1 (Foundation) ✅ — tables exist
- Phase 2 (Auth) ✅ — users + auth
- Phase 5 (Betting) ✅ — bets exist, bet history done
- Phase 6 (Settlement) ✅ — bets have WON/LOST status, winnings populated

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Skip S-07 | Already implemented in Phase 5 |
| `get_leaderboard` RPC fixed | Docs SQL declares `v_my_rank` but never uses it. Add user's own rank to response for sticky footer |
| RLS enable + policies in one SQL block | Enable RLS without policies = lock out all access. Must create policies first |
| Client-side rank numbering | RPC returns array sorted by total. Rank = index + 1 |
| `useFocusEffect` for leaderboard | Same pattern as history — refresh on tab focus |

## Risks (Red-Team Review)

| Risk | Impact | Mitigation |
|------|--------|------------|
| **RLS enables without policies** — enabling RLS on bets/teams/matches breaks existing queries | Blocker | Add policies BEFORE enabling RLS, or in same SQL transaction |
| **get_leaderboard missing user rank** — `v_my_rank` declared but unused in docs SQL | Medium | Fix RPC: calculate user's rank and include in response |
| **get_leaderboard needs auth** — but docs SQL has no SECURITY DEFINER → needs auth.uid() for user rank | Medium | Add SECURITY DEFINER. Or make a separate RPC for own rank |
| **Empty leaderboard** — no WON bets yet → all zeros | Low | Handle in UI: "Chưa có dữ liệu" empty state |
| **Profile stats request on every render** — could be slow | Low | Fetch on mount + useFocusEffect, no caching needed for v1 |
