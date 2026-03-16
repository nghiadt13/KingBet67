# UI Design System

> **Living document** — cập nhật khi thay đổi design tokens, thêm components, hoặc đổi patterns.
> **Bắt buộc đọc** trước khi implement bất kỳ screen nào.

---

## Theme

**Light theme only** — không hỗ trợ dark mode (student project, keep simple).

Tất cả screens PHẢI dùng background `#F8FAFC`, không dùng `#000` hay default dark.

---

## Color Palette

| Token | Hex | Dùng cho |
|-------|-----|----------|
| `primary` | `#3B82F6` | Buttons chính, active tab, links, logo badge, avatar |
| `primaryDark` | `#2563EB` | Hover/pressed state |
| `background` | `#F8FAFC` | Background mọi screens (trừ auth screens = `#FFFFFF`) |
| `card` | `#FFFFFF` | Card backgrounds, tab bar, header |
| `text` | `#1E293B` | Primary text, headings |
| `textMuted` | `#64748B` | Secondary text, descriptions |
| `textLight` | `#94A3B8` | Tertiary text, labels, placeholders |
| `inputBg` | `#F8FAFC` | Input field backgrounds |
| `inputBorder` | `#E2E8F0` | Input borders, dividers |
| `accent` | `#F97316` | CTA nổi bật, badges, highlights (chưa dùng) |
| `success` | `#16A34A` | Win status, positive values |
| `error` | `#DC2626` | Errors, loss status, destructive actions |
| `errorBg` | `#FEF2F2` | Error message backgrounds |

### Áp dụng trong code

```typescript
// ❌ SAI — hardcode random colors
backgroundColor: "#f5f5f5"
color: "#687076"

// ✅ ĐÚNG — dùng design tokens
backgroundColor: "#F8FAFC"   // background
color: "#1E293B"             // text
color: "#64748B"             // textMuted
```

---

## Typography

Dùng **system font** mặc định (San Francisco trên iOS, Roboto trên Android). Không import Google Fonts.

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Screen title (logo) | 28px | 800 (ExtraBold) | `#1E293B` |
| Section heading | 20px | 700 (Bold) | `#1E293B` |
| Body text | 15px | 400 (Regular) | `#1E293B` |
| Label (form) | 13px | 600 (SemiBold) | `#1E293B` |
| Muted / secondary | 14px | 400 | `#64748B` |
| Caption / tertiary | 13px | 400 | `#94A3B8` |
| Button text | 15px | 700 | `#FFFFFF` |
| Small uppercase | 11px | 600, `letterSpacing: 0.5` | `#94A3B8` |

---

## Spacing & Sizing

| Token | Value | Dùng cho |
|-------|-------|----------|
| Screen padding horizontal | 20–28px | `paddingHorizontal` trên screen |
| Card padding | 16px | Padding bên trong cards |
| Card gap | 10px | Gap giữa các cards |
| Input height | 52px | TextInput containers |
| Button height | 48–52px | Primary/secondary buttons |
| Border radius (inputs/buttons) | 14px | Rounded elements |
| Border radius (cards) | 14px | Card containers |
| Border radius (logo badge) | 20px | Squared-round badges |
| Border radius (avatar) | 50% | Circular elements |
| Icon size (input) | 20px | Icons bên trong inputs |
| Icon size (tab bar) | Expo default | Tab bar icons |

---

## Icons

**Thư viện:** `MaterialCommunityIcons` từ `@expo/vector-icons`

```typescript
import { MaterialCommunityIcons } from "@expo/vector-icons";
```

### Rules

| ✅ DO | ❌ DON'T |
|-------|---------|
| Dùng `MaterialCommunityIcons` | Dùng emoji (📧 🔒 👤 ⚽ 🏠) |
| Dùng `-outline` variant cho inputs | Dùng filled icons trong form inputs |
| Consistent size (20px inputs, 32px placeholders) | Random sizes |
| Color từ palette (`#9BA1A6` inactive, `#3B82F6` active) | Hardcode random colors |

### Icon Mapping

| Context | Icon Name |
|---------|-----------|
| Email | `email-outline` |
| Password | `lock-outline` |
| Confirm password | `lock-check-outline` |
| Username / Account | `account-outline` / `account-circle` |
| Show password | `eye-outline` |
| Hide password | `eye-off-outline` |
| Error | `alert-circle-outline` |
| Home / Matches | `soccer` |
| Standings | `trophy` |
| History | `history` |
| Leaderboard | `podium-gold` |
| Profile | `account-circle` |
| Dashboard | `view-dashboard` |
| Users | `account-group` |
| System / Settings | `cog` |
| Wallet / Balance | `wallet-outline` |
| Logout | `logout` |
| Match detail | `soccer-field` |

