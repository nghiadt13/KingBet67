# Phase 06: Admin Account + Verification

## Context

- All previous phases in this plan

## Overview

- **Priority:** P1
- **Status:** In Progress ⏳ (code ready, manual testing next)
- **Effort:** 30m

Tạo admin account, test full auth flow end-to-end.

## Implementation Steps

1. **[MANUAL] Tạo admin account** trên Supabase Dashboard:
   - Authentication → Users → Add User
   - Email: `admin@betking.com`, Password: `admin123456`
   - Trigger sẽ tạo row trong `public.users` với role = 'user'

2. **[MANUAL] Update role to admin:**
   ```sql
   UPDATE public.users SET role = 'admin' WHERE email = 'admin@betking.com';
   ```

3. **Test flow — User registration:**
   - Mở app → Login screen hiện
   - Tap "Đăng ký" → Register screen
   - Nhập: username=testuser, email=test@test.com, pass=12345678, confirm=12345678
   - Submit → auto login → redirect to user-tabs → 5 tabs visible
   - Verify: public.users có row mới với balance=1000000

4. **Test flow — User login/logout:**
   - Tap Profile → Đăng xuất (chưa implement nút, dùng console hoặc tạm thêm button)
   - Redirect về login screen
   - Login lại → redirect về user-tabs

5. **Test flow — Admin login:**
   - Login: admin@betking.com / admin123456
   - → redirect to admin-tabs → 3 tabs visible (Dashboard, Users, System)

6. **Test flow — Banned user:**
   - [MANUAL] SQL: `UPDATE public.users SET is_banned = true WHERE email = 'test@test.com';`
   - Login test@test.com → "Tài khoản đã bị khóa" error
   - [MANUAL] SQL: Reset ban: `UPDATE public.users SET is_banned = false WHERE email = 'test@test.com';`

7. **Test flow — Validation:**
   - Register: empty fields → validation error
   - Register: password < 8 → error
   - Register: password mismatch → error
   - Register: duplicate username → "Username đã tồn tại"
   - Login: wrong password → error from Supabase

8. **TypeScript check:**
   ```bash
   npx tsc --noEmit
   ```

## Todo

- [ ] Tạo admin account via Dashboard
- [ ] Update admin role via SQL
- [ ] Test user registration flow
- [ ] Test user login/logout flow
- [ ] Test admin login → admin-tabs routing
- [ ] Test banned user → blocked + error message
- [ ] Test all validation messages
- [ ] `npx tsc --noEmit` → no errors
- [x] Add temporary sign-out button to Profile screen (for testing)

## Success Criteria

- ✅ Register → auto login → user-tabs
- ✅ Login user → user-tabs
- ✅ Login admin → admin-tabs
- ✅ Logout → login screen
- ✅ Banned → error message, stays on login
- ✅ All validation messages work
- ✅ App restart → auto-restore session
- ✅ TypeScript clean
