# Phase 04: Tab Navigation Skeleton

## Context

- [docs/03_UI_SCREENS.md](../../docs/03_UI_SCREENS.md) — Navigation structure
- [app/(tabs)/_layout.tsx](../../app/(tabs)/_layout.tsx) — Current tab layout

## Overview

- **Priority:** P1
- **Status:** Not Started ⏳
- **Effort:** 45m

Tạo navigation structure: User tabs (5 tabs), Admin tabs (3 tabs), auth screens group. Mỗi screen hiện placeholder. Xóa template screens không dùng.

## Key Insights

- Expo Router dùng file-based routing: `app/` directory structure = routes
- User và Admin tabs phải tách thành 2 route groups riêng: `(user-tabs)`, `(admin-tabs)`
- Auth screens (login, register) ở group `(auth)` — không có tab bar
- Root `_layout.tsx` dùng `Stack` để chuyển giữa auth ↔ user-tabs ↔ admin-tabs
- Xóa template files: `explore.tsx`, `modal.tsx`, các components không cần
- Giữ: hooks, constants (sẽ sửa lại sau)

## Requirements

### Functional
- 3 route groups: `(auth)`, `(user-tabs)`, `(admin-tabs)`
- User tabs: Home, Standings, History, Leaderboard, Profile (5 tabs)
- Admin tabs: Dashboard, Users, System (3 tabs)
- Auth: Login, Register (2 screens, no tabs)
- Tất cả screens hiện placeholder text

### Non-functional
- File-based routing, follow Expo Router conventions
- Tab icons dùng `@expo/vector-icons` (MaterialCommunityIcons — đẹp hơn Ionicons)

## Related Code Files

| Action | File | Description |
|--------|------|-------------|
| Modify | `app/_layout.tsx` | Root layout: Stack cho auth/user/admin groups |
| Delete | `app/(tabs)/` | Xóa template tab group cũ |
| Delete | `app/modal.tsx` | Xóa template modal |
| Create | `app/(auth)/_layout.tsx` | Auth layout (Stack, no tabs) |
| Create | `app/(auth)/login.tsx` | Placeholder login |
| Create | `app/(auth)/register.tsx` | Placeholder register |
| Create | `app/(user-tabs)/_layout.tsx` | User tab layout (5 tabs) |
| Create | `app/(user-tabs)/index.tsx` | Home (Match List) placeholder |
| Create | `app/(user-tabs)/standings.tsx` | Standings placeholder |
| Create | `app/(user-tabs)/history.tsx` | Bet History placeholder |
| Create | `app/(user-tabs)/leaderboard.tsx` | Leaderboard placeholder |
| Create | `app/(user-tabs)/profile.tsx` | Profile placeholder |
| Create | `app/(admin-tabs)/_layout.tsx` | Admin tab layout (3 tabs) |
| Create | `app/(admin-tabs)/index.tsx` | Dashboard placeholder |
| Create | `app/(admin-tabs)/users.tsx` | User Management placeholder |
| Create | `app/(admin-tabs)/system.tsx` | System Controls placeholder |
| Create | `app/match/[id].tsx` | Match Detail (stack screen, not tab) |

## Implementation Steps

1. Xóa template files:
   ```bash
   rm -r app/(tabs)
   rm app/modal.tsx
   ```

2. Tạo `app/_layout.tsx` (Root):
   ```typescript
   // Stack with 3 groups: (auth), (user-tabs), (admin-tabs)
   // + match/[id] as modal/push screen
   // Initial route = (auth) (chưa có auth logic, mặc định vào auth)
   ```

3. Tạo `app/(auth)/` group:
   - `_layout.tsx` — Stack layout, headerShown: false
   - `login.tsx` — Placeholder: "Login Screen"
   - `register.tsx` — Placeholder: "Register Screen"

4. Tạo `app/(user-tabs)/` group:
   - `_layout.tsx` — Tabs layout, 5 tabs với Ionicons
   - `index.tsx` — "🏠 Home (Match List)"
   - `standings.tsx` — "🏆 Standings"
   - `history.tsx` — "📋 Bet History"
   - `leaderboard.tsx` — "🥇 Leaderboard"
   - `profile.tsx` — "👤 Profile"

5. Tạo `app/(admin-tabs)/` group:
   - `_layout.tsx` — Tabs layout, 3 tabs
   - `index.tsx` — "📊 Admin Dashboard"
   - `users.tsx` — "👥 User Management"
   - `system.tsx` — "⚙️ System Controls"

6. Tạo `app/match/[id].tsx`:
   - Match Detail screen (push từ Home)
   - Placeholder: "Match Detail: {id}"

## Todo

- [ ] Xóa `app/(tabs)/` + `app/modal.tsx`
- [ ] Tạo root `_layout.tsx` với 3 route groups
- [ ] Tạo `(auth)` group: layout + login + register
- [ ] Tạo `(user-tabs)` group: layout + 5 tab screens
- [ ] Tạo `(admin-tabs)` group: layout + 3 tab screens
- [ ] Tạo `app/match/[id].tsx` match detail screen
- [ ] Verify: app chạy, tabs chuyển được, navigate giữa screens OK

## Success Criteria

- Mở app → thấy Login placeholder (default route)
- Navigate thủ công sang user-tabs → 5 tabs chuyển được
- Navigate sang admin-tabs → 3 tabs chuyển được
- Navigate sang match/123 → thấy "Match Detail: 123"

## Risk Assessment

- **Medium:** Route group conflict → Expo Router logs rõ ràng, fix file structure
- **Low:** Tab icons không hiện → fallback text label vẫn navigate được