---

## Components

### Input Field

- Label text **phía trên** input (không dùng placeholder làm label)
- Icon bên **trái** input (20px, color `#9BA1A6`)
- Password fields có **eye toggle** bên phải
- Border: `1.5px solid #E2E8F0`, radius `14px`
- Background: `#F8FAFC`
- Focus state: border color → `#3B82F6` (chưa implement, future)

```
┌──────────────────────────────┐
│ Label                         │
│ ┌────────────────────────┐   │
│ │ 🔒  Input text     👁  │   │
│ └────────────────────────┘   │
└──────────────────────────────┘
```

### Primary Button

- Height 52px, radius 14px
- Background: `#3B82F6`
- Text: white, 15px, weight 700, letterSpacing 0.8
- Shadow: `shadowColor: #3B82F6`, opacity 0.25, radius 8
- Disabled: opacity 0.6
- Loading: `<ActivityIndicator color="#fff" />`

### Error Box

- Background: `#FEF2F2`
- Border radius: 10px
- Icon `alert-circle-outline` (16px, `#DC2626`) + error text
- Dùng `flexDirection: "row"`, gap 8px

### Placeholder Screen

- Component: `<PlaceholderScreen icon="..." title="..." subtitle="..." />`
- File: `components/placeholder-screen.tsx`
- Style: icon trong circle (`#EFF6FF` bg, 72px), title + subtitle centered

### Card

- Background: `#FFFFFF`
- Radius: 14px
- Shadow: `shadowOpacity: 0.04`, `shadowRadius: 3`, elevation 1
- Padding: 16px horizontal, 14px vertical

---

## Navigation & Transitions

### Screen Animations

| Transition | Animation | Duration |
|------------|-----------|----------|
| Auth ↔ Tabs (route group switch) | `fade` | 300ms |
| Login ↔ Register | `fade` | 250ms |
| Match detail (push) | `slide_from_right` | default |

### Tab Bar

- Background: `#FFFFFF`
- Active tint: `#3B82F6`
- Inactive tint: `#94A3B8`
- Border top color: `#E2E8F0`
- Header: white bg, no shadow, bold title

### Loading Screen

Khi auth đang initialize (kiểm tra session):
- White background
- Logo badge (soccer icon, blue bg, shadow glow)
- "KingBet67" text
- Small ActivityIndicator bên dưới

---

## Auth Screens Layout

Cả Login và Register follow cùng 1 layout:

```
┌────────────────────────────────────┐
│            (center)                 │
│       ┌────────────┐               │
│       │  ⚽ icon   │  ← Logo badge │
│       └────────────┘               │
│         KingBet67                   │
│       Football Bets                 │
│                                     │
│  Label                              │
│  ┌──────────────────────────────┐  │
│  │ 🔒  Input               👁  │  │
│  └──────────────────────────────┘  │
│  ...more inputs...                  │
│                                     │
│  ┌──────── Error Box ───────────┐  │
│  │ ⚠ Error message             │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │         ĐĂNG NHẬP           │  │
│  └──────────────────────────────┘  │
│                                     │
│    Chưa có tài khoản? Đăng ký ngay │
│                                     │
└────────────────────────────────────┘
```

- `KeyboardAvoidingView` + `ScrollView` bọc ngoài
- `Pressable` + `Keyboard.dismiss` cho tap outside
- Max width form: 380px
- Auth screens background: `#FFFFFF` (trắng tinh)

---

## StatusBar

```typescript
<StatusBar style="dark" />
```

Luôn dùng `dark` vì light theme.

---

## Pre-Implementation Checklist

Trước khi implement mỗi screen mới, verify:

- [ ] Background dùng `#F8FAFC` (hoặc `#FFFFFF` cho auth)
- [ ] Icons dùng `MaterialCommunityIcons`, KHÔNG dùng emojis
- [ ] Colors chỉ lấy từ palette bên trên
- [ ] Text sizes theo typography table
- [ ] Buttons follow Primary Button pattern
- [ ] Cards follow Card pattern (white, radius 14, subtle shadow)
- [ ] Inputs có label phía trên, icon trái, radius 14
- [ ] Error states dùng Error Box pattern
- [ ] Loading states dùng `ActivityIndicator` (không blank screen)
