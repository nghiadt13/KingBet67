# Phase 04: Register Screen (S-02)

## Context

- [docs/03_wireframe/S-02_register.md](../../docs/03_wireframe/S-02_register.md) — Wireframe
- [app/(auth)/register.tsx](../../app/(auth)/register.tsx) — Current placeholder
- Phase 03 Login — follow same style patterns

## Overview

- **Priority:** P1
- **Status:** Completed ✅
- **Effort:** 30m

Replace placeholder with register form. Username + email + password + confirm.

## Requirements

- BR-A01: Email unique
- BR-A02: Username unique (pre-validated via RPC)
- BR-A03: Password >= 8 ký tự
- BR-A04: Confirm password phải khớp
- BR-A05: Balance khởi tạo mặc định (handled by trigger)

## Related Code Files

| Action | File | Description |
|--------|------|-------------|
| Modify | `app/(auth)/register.tsx` | Replace placeholder with real form |

## Implementation Steps

1. Thay nội dung `register.tsx`:

```typescript
// State:
const [username, setUsername] = useState('');
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [confirmPassword, setConfirmPassword] = useState('');
const [validationError, setValidationError] = useState('');

// From store:
const { signUp, isLoading, error, clearError } = useAuthStore();

// Client validation:
const handleRegister = async () => {
  if (!username.trim() || !email.trim() || !password || !confirmPassword) {
    setValidationError('Vui lòng điền đầy đủ thông tin');
    return;
  }
  if (password.length < 8) {
    setValidationError('Mật khẩu phải có ít nhất 8 ký tự');
    return;
  }
  if (password !== confirmPassword) {
    setValidationError('Mật khẩu không khớp');
    return;
  }
  setValidationError('');
  await signUp(email.trim(), password, username.trim());
  // signUp pre-validates username, then calls Supabase signUp
  // onAuthStateChange → auto redirect via auth guard
};
```

2. UI structure (theo wireframe S-02):
   - Logo: ⚽ BetKing / Football Bets
   - TextInput: username
   - TextInput: email
   - TextInput: password (secureTextEntry)
   - TextInput: confirm password (secureTextEntry)
   - Error messages: validationError (client) + error from store (server)
   - Button: "ĐĂNG KÝ"
   - Link: "Đã có tài khoản? Đăng nhập ngay →" → router.push('/(auth)/login')

3. Follow same style patterns as Login (Phase 03):
   - Same container, logo, input, button styles
   - Extract shared styles to `constants/auth-styles.ts` nếu trùng nhiều

## Todo

- [x] Replace placeholder với register form
- [x] 4 TextInputs: username, email, password, confirm
- [x] Client validation (empty, password length, password match)
- [x] Display errors (client + server)
- [x] Submit → signUp → redirect
- [x] Link to login screen

## Success Criteria

- Nhập đúng → tạo account → auto login → redirect
- Password < 8 → "Mật khẩu phải có ít nhất 8 ký tự"
- Password mismatch → "Mật khẩu không khớp"
- Username trùng → "Username đã tồn tại"
- Email trùng → error từ Supabase
