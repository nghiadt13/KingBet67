# Phase 01: Install Dependencies & Config

## Context

- [docs/07_TECH_STACK.md](../../docs/07_TECH_STACK.md)
- [package.json](../../package.json)

## Overview

- **Priority:** P1
- **Status:** Completed ✅
- **Effort:** 30m

Install runtime dependencies (supabase-js, zustand, date-fns, async-storage) và update config files.

## Key Insights

- Expo SDK 54 đã cài sẵn, React Native 0.81.5
- `@supabase/supabase-js` cần `@react-native-async-storage/async-storage` cho session persistence trên React Native
- `react-native-url-polyfill` **KHÔNG cần** từ supabase-js v2.39+ (đã bundle sẵn)
- Zustand v5 tương thích React 19

## Requirements

### Functional
- Tất cả dependencies phải cài và import được
- App phải chạy sau khi cài (không break)

### Non-functional
- Giữ đúng versions trong tech stack doc

## Related Code Files

| Action | File | Description |
|--------|------|-------------|
| Modify | `package.json` | Thêm dependencies |
| Modify | `app.json` | Rename app, update scheme |

## Implementation Steps

1. Cài runtime dependencies:
   ```bash
   npx expo install @supabase/supabase-js @react-native-async-storage/async-storage zustand date-fns
   ```
   > `npx expo install` thay vì `npm install` để auto-resolve compatible versions với SDK 54.

2. Update `app.json`:
   ```json
   {
     "expo": {
       "name": "KingBet67",
       "slug": "kingbet67",
       "scheme": "kingbet67"
     }
   }
   ```

3. Verify app vẫn chạy: `npx expo start`

## Todo

- [x] Cài `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `zustand`, `date-fns`
- [x] Update `app.json` (name, slug, scheme)
- [x] Verify app chạy OK

## Success Criteria

- `npm ls @supabase/supabase-js zustand date-fns @react-native-async-storage/async-storage` → không lỗi
- `npx expo start` → app chạy bình thường

## Risk Assessment

- **Low:** Package conflicts → dùng `npx expo install` tự xử lý version
