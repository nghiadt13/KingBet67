# Implementation Roadmap

> **Nguyên tắc:** Dependency-first. Cái nào phải có trước thì làm trước.
> **Ước lượng:** ~9-11 sessions. Mỗi session = 1 buổi làm việc (2-3 giờ).
>
> Dựa trên tất cả documents trong `docs/`.

---

## Phase 1: Foundation

> Setup project, DB, navigation skeleton. Chưa có logic gì.

- [x] Tạo Expo project (SDK 54, TypeScript, Expo Router)
- [x] Cài dependencies (supabase-js, zustand, date-fns, async-storage)
- [x] Tạo Supabase project (Dashboard)
- [x] Chạy SQL: tạo 4 tables (users, teams, matches, bets) ✅
- [x] Chạy SQL: tạo indexes ✅
- [x] Chạy SQL: tạo helper function (is_admin) ✅
- [x] Setup Supabase client trong Expo (`lib/supabase.ts`)
- [x] Tạo tab navigation skeleton:
  - [x] User tabs: Home, Standings, Bet History, Leaderboard, Profile
  - [x] Admin tabs: Dashboard, Users, System
- [x] Các tab hiện placeholder text, chưa có UI thật
- [x] Verify: app chạy, tabs chuyển được, Supabase connect OK

---

## Phase 2: Auth

> Đăng ký, đăng nhập, đăng xuất. User profile tự tạo.

- [x] Chạy SQL: tạo DB trigger `on_auth_user_created`
- [x] Tạo Zustand auth store (`stores/authStore.ts`)
  - [x] State: user, session, isLoading, isAuthenticated
  - [x] Actions: signUp, signIn, signOut, checkBanned
- [x] Tạo màn hình Login (S-01)
  - [x] UI: logo, email input, password input, button, link register
  - [x] Validate: email/password trống, lỗi từ API
  - [x] Check banned sau login → sign out + thông báo
- [x] Tạo màn hình Register (S-02)
  - [x] UI: username, email, password, confirm password, button, link login
  - [x] Validate: username trùng, email trùng, password không khớp
- [x] Protected routes: redirect về Login nếu chưa đăng nhập
- [x] Route phân quyền: user → User tabs, admin → Admin tabs
- [ ] Tạo admin account (Supabase Dashboard + SQL update role)
- [ ] Verify: đăng ký → auto login → xem tabs → đăng xuất → login lại

---

## Phase 3: Data Sync

> Edge Function fetch data từ API, tính odds, lưu DB. Cron tự động.

- [x] Tạo Edge Function `sync-matches`
  - [x] Fetch `GET /v4/competitions/PL/matches` từ football-data.org
  - [x] Fetch `GET /v4/competitions/PL/standings` từ football-data.org
  - [x] Upsert teams: name, short_name, tla, crest_url, position, points, W/D/L, GD
  - [x] Upsert matches: status, scores, utc_date, matchday
  - [x] Logic tính odds dựa trên standings (position 2 đội + home advantage)
  - [x] Tính odds cho 5 loại kèo: match_result, over_under, btts, half_time, correct_score
  - [x] Lưu odds vào match.odds (JSONB)
  - [x] Return: { teams_updated, matches_updated }
- [ ] Deploy Edge Function lên Supabase (deferred — dùng local script)
- [x] Test: chạy `scripts/test-sync.ts` → 20 teams, 380 matches, 83 odds
- [ ] Setup cron (deferred — cần deploy Edge Function trước)
- [x] Verify: DB có 20 teams + 380 matches, 83 scheduled matches có odds

---

## Phase 4: Match Screens

> Hiển thị trận đấu, chi tiết, bảng xếp hạng giải.

- [x] S-03: Match List
  - [x] Fetch matches từ Supabase (join teams)
  - [x] Filter tabs: Đang đá / Sắp đá / Kết thúc
  - [x] Matchday selector (chuyển matchday)
  - [x] Match card component: logo 2 đội, tên, tỉ số/giờ đá, status badge
  - [x] Tap card → navigate đến Match Detail
- [x] S-04: Match Detail
  - [x] Fetch single match + team details
  - [x] Header: logo, tên, thứ hạng 2 đội
  - [x] Tỉ số fullTime + halfTime
  - [x] Trạng thái + ngày giờ
  - [x] Hiển thị 5 nhóm odds (1X2, tài/xỉu, BTTS, hiệp 1, tỉ số chính xác)
  - [x] Tỉ số chính xác: mặc định 6 cái + nút "Xem thêm"
  - [x] Ẩn phần odds nếu trận đã/đang đá
- [x] S-06: Standings
  - [x] Fetch teams order by position
  - [x] Bảng: #, logo, tên, P, GD, Pts + position color coding
- [x] Verify: mở app → thấy trận đấu, tap xem chi tiết, xem standings

---

## Phase 5: Betting

> Đặt cược, trừ tiền, nạp tiền.

- [x] Chạy SQL: tạo RPC `place_bet`
- [x] Chạy SQL: tạo RPC `deposit`
- [x] S-05: Place Bet (bottom sheet)
  - [x] Tap kèo ở Match Detail → mở bottom sheet
  - [x] Hiển thị: kèo đã chọn, odds
  - [x] Input số tiền
  - [x] Preview realtime: tiền thắng (amount × odds), balance sau đặt
  - [x] Validate: amount > 0, đủ balance
  - [x] Button "Đặt cược" → gọi RPC → thông báo thành công → đóng sheet
- [x] Nạp tiền (trong S-09 Profile, làm sớm để test)
  - [x] Input số tiền + button "Nạp"
  - [x] Gọi RPC `deposit` → cập nhật balance
