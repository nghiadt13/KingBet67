---
title: "Phase 8: Admin — Dashboard, User Management, System Controls"
description: "3 admin screens: dashboard stats, user ban/unban, sync/settle controls."
status: partial
priority: P1
effort: 5h
tags: [frontend, backend, admin, rpc]
created: 2026-03-15
---

# Phase 8: Admin

## Overview

3 admin screens — all replacing existing placeholders:
1. **SQL:** Deploy RPC `get_admin_stats`
2. **S-A01:** Admin Dashboard (stats cards, hottest match, top 5 users)
3. **S-A02:** User Management (list, search, ban/unban)
4. **S-A03:** System Controls (Sync Now, Settle Now)

## Pre-existing Infrastructure

| Item | Status |
|------|--------|
| Admin tab layout (`(admin-tabs)/_layout.tsx`) | ⏳ Not built — needs Phase 1 Tab Navigation |
| Role-based routing (`_layout.tsx`) | ⏳ Not built — needs Phase 2 Auth Guard |
| `is_admin()` SQL function | ✅ Done |
| RLS admin read all users | ✅ Done — `auth.uid() = id OR is_admin()` |
| RLS admin update users (ban) | ✅ Done — same policy |
| Placeholder screens (3) | ⏳ Not built |

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | SQL: get_admin_stats RPC | Completed ✅ | 0.5h | [phase-01](./phase-01-admin-stats-rpc.md) |
| 2 | S-A01: Admin Dashboard | Not Started ⏳ | 1.5h | [phase-02](./phase-02-dashboard.md) |
| 3 | S-A02: User Management | Not Started ⏳ | 2h | [phase-03](./phase-03-user-management.md) |
| 4 | S-A03: System Controls | Not Started ⏳ | 1h | [phase-04](./phase-04-system-controls.md) |

## Dependencies

- Phase 2 (Auth) ✅ — admin user exists, role routing works
- Phase 3 (Data Sync) ✅ — sync-matches Edge Function
- Phase 6 (Settlement) ✅ — settle-bets Edge Function
- Phase 7 (User Features) ✅ — RLS policies on all tables

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| `get_admin_stats` as RPC with `is_admin()` guard | Server-side admin check, not just frontend |
| Ban/unban via direct `UPDATE users` | RLS already restricts UPDATE to admin. Simple and matches API Contract |
| Supabase Functions URL for sync/settle | Admin calls Edge Functions directly via `supabase.functions.invoke()` |
| Search via `.or(ilike)` | Matches API Contract. Client-side search also acceptable for small user count |
| No admin store | Admin screens are independent, local state sufficient. No Zustand needed |

## Risks (Red-Team Review)

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Admin reads all users** — RLS policy `auth.uid() = id OR is_admin()` | Low | Already in place. Verified in Phase 7 |
| **Ban self** — BR-K01 forbids admin banning themselves | Medium | Frontend check: disable ban button when `user.id === currentAdmin.id` |
| **Edge Function auth** — sync/settle need auth header | Medium | Use `supabase.functions.invoke()` which auto-attaches auth token. Edge Functions use `service_role` key internally |
| **Hottest match NULL** — no bets yet = hottest_match is NULL | Low | Handle in UI: "Chưa có dữ liệu" |
| **Large user list** — future: could have 100+ users | Low | Acceptable for student project. Add limit 100 if needed |
