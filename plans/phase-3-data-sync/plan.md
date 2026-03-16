---
title: "Phase 3: Data Sync — Edge Function sync-matches"
description: "Edge Function fetch data từ football-data.org, upsert teams/matches, tính odds, lưu DB"
status: completed
priority: P1
effort: 4h
tags: [backend, edge-function, data-sync, api]
created: 2026-03-15
---

# Phase 3: Data Sync

## Overview

Tạo Supabase Edge Function `sync-matches` để:
1. Fetch matches + standings từ football-data.org API
2. Upsert 20 teams (standings data) vào DB
3. Upsert matches (scores, status, matchday) vào DB
4. Tính odds cho 5 loại kèo dựa trên standings
5. Lưu odds vào `match.odds` (JSONB)
6. Setup cron tự động gọi mỗi 10 phút

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Edge Function Setup + Core Sync | Completed ✅ | 2h | [phase-01](./phase-01-edge-function-sync.md) |
| 2 | Odds Calculation Algorithm | Completed ✅ | 1h | [phase-02-odds-calculation](./phase-02-odds-calculation.md) |
| 3 | Deploy, Test, Cron | Completed ✅ | 1h | [phase-03-deploy-test-cron](./phase-03-deploy-test-cron.md) |

## Dependencies

- Phase 1 (Foundation) ✅ — Supabase project + tables đã tạo
- football-data.org API key (free tier, user cần đăng ký tại https://www.football-data.org)
- Supabase CLI (cần cài để develop/deploy Edge Functions)

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Single Edge Function file | KISS — ~200 lines, student project, không cần tách modules |
| Odds tính từ position | Đơn giản, realistic enough cho simulated betting |
| Upsert bằng `service_role` key | Bypass RLS, Edge Function có quyền write trực tiếp |
| External cron (cron-job.org) | Supabase free tier không có pg_cron |
| 2 API calls per sync | Rate limit 10 req/min, chỉ cần `/matches` + `/standings` |
