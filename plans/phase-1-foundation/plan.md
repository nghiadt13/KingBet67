---
title: "Phase 1: Foundation — Project Setup"
description: "Setup Expo project, Supabase DB, Supabase client, TypeScript types, and tab navigation skeleton for KingBet67 app"
status: in-progress
priority: P1
effort: 3h
branch: main
tags: [foundation, setup, expo, supabase]
created: 2026-03-15
---

# Phase 1: Foundation

## Overview

Setup the foundational layer: cài dependencies, kết nối Supabase, tạo DB schema, TypeScript types, và tab navigation skeleton. Sau phase này app phải chạy được với tabs placeholder + Supabase connection OK.

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Install Dependencies & Config | Completed ✅ | 30m | [phase-01](./phase-01-dependencies.md) |
| 2 | Supabase DB Schema | Completed ✅ | 45m | [phase-02](./phase-02-db-schema.md) |
| 3 | Supabase Client & Types | Not Started ⏳ | 30m | [phase-03](./phase-03-supabase-client.md) |
| 4 | Tab Navigation Skeleton | Not Started ⏳ | 45m | [phase-04](./phase-04-navigation.md) |
| 5 | Verification | Not Started ⏳ | 30m | [phase-05](./phase-05-verification.md) |

## Dependencies

- Expo project đã tạo (SDK 54) ✅
- Supabase project phải tạo trên Dashboard (manual step)
- Cần Supabase URL + anon key

## Key Decisions

- Dùng `@react-native-async-storage/async-storage` cho Supabase auth persistence (bắt buộc cho React Native)
- TypeScript types generate từ DB schema, đặt trong `types/database.ts`
- Tab navigation: User 5 tabs + Admin 3 tabs, phân biệt bằng route groups `(user-tabs)` và `(admin-tabs)`
- Giữ nguyên template components mà Expo tạo sẵn, chỉ sửa tabs layout

## References

- [docs/07_TECH_STACK.md](../../docs/07_TECH_STACK.md) — versions
- [docs/09_DB_SCHEMA.md](../../docs/09_DB_SCHEMA.md) — SQL
- [docs/06_ARCHITECTURE.md](../../docs/06_ARCHITECTURE.md) — architecture
- [docs/03_UI_SCREENS.md](../../docs/03_UI_SCREENS.md) — navigation structure
- [AGENTS.md](../../AGENTS.md) — project rules

## Red Team Review

| # | Severity | Finding | Disposition |
|---|----------|---------|-------------|
| 1 | Medium | Phase 02 thiếu step tạo Supabase project trên Dashboard | ✅ Accepted — đã thêm step |
| 2 | Medium | docs/07_TECH_STACK.md ghi SDK 55 nhưng thực tế là SDK 54 | ✅ Accepted — update ở Phase 05 |
| 3 | Low | Supabase credentials trong constants file thay vì .env | ❌ Rejected — anon key designed to be public, student project |
| 4 | Low | Template cleanup có thể break imports | ❌ Rejected — check during implementation |

