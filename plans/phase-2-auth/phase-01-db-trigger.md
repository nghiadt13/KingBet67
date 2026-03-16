# Phase 01: DB Trigger + Minimal RLS

## Context

- [docs/09_DB_SCHEMA.md](../../docs/09_DB_SCHEMA.md) — Section 5 (Trigger) + Section 6 (RLS)
- [supabase/schema.sql](../../supabase/schema.sql) — Tables already created

## Overview

- **Priority:** P1
- **Status:** Completed ✅
- **Effort:** 30m

Tạo DB trigger auto-create user on signup + enable RLS trên users table.

## Key Insights

- Trigger phải là `SECURITY DEFINER` + `SET search_path = public` để bypass RLS khi insert
- RLS phải enable TRƯỚC khi app query users table (nếu không, user thấy hết tất cả users)
- Chỉ cần RLS cho `users` table ở phase này — teams/matches là public data

## Implementation Steps

1. Chạy SQL trên Supabase Dashboard → SQL Editor:

```sql
-- ============================================
-- Phase 2: Auth — DB Trigger + RLS
-- ============================================

-- 1. Trigger: auto-create user when auth.users row is inserted
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, username, email, role, balance, is_banned)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    NEW.email,
    'user',
    1000000,
    false
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 2. Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policy: users can read own row
CREATE POLICY "Users can read own profile"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- 4. RLS Policy: allow authenticated users to check username existence (for pre-validation)
-- This policy allows SELECT on username column only, for any authenticated user
CREATE POLICY "Authenticated users can check usernames"
  ON public.users
  FOR SELECT
  USING (auth.role() = 'authenticated');
```

> **Lưu ý:** Policy 4 cho phép authenticated users đọc tất cả users (cần cho username check).
> Nhưng với new users đang register, họ chưa authenticated. Vậy username check cần dùng 1 cách khác.

2. **Thay thế policy 4** — dùng RPC để check username (bypass RLS):

```sql
-- Function kiểm tra username đã tồn tại chưa (SECURITY DEFINER = bypass RLS)
CREATE OR REPLACE FUNCTION check_username_available(p_username VARCHAR)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.users WHERE username = p_username
  );
$$;
```

> Gọi từ FE: `supabase.rpc('check_username_available', { p_username: 'player1' })`
> Trả về `true` nếu username available, `false` nếu đã tồn tại.
> Chạy dưới SECURITY DEFINER → bypass RLS → works cho cả unauthenticated users trên register form.

3. Bỏ policy 4 ở trên, chỉ giữ policy "Users can read own profile".

## Todo

- [x] Tạo function `handle_new_user()`
- [x] Tạo trigger `on_auth_user_created`
- [x] Enable RLS trên users table
- [x] Tạo policy "Users can read own profile"
- [x] Tạo function `check_username_available()`
- [x] Test: tạo test user qua Dashboard Auth → check public.users có row mới
- [x] Thêm SQL vào `supabase/schema.sql` (append, để track)

## Related Code Files

| Action | File | Description |
|--------|------|-------------|
| Modify | `supabase/schema.sql` | Append trigger + RLS SQL |
| Modify | `types/database.ts` | Thêm `check_username_available` vào Functions type |

## Success Criteria

- Tạo auth user qua Dashboard → public.users có row tương ứng
- `supabase.from('users').select().eq('id', userId)` trả về đúng 1 row (RLS works)
- `supabase.rpc('check_username_available', { p_username: 'test' })` → true/false

## Risk Assessment

- **High:** Trigger fail nếu username NULL (metadata thiếu) → add COALESCE fallback
- **Medium:** RLS policy sai → user không query được → test ngay sau khi tạo
