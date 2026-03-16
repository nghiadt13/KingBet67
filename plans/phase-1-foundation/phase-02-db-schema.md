# Phase 02: Supabase DB Schema

## Context

- [docs/09_DB_SCHEMA.md](../../docs/09_DB_SCHEMA.md) — Full SQL
- [docs/05_DOMAIN_MODEL.md](../../docs/05_DOMAIN_MODEL.md) — ERD

## Overview

- **Priority:** P1
- **Status:** In Progress ⏳ (SQL prepared, needs manual run on Dashboard)
- **Effort:** 45m

Tạo 4 tables, indexes, helper function `is_admin()` trên Supabase Dashboard (SQL Editor). Chưa tạo RPCs, triggers, RLS (để Phase 2+ khi cần).

## Key Insights

- Chạy SQL trên Supabase Dashboard → SQL Editor
- Chỉ tạo **tables + indexes + is_admin()** ở phase này — đủ để app connect và query
- RPCs (place_bet, deposit, etc.) → tạo khi implement feature tương ứng
- DB trigger (on_auth_user_created) → tạo ở Phase 2 (Auth)
- RLS policies → tạo ở Phase 7 (User Features)

## Requirements

### Functional
- 4 tables: `users`, `teams`, `matches`, `bets`
- 7 indexes cho performance
- Helper function `is_admin()`

## Implementation Steps

1. **[MANUAL] Tạo Supabase project** trên [supabase.com/dashboard](https://supabase.com/dashboard):
   - New Project → chọn region (Singapore gần VN nhất)
   - Lưu lại: **Project URL** + **anon key** (Settings → API)

2. Mở Supabase Dashboard → SQL Editor

2. Chạy SQL tạo tables (copy từ `09_DB_SCHEMA.md` section 1):
   ```sql
   -- users, teams, matches, bets tables
   -- Xem 09_DB_SCHEMA.md cho full SQL
   ```

3. Chạy SQL tạo indexes (section 2 của 09_DB_SCHEMA.md)

4. Chạy SQL tạo `is_admin()` helper (section 3 của 09_DB_SCHEMA.md)

5. Verify trên Dashboard: Tables → thấy 4 tables

## Todo

- [ ] Tạo table `users`
- [ ] Tạo table `teams`
- [ ] Tạo table `matches`
- [ ] Tạo table `bets`
- [ ] Tạo 7 indexes
- [ ] Tạo function `is_admin()`
- [ ] Verify trên Dashboard: 4 tables hiện đúng

## Success Criteria

- Dashboard → Table Editor → thấy 4 tables với đúng columns
- `SELECT * FROM users;` → trả về bảng trống
- `SELECT is_admin();` → false (chưa login)

## Risk Assessment

- **Medium:** Sai SQL syntax → Supabase SQL Editor báo lỗi rõ ràng, fix ngay
- **Low:** Quên index → app vẫn chạy, chỉ chậm hơn

## Security Considerations

- Chưa bật RLS ở phase này → data public temporarily → OK vì chưa có data thật
- RLS bật ở Phase 7 trước khi "go live"
