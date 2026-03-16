# Phase 03: Supabase Client & TypeScript Types

## Context

- [docs/08_API_CONTRACT.md](../../docs/08_API_CONTRACT.md)
- [docs/09_DB_SCHEMA.md](../../docs/09_DB_SCHEMA.md)
- [AGENTS.md](../../AGENTS.md) — Code conventions

## Overview

- **Priority:** P1
- **Status:** Partial ⏳ (.env đã có, nhưng lib/supabase.ts và types/database.ts chưa tạo)
- **Effort:** 30m

Tạo Supabase client singleton, TypeScript types cho DB schema, env config.

## Key Insights

- Supabase client React Native cần `AsyncStorage` adapter cho auth persistence
- Single instance pattern: `lib/supabase.ts` → import everywhere (AGENTS.md rule)
- TypeScript types tự viết tay match DB schema (không dùng CLI gen cho simple project)
- Env vars: dùng Expo constants hoặc plain constants file (không cần dotenv cho student project)

## Requirements

### Functional
- `lib/supabase.ts` export Supabase client singleton
- `types/database.ts` export TypeScript types cho 4 tables
- Config file cho Supabase URL + anon key

### Non-functional
- **Không** hardcode Supabase credentials trong code trực tiếp
- TypeScript strict mode → no `any` types

## Related Code Files

| Action | File | Description |
|--------|------|-------------|
| Create | `lib/supabase.ts` | Supabase client singleton (with SSR-safe storage) |
| Create | `types/database.ts` | TypeScript types cho DB tables |
| Create | `.env` | Supabase URL + publishable key (thay constants/supabase.ts) |

## Implementation Steps

1. Tạo `constants/supabase.ts`:
   ```typescript
   export const SUPABASE_URL = "https://your-project.supabase.co";
   export const SUPABASE_ANON_KEY = "your-anon-key";
   ```

2. Tạo `lib/supabase.ts`:
   ```typescript
   import AsyncStorage from "@react-native-async-storage/async-storage";
   import { createClient } from "@supabase/supabase-js";
   import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/constants/supabase";
   import { Database } from "@/types/database";

   export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
     auth: {
       storage: AsyncStorage,
       autoRefreshToken: true,
       persistSession: true,
       detectSessionInUrl: false, // quan trọng: false cho React Native
     },
   });
   ```

3. Tạo `types/database.ts` với types match DB schema:
   - `User`, `Team`, `Match`, `Bet` types
   - `Database` type cho Supabase client generic
   - Enum types: `BetType`, `BetChoice`, `BetStatus`, `MatchStatus`, `UserRole`

## Todo

- [x] Tạo `.env` với `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_KEY` (per latest Supabase docs, thay `constants/supabase.ts`)
- [ ] Tạo `types/database.ts` với types cho 4 tables + enums + Database generic
- [ ] Tạo `lib/supabase.ts` với client singleton + SSR-safe AsyncStorage wrapper
- [ ] Verify: import supabase → no TypeScript errors

## Success Criteria

- `import { supabase } from "@/lib/supabase"` → no errors
- `supabase.from("teams").select("*")` → TypeScript autocomplete column names
- No `any` types anywhere

## Risk Assessment

- **Medium:** Sai Supabase URL/key → query fail → rõ ràng qua error message
- **Low:** Types mismatch → TypeScript compiler bắt lỗi ngay
