# KingBet67 ⚽

> App mobile mô phỏng cá cược bóng đá bằng tiền ảo — Đồ án môn MMA301.

## Mô tả

KingBet67 là ứng dụng React Native cho phép user đặt cược các trận đấu **Premier League** (data thật từ football-data.org) bằng tiền ảo. Hệ thống tự tính odds dựa trên bảng xếp hạng và tự động trả thưởng khi trận kết thúc.

### Tính năng chính

- 🔐 Đăng ký / Đăng nhập (email + password)
- 💰 Nạp tiền ảo (không giới hạn)
- ⚽ Xem trận đấu Premier League (lịch thi đấu, kết quả)
- 🎰 Đặt cược 5 loại kèo (1X2, tỉ số, tài/xỉu, BTTS, hiệp 1)
- 📋 Lịch sử cược cá nhân
- 🥇 Bảng xếp hạng người chơi (leaderboard)
- 👤 Hồ sơ cá nhân + thống kê
- 📊 Admin Dashboard (thống kê, quản lý users, sync/settle)

## Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| **Frontend** | Expo SDK 54, React Native 0.81, Expo Router v4, TypeScript, Zustand |
| **Backend** | Supabase (Auth + PostgreSQL + Edge Functions) |
| **Data** | [football-data.org](https://www.football-data.org/) API (Premier League) |

## Cài đặt & Chạy

### Prerequisites

- Node.js (LTS)
- Expo Go app trên điện thoại (hoặc Android/iOS emulator)
- Supabase project (đã setup)

### 1. Install dependencies

```bash
npm install
```

### 2. Cấu hình `.env`

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=your-anon-key

# Server-side only
FOOTBALL_DATA_API_KEY=your-api-key
```

### 3. Setup Database

Chạy `supabase/schema.sql` trên Supabase Dashboard → SQL Editor.

### 4. Chạy app

```bash
npx expo start
```

Quét QR bằng Expo Go hoặc chạy trên emulator.

## Cấu trúc Project

```
KingBet67/
├── app/              # Screens (Expo Router)
├── components/       # Shared UI components
├── constants/        # Theme, colors
├── hooks/            # Custom React hooks
├── supabase/         # DB schema + Edge Functions
├── docs/             # Tài liệu thiết kế
└── plans/            # Kế hoạch phát triển (9 phases)
```

## Tài liệu

Xem thư mục `docs/` để biết chi tiết:
- [Problem & Vision](docs/01_PROBLEM.md)
- [Use Cases](docs/02_USE_CASES.md)
- [UI Screens](docs/03_UI_SCREENS.md)
- [Business Rules](docs/04_BUSINESS_RULES.md)
- [DB Schema](docs/09_DB_SCHEMA.md)
- [Implementation Roadmap](docs/ROADMAP.md)
- [Project Context](docs/PROJECT_CONTEXT.md)
