# Phase 3: Deposit Request (S-09 Profile)

## Context

- [Current profile screen](D:\Education\MMA301\KingBet67\app\(tabs)\profile.tsx)
- [Current admin tabs](D:\Education\MMA301\KingBet67\app\(admin-tabs))
- [Business Rules](D:\Education\MMA301\KingBet67\docs\04_BUSINESS_RULES.md)

## Overview

- **Priority:** P1
- **Status:** Completed
- **Effort:** ~2-3h for user flow, admin approval handled in Phase 8

This plan replaces the older assumption `user nhập tiền -> gọi RPC deposit -> balance tăng ngay`.

New requirement:
- user tạo yêu cầu nạp tiền
- request chờ admin duyệt
- chỉ khi admin approve thì balance mới tăng

## Product Definition

Profile should no longer present deposit as an instant balance mutation.

Instead, the flow is:

1. User nhập số tiền muốn nạp
2. User bấm `Gửi yêu cầu`
3. App tạo `deposit_request`
4. Request có trạng thái `PENDING`
5. Admin duyệt hoặc từ chối
6. Nếu admin duyệt thì balance mới được cộng

## Backend Design

### New table

```sql
deposit_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  amount bigint not null,
  status text not null default 'PENDING', -- PENDING | APPROVED | REJECTED
  reviewed_by uuid null references public.users(id),
  reviewed_at timestamptz null,
  admin_note text null,
  created_at timestamptz not null default now()
)
```

### Required RPCs

1. `create_deposit_request(p_amount bigint)`
   - auth required
   - validate amount > 0
   - insert new pending row
   - return request info

2. `approve_deposit_request(p_request_id uuid, p_admin_note text default null)`
   - admin only
   - lock pending row
   - increase user balance
   - mark request `APPROVED`
   - set `reviewed_by`, `reviewed_at`, `admin_note`
   - atomic transaction

3. `reject_deposit_request(p_request_id uuid, p_admin_note text default null)`
   - admin only
   - mark request `REJECTED`
   - no balance mutation

### RLS

- user can create and read own requests
- admin can read all requests
- admin should approve or reject through RPCs, not direct client writes

## User UI Scope

### Profile deposit section

Keep the current amount entry idea, but replace:
- button text `Nạp`
- direct success preview

With:
- button text `Gửi yêu cầu`
- helper text: `Yêu cầu sẽ được admin duyệt trước khi cộng số dư`

### Transaction/history meaning

For this requirement, `Lịch sử giao dịch` can be simplified to:
- list of deposit requests
- amount
- status badge: `Đang chờ`, `Đã duyệt`, `Từ chối`
- created time
- reviewed time if available
- admin note if rejected

This is simpler than a full wallet ledger and matches the workflow you described.

## Frontend Changes

### [MODIFY] `app/(tabs)/profile.tsx`

Replace direct deposit flow:
- remove `supabase.rpc('deposit', ...)`
- submit `create_deposit_request`
- show success copy `Đã gửi yêu cầu nạp`
- fetch recent deposit requests for display

### Recommended section layout

```text
Số tiền muốn nạp
[ quick amounts ]
[ amount input ] [ Gửi yêu cầu ]
Yêu cầu sẽ được admin duyệt trước khi cộng số dư.

Yêu cầu gần đây
- 200.000đ  | Đang chờ
- 500.000đ  | Đã duyệt
- 100.000đ  | Từ chối
```

## Success Criteria

- User cannot increase balance directly from the client
- User can create deposit requests
- User can see request statuses from profile
- Approved request increases balance only after admin action

## Implementation Notes

- Added `deposit_requests` table + indexes + RLS in `supabase/schema.sql`
- Replaced direct `deposit` client flow in `app/(tabs)/profile.tsx`
- Added recent request history directly inside profile screen
- Legacy `deposit()` RPC now raises `DEPOSIT_DISABLED_USE_REQUEST`
