# Phase 05: Verification

## Context

- All previous phases in this plan

## Overview

- **Priority:** P1
- **Status:** Completed ✅ (Supabase query test deferred until DB schema is created)
- **Effort:** 30m

End-to-end verification: app chạy, Supabase connection OK, tất cả screens accessible.

## Implementation Steps

1. Start app:
   ```bash
   npx expo start
   ```

2. Verify Supabase connection:
   - Tạm thêm test query trong 1 screen:
     ```typescript
     import { supabase } from "@/lib/supabase";
     // In component:
     useEffect(() => {
       supabase.from("teams").select("count").then(console.log);
     }, []);
     ```
   - Console phải log `{ data: [{ count: 0 }], error: null }`
   - Xóa test code sau khi verify

3. Verify navigation:
   - Mở app → Login placeholder visible
   - Navigate tới mỗi screen → placeholder text hiện
   - Tab bar visible + functional cho cả user-tabs và admin-tabs

4. Verify TypeScript:
   ```bash
   npx tsc --noEmit
   ```
   - Không lỗi TypeScript

5. Update `docs/07_TECH_STACK.md` nếu version thực tế khác (Expo SDK 54, RN 0.81.5 thay vì 55/0.84)

## Todo

- [x] `npx expo start` → app chạy không crash
- [ ] Supabase query test → data trả về (hoặc empty array, không error) ⏳ chờ Phase 02 manual
- [x] Tất cả screens accessible qua navigation
- [x] `npx tsc --noEmit` → no errors
- [x] Update docs nếu cần (07_TECH_STACK.md versions synced)

## Success Criteria

- App boots without errors
- Supabase client connects to DB
- All placeholder screens render
- TypeScript clean (no errors)
- Docs synced with actual versions
