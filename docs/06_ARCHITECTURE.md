# System Architecture

> Dựa trên: [01_PROBLEM.md](./01_PROBLEM.md), [05_DOMAIN_MODEL.md](./05_DOMAIN_MODEL.md)

---

## Components

```
┌──────────────────┐     ┌──────────────────────────────────┐
│                  │     │           Supabase               │
│  Expo React      │     │  ┌────────────┐ ┌────────────┐  │
│  Native App      │────>│  │   Auth     │ │ PostgreSQL │  │
│  (Mobile)        │<────│  └────────────┘ └────────────┘  │
│                  │     │  ┌────────────┐                 │
└──────────────────┘     │  │   Edge     │                 │
                         │  │ Functions  │                 │
                         │  └─────┬──────┘                 │
                         └────────┼────────────────────────┘
                                  │
                         ┌────────┴────────┐
                         │ football-data   │
                         │ .org API        │
                         └─────────────────┘
                                  ▲
                         ┌────────┴────────┐
                         │  External Cron  │
                         │ (cron-job.org)  │
                         └─────────────────┘
```

---

## Flow dữ liệu

```
1. User mở app
   App ──> Supabase Auth ──> xác thực ──> trả session

2. User xem trận đấu
   App ──> Supabase PostgreSQL ──> query matches + teams ──> trả data

3. User đặt cược
   App ──> Supabase PostgreSQL ──> insert bet + update balance (transaction)

4. Auto Sync (mỗi 5-10 phút)
   External Cron ──> Edge Function ──> football-data.org API
                                   ──> update matches + teams trong DB
                                   ──> nếu trận FINISHED → settle bets

5. Admin Sync/Settle thủ công
   App ──> Edge Function ──> (giống flow 4)
```

---

## Decisions

| Quyết định                | Lý do                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------- |
| **Serverless (Supabase)** | Không cần quản lý server, free tier đủ xài, deploy nhanh                            |
| **PostgreSQL**            | Data quan hệ (User→Bet→Match→Team), cần JOIN + aggregate cho leaderboard/stats      |
| **Supabase Auth**         | Tích hợp sẵn, SDK React Native, không cần tự build auth                             |
| **Edge Functions**        | Xử lý sync/settle logic, gọi external API                                           |
| **External Cron**         | Supabase free tier không có pg_cron, dùng cron-job.org (free) trigger Edge Function |
| **Không dùng Realtime**   | Poll/refresh khi mở app là đủ, không cần WebSocket cho v1                           |
| **Monolith-style**        | 1 Supabase project chứa tất cả (auth + DB + functions), solo project không cần tách |

---

## Supabase sẽ dùng gì

| Feature                      | Dùng cho                                                    |
| ---------------------------- | ----------------------------------------------------------- |
| **Auth**                     | Đăng ký, đăng nhập, session, role                           |
| **PostgreSQL**               | Lưu User, Team, Match, Bet                                  |
| **Row Level Security (RLS)** | Phân quyền: user chỉ xem/sửa data của mình                  |
| **Edge Functions**           | Sync matches, settle bets, tính odds                        |
| **Supabase JS SDK**          | Frontend gọi DB trực tiếp (qua RLS) hoặc gọi Edge Functions |
