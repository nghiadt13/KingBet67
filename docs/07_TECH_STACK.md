# Tech Stack

> Dựa trên: [06_ARCHITECTURE.md](./06_ARCHITECTURE.md)

---

## Frontend (Mobile App)

| Công nghệ                    | Version | Dùng cho                                              |
| ----------------------------- | ------- | ----------------------------------------------------- |
| **Expo**                      | SDK 54  | Framework React Native, build/deploy dễ               |
| **React Native**              | 0.81.5  | UI mobile cross-platform                              |
| **Expo Router**               | v4      | File-based navigation (tabs, stacks)                  |
| **TypeScript**                | 5.9     | Type safety                                           |
| **@supabase/supabase-js**     | 2.99.1  | Gọi Supabase (auth, DB, functions) từ app             |
| **Zustand**                   | 5.0.11  | State management (nhẹ, đơn giản hơn Redux)            |
| **date-fns**                  | 4.1     | Format ngày giờ                                       |

---

## Backend (Supabase)

| Công nghệ                 | Dùng cho                                              |
| -------------------------- | ----------------------------------------------------- |
| **Supabase Auth**          | Đăng ký, đăng nhập, JWT session                       |
| **PostgreSQL**             | Database chính (User, Team, Match, Bet)                |
| **Row Level Security**     | Phân quyền truy cập data ở DB level                   |
| **Edge Functions (Deno)**  | Sync matches, settle bets, tính odds                  |
| **Supabase Migrations**    | Quản lý schema changes                                |

---

## External Services

| Service                    | Dùng cho                                              |
| -------------------------- | ----------------------------------------------------- |
| **football-data.org API**  | Data trận đấu, tỉ số, standings Premier League        |
| **cron-job.org**           | Trigger sync Edge Function mỗi 5-10 phút (free)       |

---

## Dev Tools

| Tool                       | Dùng cho                                              |
| -------------------------- | ----------------------------------------------------- |
| **Expo Go**                | Test trên điện thoại thật khi dev                     |
| **Supabase CLI**           | Local dev, migrations, deploy Edge Functions           |
| **VS Code**                | Editor                                                |

---

## Lý do chọn

| Lựa chọn                  | Tại sao                                               | Thay thế đã cân nhắc       |
| -------------------------- | ----------------------------------------------------- | --------------------------- |
| **Expo Router**            | File-based routing, giống Next.js, dễ hiểu            | React Navigation (verbose)  |
| **Zustand**                | Nhẹ, boilerplate ít, đủ cho app này                   | Redux (overkill), Context (đủ nhưng verbose) |
| **Supabase Auth**          | Tích hợp sẵn, không cần tự build JWT/bcrypt           | Firebase Auth (NoSQL kéo theo), Better Auth  |
| **Edge Functions (Deno)**  | Serverless, chạy gần DB, deploy trong Supabase luôn   | Express server riêng (phải host) |
| **cron-job.org**           | Free, đơn giản, chỉ cần gọi 1 URL                    | pg_cron (cần paid plan), GitHub Actions |
| **TypeScript**             | FE + Edge Functions cùng ngôn ngữ, type safety        | JavaScript (thiếu types)   |