- [x] S-07: Bet History screen (filter tabs, bet cards, pull-to-refresh)
- [ ] Verify: nạp tiền → đặt cược → tiền bị trừ → bet xuất hiện trong DB
- [ ] **Blocker:** Chạy SQL RPCs trên Supabase Dashboard trước khi test

---

## Phase 6: Settlement

> Xử lý kết quả: so sánh bet với tỉ số, cộng tiền thắng.

- [x] Tạo RPC `settle_match_bets` (atomic per-match settlement in SQL)
- [x] Tạo Edge Function `settle-bets` (thin orchestrator)
  - [x] Tìm matches FINISHED chưa settle
  - [x] Với mỗi match: gọi RPC → settle all PENDING bets
  - [x] So sánh bet_choice với kết quả thật (5 loại kèo)
  - [x] WON: update status, tính winnings, cộng balance
  - [x] LOST: update status
  - [x] Mark match is_settled = true
  - [x] Return: { matches_settled, bets_won, bets_lost, total_winnings }
- [x] Hook settle vào sync-matches: auto settle after sync
- [ ] **Blocker:** Chạy SQL `settle_match_bets` trên Supabase Dashboard
- [ ] **Blocker:** Deploy Edge Function `settle-bets` (supabase functions deploy)
- [ ] Verify: đặt cược → sync (trận kết thúc) → bet auto WON/LOST → tiền cộng

---

## Phase 7: User Features

> Lịch sử cược, leaderboard, profile đầy đủ.

- [x] Chạy SQL: tạo RPC `get_user_stats`
- [x] Chạy SQL: tạo RPC `get_leaderboard` (fixed: includes user's own rank)
- [x] Chạy SQL: tạo RLS policies cho 4 tables
- [x] S-07: Bet History (done in Phase 5)
  - [x] Fetch bets + match info (join)
  - [x] Filter tabs: All / Pending / Won / Lost
  - [x] Bet card: tên trận, loại kèo, lựa chọn, odds, tiền, status, ngày
  - [x] 1 kèo = 1 card
- [x] S-08: Leaderboard
  - [x] 2 tabs: Thắng nhiều / Thua nhiều
  - [x] Gọi RPC `get_leaderboard`
  - [x] Ranked list: rank, username, tổng tiền (medal icons top 3)
  - [x] Sticky footer: vị trí bản thân
- [x] S-09: Profile (hoàn thiện)
  - [x] Gọi RPC `get_user_stats`
  - [x] Hiển thị: username, email, balance card, thống kê section
  - [x] Nạp tiền (done in Phase 5)
  - [x] Button đăng xuất
- [ ] **Blocker:** Chạy SQL Phase 7 trên Supabase Dashboard
- [ ] Verify: đặt + settle xong → bet history đúng, leaderboard đúng, stats đúng

---

## Phase 8: Admin

> Dashboard, quản lý users, system controls.

- [x] Admin route guard (check `role === 'admin'`) — done in Phase 2
- [x] Chạy SQL: tạo RPC `get_admin_stats`
- [x] S-A01: Admin Dashboard
  - [x] 4 stat cards (users, bets, tiền, pending)
  - [x] Trận hot nhất
  - [x] Top 5 users
- [x] S-A02: User Management
  - [x] Fetch users list
  - [x] Search bar (username/email)
  - [x] Ban/Unban buttons
  - [x] Check: không ban chính mình (BR-K01)
- [x] S-A03: System Controls
  - [x] Button "Sync Now" → gọi Edge Function `sync-matches`
  - [x] Button "Settle Now" → gọi Edge Function `settle-bets`
  - [x] Hiển thị kết quả: bao nhiêu trận/bets đã xử lý
- [ ] **Blocker:** Chạy SQL `get_admin_stats` trên Supabase Dashboard
- [ ] Verify: login admin → dashboard hiện stats → ban user → sync → settle

---

## Phase 9: Polish

> Error handling, UX, edge cases, chuẩn bị demo.

- [x] Loading states (skeleton/spinner) cho tất cả screens
- [x] Error handling: API fail, network error → hiển thị thông báo + retry
- [x] Empty states: chưa có bets, chưa có matches
- [x] Pull-to-refresh cho Match List, Bet History, Leaderboard
- [x] Edge cases:
  - [x] Trận POSTPONED → info banner, không hiện odds (BR-F03)
  - [x] Trận CANCELLED → refund bets in settle_match_bets (BR-F04)
  - [x] User bị ban → check khi mở app (BR-A06) — done in Phase 2
- [x] UI polish: info banners with icons for all match statuses
- [x] Home screen: useFocusEffect (was useEffect)
- [x] Leaderboard: error handling + retry
- [ ] Test full demo flow (manual):
  1. Register → nạp tiền
  2. Xem trận → đặt cược nhiều kèo
  3. Admin sync → settle
  4. Xem bet history, leaderboard, profile stats
  5. Admin ban user → user bị lock
- [ ] Fix mọi bug phát hiện trong demo test

---

## Dependency Graph

```mermaid
graph TD
    P1[Phase 1: Foundation] --> P2[Phase 2: Auth]
    P1 --> P3[Phase 3: Data Sync]
    P2 --> P4[Phase 4: Match Screens]
    P3 --> P4
    P4 --> P5[Phase 5: Betting]
    P3 --> P6[Phase 6: Settlement]
    P5 --> P6
    P5 --> P7[Phase 7: User Features]
    P6 --> P7
    P2 --> P8[Phase 8: Admin]
    P6 --> P8
    P7 --> P9[Phase 9: Polish]
    P8 --> P9
```

> Phase 2 và 3 có thể làm song song (không phụ thuộc nhau).
> Mũi tên = "phải hoàn thành trước".
