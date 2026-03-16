# Phase 03: Login Screen (S-01)

## Context

- [docs/03_wireframe/S-01_login.md](../../docs/03_wireframe/S-01_login.md) — Wireframe
- [app/(auth)/login.tsx](../../app/(auth)/login.tsx) — Current placeholder
- Phase 1 pattern: `StyleSheet.create`, centered layout, emoji icons

## Overview

- **Priority:** P1
- **Status:** Completed ✅
- **Effort:** 45m

Replace placeholder với real login form. Email + password + validation + error display.

## Requirements

- BR-A06: Banned user → "Tài khoản đã bị khóa" message
- BR-A09: Same login for user/admin, routing handled by auth guard

## Related Code Files

| Action | File | Description |
|--------|------|-------------|
| Modify | `app/(auth)/login.tsx` | Replace placeholder with real form |

## Implementation Steps

1. Thay nội dung `login.tsx`:

```typescript
// State:
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');

// From store:
const { signIn, isLoading, error, clearError } = useAuthStore();

// Validation (client-side):
// - email & password không trống
// - Show error from store (server-side errors)

// Submit:
const handleLogin = async () => {
  if (!email.trim() || !password.trim()) {
    // show validation error
    return;
  }
  await signIn(email.trim(), password);
  // Redirect handled by auth guard in _layout.tsx
};
```

2. UI structure (theo wireframe S-01):
   - Logo: ⚽ BetKing / Football Bets
   - TextInput: email (autoCapitalize: none, keyboardType: email-address)
   - TextInput: password (secureTextEntry)
   - Error message (nếu có): red text dưới form
   - Button: "ĐĂNG NHẬP" (disabled khi loading)
   - Link: "Chưa có tài khoản? Đăng ký ngay →" → router.push('/(auth)/register')

3. UX details:
   - Loading state: button shows ActivityIndicator
   - Clear error khi user bắt đầu type (clearError on text change)
   - Keyboard dismiss on tap outside
   - ScrollView bọc form (tránh keyboard che input)

## Todo

- [x] Replace placeholder với login form
- [x] Email + Password TextInputs
- [x] Client validation (empty fields)
- [x] Display error from authStore
- [x] Submit → signIn → redirect (handled by guard)
- [x] Link to register screen
- [x] Loading state on button
- [x] Keyboard handling (dismiss + scroll)

## Success Criteria

- Mở app → thấy login form (not placeholder)
- Nhập sai → error message hiện
- Nhập đúng → redirect qua user-tabs (sau khi auth guard added)
- Link "Đăng ký" → navigate tới register
