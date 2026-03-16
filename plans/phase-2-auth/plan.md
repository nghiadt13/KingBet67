---
title: "Phase 2: Auth — Signup, Login, Routing"
description: "Implement Supabase Auth flow: DB trigger, Zustand auth store, login/register screens, role-based routing, banned user check"
status: partial
priority: P1
effort: 3.5h
branch: main
tags: [auth, supabase, zustand, expo-router]
created: 2026-03-15
---

# Phase 2: Auth

## Overview

Full auth flow: đăng ký, đăng nhập, đăng xuất, auto-redirect theo role, banned user check.
Sau phase này: user register → auto login → thấy user tabs. Admin login → thấy admin tabs. Banned user → bị kick.

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | DB Trigger + RLS | Completed ✅ | 30m | [phase-01](./phase-01-db-trigger.md) |
| 2 | Auth Store (Zustand) | Not Started ⏳ | 45m | [phase-02](./phase-02-auth-store.md) |
| 3 | Login Screen | Not Started ⏳ | 45m | [phase-03](./phase-03-login.md) |
| 4 | Register Screen | Not Started ⏳ | 30m | [phase-04](./phase-04-register.md) |
| 5 | Auth Guard + Routing | Not Started ⏳ | 30m | [phase-05](./phase-05-auth-guard.md) |
| 6 | Verification | Not Started ⏳ | 30m | [phase-06](./phase-06-verification.md) |

## Dependencies

- Phase 1: Foundation ✅ (Supabase client, types, navigation skeleton)
- Supabase project with schema.sql applied ✅

## Key Decisions

- **Zustand store** cho auth state (không persist — Supabase tự persist session qua AsyncStorage)
- **`onAuthStateChange`** listener để track auth state reactively
- **Redirect via `useSegments()` + `router.replace()`** — classic Expo Router auth pattern, reliable hơn `Stack.Protected`
- **Pre-validate username** trước signUp để tránh trigger fail (username UNIQUE constraint)
- **Ban check**: query `public.users` sau signIn → nếu `is_banned` → signOut + alert

## Business Rules Covered

- BR-A01 → BR-A09 (Account rules)
- BR-K02 (Admin không đặt cược → admin route riêng)

## Existing Patterns (from Phase 1)

- Supabase client: `import { supabase } from "@/lib/supabase"`
- Types: `import { User } from "@/types/database"`
- Screen style: `StyleSheet.create({ container: { flex: 1, alignItems, justifyContent } })`
- Icons: `MaterialCommunityIcons` from `@expo/vector-icons`
- Colors: `Colors[colorScheme ?? 'light']` from `@/constants/theme`
- Root layout: Stack with route groups `(auth)`, `(user-tabs)`, `(admin-tabs)`

## References

- [docs/08_API_CONTRACT.md](../../docs/08_API_CONTRACT.md) — Auth API
- [docs/04_BUSINESS_RULES.md](../../docs/04_BUSINESS_RULES.md) — BR-A01~A09
- [docs/09_DB_SCHEMA.md](../../docs/09_DB_SCHEMA.md) — Trigger SQL
- [docs/03_wireframe/S-01_login.md](../../docs/03_wireframe/S-01_login.md)
- [docs/03_wireframe/S-02_register.md](../../docs/03_wireframe/S-02_register.md)
- [plans/phase-1-foundation/](../phase-1-foundation/) — Phase 1 patterns

## Red Team Review

| # | Severity | Finding | Disposition |
|---|----------|---------|-------------|
| 1 | High | Username uniqueness: nếu trigger fail (username trùng), auth.users row tạo rồi nhưng public.users row không có → user "half-created" | ✅ Accepted — pre-validate username trước signUp |
| 2 | Medium | Race condition: signUp → trigger tạo row → fetch user. Trigger có thể chưa chạy xong khi fetch | ✅ Accepted — fetch user trong onAuthStateChange callback, retry nếu not found |
| 3 | Medium | RLS chưa enable → ban check query thấy tất cả users | ✅ Accepted — enable RLS + add SELECT policy ở Phase 01 |
| 4 | Low | Session restore on app restart: Supabase getSession() có thể trả expired token | ❌ Rejected — Supabase autoRefreshToken handles this |
