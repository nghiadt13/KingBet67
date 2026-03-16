# BetKing — Phân Tích Ngữ Cảnh Project

> **Mục đích:** Tổng hợp toàn bộ ngữ cảnh dự án BetKing — tính năng, kiến trúc, cách chạy, cấu trúc code.
> **Cập nhật lần cuối:** 16/03/2026

---

## 1. Tổng Quan

**BetKing** là app mobile mô phỏng cá cược bóng đá bằng tiền ảo — đồ án môn MMA301.

- User đặt cược các trận đấu **thật** (Premier League, data từ [football-data.org](https://www.football-data.org/))
- Hệ thống tự tính odds dựa trên bảng xếp hạng, tự trả thưởng khi trận kết thúc
- Leaderboard xếp hạng ai thắng nhiều nhất / thua nhiều nhất
- Admin quản lý users, sync data, settle bets

| Vai trò | Chức năng chính |
|---------|----------------|
| **User** | Đăng ký, đăng nhập, xem trận, đặt cược, nạp tiền ảo, xem lịch sử, leaderboard, profile |
| **Admin** | Dashboard thống kê, quản lý users (ban/unban), trigger sync/settle |

---

## 2. Tech Stack

### Frontend (Mobile App)

| Công nghệ | Version | Dùng cho |
|-----------|---------|---------|
| **Expo** | SDK 54 | Framework React Native |
| **React Native** | 0.81.5 | UI mobile cross-platform |
| **Expo Router** | v4 | File-based navigation (tabs, stacks) |
| **TypeScript** | 5.9 | Type safety |
| **@supabase/supabase-js** | 2.99.1 | Gọi Supabase từ app |
| **Zustand** | 5.0.11 | State management |
| **date-fns** | 4.1 | Format ngày giờ |
| **@gorhom/bottom-sheet** | 5.2.8 | Bottom sheet UI (đặt cược) |

### Backend (Supabase — Serverless)

| Công nghệ | Dùng cho |
|-----------|---------|
| **Supabase Auth** | Đăng ký, đăng nhập, JWT session |
| **PostgreSQL** | Database chính (4 tables) |
| **Row Level Security (RLS)** | Phân quyền truy cập data ở DB level |
| **Edge Functions (Deno)** | Sync matches, settle bets, tính odds |

### External Services

| Service | Dùng cho |
|---------|---------|
| **football-data.org API** | Data trận đấu, tỉ số, standings Premier League (free tier, 10 req/phút) |
| **cron-job.org** | Trigger sync Edge Function mỗi 5-10 phút (free) |

---

## 3. Tính Năng Chi Tiết

### 3.1 User Features

#### 🔐 Tài khoản
- **Đăng ký:** email + password + username (unique). Balance khởi tạo = 1,000,000 coins
- **Đăng nhập:** email + password → phân biệt User/Admin bằng field `role`
- **Bị ban:** không thể đăng nhập, hiển thị thông báo "Tài khoản đã bị khóa"

#### 💰 Tiền ảo
- **Nạp tiền:** nhập số → cộng thẳng vào balance, không giới hạn
- Balance dùng **BIGINT** (không thập phân), tránh lỗi floating point
- Khi đặt cược → trừ tiền ngay lập tức
- Tiền thắng = `ROUND(amount × odds)`

#### ⚽ Trận đấu
- Xem danh sách trận Premier League theo matchday
- Filter 3 tab: **Đang đá / Sắp đá / Kết thúc**
- Xem chi tiết trận: logo đội, thứ hạng, phong độ, tỉ số, odds
- Xem bảng xếp hạng giải (standings: P/W/D/L/GD/Pts — 20 đội)

#### 🎰 Cá cược — 5 loại kèo

| Loại kèo | Mô tả | Lựa chọn |
|----------|-------|----------|
| **1X2** (Match Result) | Thắng/Thua/Hòa fulltime | Home Win, Draw, Away Win |
| **Tỉ số chính xác** | Đoán đúng tỉ số | 24 options (0-0, 1-0, 2-1, ...) |
| **Tài/Xỉu 2.5** | Tổng bàn > 2.5 hoặc ≤ 2.5 | Over, Under |
| **BTTS** | Cả 2 đội ghi bàn? | Yes, No |
| **Hiệp 1** | Kết quả hiệp 1 (1X2) | Home, Draw, Away |

**Quy tắc đặt cược:**
- Chỉ đặt khi trận ở trạng thái `TIMED` / `SCHEDULED`
- 1 trận có thể đặt nhiều kèo khác nhau, nhiều lần
- Odds được lock tại thời điểm đặt (không thay đổi sau đó)
- Bet đã đặt không hủy/sửa được

#### 📋 Lịch sử & Xếp hạng
- **Bet History:** filter All / Pending / Won / Lost — mỗi kèo = 1 card riêng biệt
- **Leaderboard:** 2 tab — "Thắng nhiều" (tổng winnings) và "Thua nhiều"
- **Profile:** balance, thống kê (tổng kèo, thắng, thua, pending, win rate, tổng tiền thắng), nạp tiền, logout

---

### 3.2 Admin Features

| Tính năng | Mô tả |
|----------|-------|
| **Dashboard** | 4 stat cards (users, bets, tiền lưu thông, pending bets) + trận hot nhất + top 5 users |
| **User Management** | Danh sách users, search, ban/unban (admin không thể ban chính mình) |
| **System Controls** | Nút Sync Now (fetch API → update DB), Settle Now (xử lý bets trận kết thúc) |
| **Settings** | Cài đặt admin |

> ⚠️ Admin **không được phép đặt cược**, chỉ quản lý hệ thống

---

### 3.3 Hệ thống tự động (Background)

```
Auto Sync (mỗi 5-10 phút):
    cron-job.org → Edge Function "sync-matches"
    → Fetch football-data.org API
    → Upsert matches + teams vào DB
    → Tính odds dựa trên standings (thứ hạng + lợi thế sân nhà)
    → Nếu trận FINISHED → trigger auto settle

Auto Settle:
    → Lấy tất cả bets PENDING cho trận FINISHED
    → So sánh từng bet vs kết quả thực tế
    → Đúng → status = WON, cộng tiền (amount × odds)
    → Sai → status = LOST
    → Atomic transaction (rollback nếu fail giữa chừng)
```

---

## 4. Cấu Trúc Code

```
betking/
├── app/                          # Expo Router — tất cả screens
│   ├── _layout.tsx               # Root layout (auth check, routing theo role)
│   ├── (auth)/                   # Auth group (không cần đăng nhập)
│   │   ├── _layout.tsx
│   │   ├── login.tsx             # S-01: Màn hình đăng nhập
│   │   └── register.tsx          # S-02: Màn hình đăng ký
│   ├── (user-tabs)/              # User tab bar (5 tabs)
│   │   ├── _layout.tsx           # Tab bar config
│   │   ├── index.tsx             # S-03: Home — Match List
│   │   ├── standings.tsx         # S-06: Bảng xếp hạng giải
│   │   ├── history.tsx           # S-07: Lịch sử cược
│   │   ├── leaderboard.tsx       # S-08: Leaderboard người chơi
│   │   └── profile.tsx           # S-09: Profile + Nạp tiền
│   ├── (admin-tabs)/             # Admin tab bar
│   │   ├── _layout.tsx           # Tab bar config
│   │   ├── index.tsx             # S-A01: Admin Dashboard
│   │   ├── users.tsx             # S-A02: Quản lý users
│   │   ├── system.tsx            # S-A03: Sync/Settle controls
│   │   └── settings.tsx          # Admin settings
│   └── match/                    # Stack navigation
│       └── [id].tsx              # S-04: Chi tiết trận + xem odds
│
├── components/                   # Shared UI components
│   ├── match-card.tsx            # Card hiển thị trận (danh sách)
│   ├── bet-card.tsx              # Card lịch sử cược
│   ├── place-bet-sheet.tsx       # Bottom sheet đặt cược (S-05)
│   ├── odds-section.tsx          # Section hiển thị odds
│   ├── correct-score-grid.tsx    # Grid chọn tỉ số chính xác
│   ├── status-badge.tsx          # Badge trạng thái trận
│   └── ui/                      # Base UI components
│
├── stores/                       # Zustand state management
│   ├── authStore.ts              # Auth (user, session, login/logout/register)
│   ├── matchStore.ts             # Matches + standings data
│   └── betStore.ts               # Bets (place, fetch history, stats)
│
├── lib/
│   └── supabase.ts               # Supabase client singleton
│
├── types/
│   └── database.ts               # TypeScript types matching DB schema
│
├── supabase/
│   ├── schema.sql                # Full DB schema (tables, indexes, RLS, RPCs, triggers)
│   └── functions/                # Supabase Edge Functions (Deno)
│       ├── sync-matches/         # Sync trận đấu từ football-data.org
│       ├── settle-bets/          # Xử lý kết quả cược
│       └── _shared/              # Shared utilities giữa các functions
│
├── docs/                         # 10+ tài liệu thiết kế chi tiết
├── constants/                    # App constants, colors, config
├── hooks/                        # Custom React hooks
├── assets/                       # Images, fonts
├── AGENTS.md                     # Rules cho AI agents
├── package.json                  # Dependencies
└── tsconfig.json                 # TypeScript config
```

---

## 5. Database Schema (4 Tables)

### Quan hệ giữa các bảng

```
User ──1:N──> Bet       (1 user đặt nhiều bets)
Match ──1:N──> Bet      (1 trận có nhiều bets)
Team ──1:N──> Match     (homeTeam)
Team ──1:N──> Match     (awayTeam)
```

### Chi tiết từng bảng

**users** — Thông tin tài khoản
| Column | Type | Ghi chú |
|--------|------|---------|
| id | UUID (PK) | Liên kết auth.users |
| username | VARCHAR(50) UNIQUE | |
| email | VARCHAR(255) UNIQUE | |
| role | VARCHAR(10) | 'user' hoặc 'admin' |
| balance | BIGINT | Mặc định 1,000,000 |
| is_banned | BOOLEAN | |

**teams** — Cache thông tin đội từ API
| Column | Type | Ghi chú |
|--------|------|---------|
| id | UUID (PK) | |
| external_id | INTEGER UNIQUE | ID từ football-data.org |
| name, short_name, tla | VARCHAR | |
| crest_url | TEXT | Logo đội |
| position, points, played_games, won, draw, lost, goal_difference | INTEGER | Standings data |

**matches** — Trận đấu
| Column | Type | Ghi chú |
|--------|------|---------|
| id | UUID (PK) | |
| external_id | INTEGER UNIQUE | ID từ API |
| matchday | INTEGER | |
| utc_date | TIMESTAMPTZ | |
| status | VARCHAR(20) | TIMED/SCHEDULED/IN_PLAY/PAUSED/FINISHED/POSTPONED/CANCELLED |
| home_team_id, away_team_id | UUID (FK) | |
| home_score, away_score | INTEGER | NULL khi chưa đá |
| half_time_home, half_time_away | INTEGER | |
| odds | JSONB | 5 loại kèo với odds |
| is_settled | BOOLEAN | |

**bets** — Kèo cá cược
| Column | Type | Ghi chú |
|--------|------|---------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| match_id | UUID (FK) | |
| bet_type | VARCHAR(20) | match_result/correct_score/over_under/btts/half_time |
| bet_choice | VARCHAR(10) | home/draw/away/over/under/yes/no/2-1/... |
| amount | BIGINT | Tiền cược |
| odds | NUMERIC(6,2) | Odds tại thời điểm đặt |
| status | VARCHAR(10) | PENDING/WON/LOST |
| winnings | BIGINT | amount × odds nếu WON |

### RPC Functions (Server-side logic)

| Function | Mô tả |
|----------|-------|
| `place_bet(match_id, bet_type, bet_choice, amount)` | Atomic: check user → check match → check balance → insert bet → trừ tiền |
| `deposit(amount)` | Nạp tiền: check > 0 → cộng balance |
| `get_leaderboard(type, limit)` | Bảng xếp hạng (winners/losers) |
| `get_user_stats()` | Thống kê cá nhân (total, won, lost, pending, win_rate, winnings) |
| `get_admin_stats()` | Thống kê admin (users, bets, tiền, trận hot, top users) |

### DB Trigger
- `handle_new_user()` — Khi user đăng ký qua Supabase Auth → tự tạo record trong `public.users` với balance mặc định

### RLS Policies (5 policies)
- Users chỉ xem/sửa profile của mình (hoặc admin xem tất cả)
- Teams, Matches: ai cũng đọc được
- Bets: user xem bets mình, admin xem tất cả
- INSERT/UPDATE bets chỉ qua RPC (SECURITY DEFINER)
- Edge Functions dùng `service_role` key → bypass RLS

---

## 6. Cách Chạy Project

### Prerequisites
- **Node.js** (LTS)
- **Expo Go** app trên điện thoại (hoặc Android/iOS emulator)
- **Supabase project** (đã setup DB + Edge Functions)
- **football-data.org API key** (free tier)

### Environment Variables (`.env`)
```env
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

### Chạy app
```bash
# 1. Install dependencies
npm install

# 2. Start Expo dev server
npm start          # hoặc: npx expo start

# 3. Mở trên điện thoại:
#    - Quét QR code bằng Expo Go app
#    - Hoặc chạy trên emulator: npm run android / npm run ios
```

### Setup Backend (Supabase)
```bash
# 1. Tạo DB schema
#    Copy nội dung supabase/schema.sql → chạy trong Supabase SQL Editor

# 2. Deploy Edge Functions
supabase functions deploy sync-matches
supabase functions deploy settle-bets

# 3. Seed admin account
#    Tạo user admin@betking.com qua Supabase Dashboard
#    Chạy SQL: UPDATE public.users SET role = 'admin' WHERE email = 'admin@betking.com';

# 4. Setup cron (cron-job.org)
#    URL: https://xxx.supabase.co/functions/v1/sync-matches
#    Interval: mỗi 5-10 phút
```

---

## 7. Luồng Chạy Chính (Data Flow)

### User đăng nhập → đặt cược
```
1. Mở app → check Supabase Auth session
2. Không có session → màn hình Login
3. Đăng nhập thành công → check is_banned → route theo role:
   - role = "user" → (user-tabs) — Home tab
   - role = "admin" → (admin-tabs) — Dashboard
4. User xem trận → app query matches + teams (PostgreSQL, qua RLS)
5. Tap trận → Match Detail → xem odds 5 loại kèo
6. Chọn kèo → Bottom Sheet hiện lên → nhập tiền cược → xem preview tiền thắng
7. Xác nhận → gọi RPC place_bet() → atomic: insert bet + trừ balance
8. Bet lưu status = PENDING, chờ trận kết thúc
```

### Auto sync & settle (background)
```
1. cron-job.org ping Edge Function "sync-matches" (mỗi 5-10 phút)
2. Edge Function gọi football-data.org API → lấy matches + standings
3. Upsert vào DB: teams (standings), matches (tỉ số, trạng thái)
4. Tính odds cho trận mới/cập nhật dựa trên thứ hạng 2 đội
5. Nếu trận chuyển sang FINISHED → trigger settle:
   - Lấy tất cả bets PENDING cho trận đó
   - So sánh bet_type + bet_choice vs kết quả thực tế
   - Đúng → WON, winnings = amount × odds, cộng vào balance
   - Sai → LOST
   - Tất cả trong 1 transaction (rollback nếu fail)
```

---

## 8. Scope & Giới Hạn

### ✅ Có trong v1
- Đăng ký / Đăng nhập (email + password)
- Nạp tiền ảo (không giới hạn)
- Xem danh sách trận + chi tiết + odds
- Đặt cược 5 loại kèo (1X2, tỉ số, tài/xỉu, BTTS, hiệp 1)
- Lịch sử cược (filter by status)
- Leaderboard (thắng nhiều / thua nhiều)
- Profile + thống kê cá nhân
- Admin: Dashboard, User Management, System Controls
- Auto sync matches + auto settle bets

### ❌ Không có trong v1
- Kèo chấp, kèo xiên (parlay)
- Live score realtime (WebSocket) — dùng poll/refresh
- Chat / social features
- Thanh toán tiền thật
- Push notifications
- Admin CRUD trận đấu (data từ API)
- Multiple leagues (chỉ Premier League)

### 🔮 Có thể mở rộng (v2)
- Thêm giải: La Liga, Bundesliga, Champions League
- Push notifications khi trận kết thúc
- Dark mode / theme switching

---

## 9. Danh Sách Tài Liệu Thiết Kế

Tất cả nằm trong `docs/`:

| File | Nội dung |
|------|---------|
| `01_PROBLEM.md` | Bài toán, vision, scope v1, data source |
| `02_USE_CASES.md` | 10 use cases user + 6 admin + 3 system auto |
| `03_UI_SCREENS.md` | 12 màn hình (9 user + 3 admin) + navigation map |
| `03_wireframe/` | ASCII wireframes cho từng screen |
| `04_BUSINESS_RULES.md` | 48 business rules (account, balance, betting, odds, settle...) |
| `05_DOMAIN_MODEL.md` | ERD: 4 entities + relationships |
| `06_ARCHITECTURE.md` | System architecture diagram + quyết định kỹ thuật |
| `07_TECH_STACK.md` | Dependencies với versions + lý do chọn |
| `08_API_CONTRACT.md` | Auth, queries, RPCs, Edge Functions, RLS |
| `09_DB_SCHEMA.md` | Full SQL: tables, indexes, RPCs, triggers, RLS, seed data |
| `10_UI_DESIGN_SYSTEM.md` | Colors, typography, icons, component patterns |
| `ROADMAP.md` | Lộ trình phát triển |
