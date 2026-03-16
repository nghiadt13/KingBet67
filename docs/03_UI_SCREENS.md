# UI Screens

> Dựa trên: [02_USE_CASES.md](./02_USE_CASES.md)
> Tổng: 12 màn hình (9 User + 3 Admin)
> Wireframes: [03_wireframe/](./03_wireframe/)

---

## Navigation

```
User:   Login/Register → Tab Bar:
        ├── 🏠 Home (Match List)     ← S-03
        ├── 🏆 Standings             ← S-06
        ├── 📋 Bet History           ← S-07
        ├── 🥇 Leaderboard          ← S-08
        └── 👤 Profile              ← S-09

        Match List → tap trận → Match Detail (S-04) → Place Bet (S-05)

Admin:  Login → Tab Bar:
        ├── 📊 Dashboard            ← S-A01
        ├── 👥 Users                ← S-A02
        └── ⚙️ System              ← S-A03
```

---

## User Screens

### S-01: Login

- **Wireframe:** [S-01_login.md](./03_wireframe/S-01_login.md)
- HIỂN THỊ: Logo app, input email, input password, validate errors, button đăng nhập, link đăng ký
- HÀNH ĐỘNG: Nhập email + password → đăng nhập. Thành công → Home (S-03), admin → Dashboard (S-A01)

---

### S-02: Register

- **Wireframe:** [S-02_register.md](./03_wireframe/S-02_register.md)
- HIỂN THỊ: Logo app, input username (unique), email, password, confirm password, validate errors, button đăng ký, link đăng nhập
- HÀNH ĐỘNG: Nhập thông tin → đăng ký → tự động đăng nhập → Home (S-03)

---

### S-03: Home (Match List)

- **Wireframe:** [S-03_match_list.md](./03_wireframe/S-03_match_list.md)
- HIỂN THỊ: Header (tên app + matchday), filter tabs (Đang đá / Sắp đá / Kết thúc), matchday selector, danh sách match cards (logo, tên đội, trạng thái, tỉ số hoặc giờ đá)
- MẶC ĐỊNH: Tab "Đang đá" lên đầu, sau đó "Sắp đá"
- HÀNH ĐỘNG: Chuyển tab, chuyển matchday, tap card → Match Detail (S-04)

---

### S-04: Match Detail

- **Wireframe:** [S-04_match_detail.md](./03_wireframe/S-04_match_detail.md)
- HIỂN THỊ: Thông tin 2 đội (logo, tên, thứ hạng), tỉ số (fullTime + halfTime), trạng thái, 5 nhóm kèo với odds (1X2, Tài/Xỉu, BTTS, Hiệp 1, Tỉ số chính xác)
- HÀNH ĐỘNG: Tap kèo → Place Bet (S-05). Trận đã/đang đá → ẩn phần cược
- LƯU Ý: Tỉ số chính xác mặc định hiện 5-6 cái, nút "Xem thêm" mở rộng. Chỉ chọn, không nhập tự do

---

### S-05: Place Bet (Bottom Sheet)

- **Wireframe:** [S-05_place_bet.md](./03_wireframe/S-05_place_bet.md)
- HIỂN THỊ: Kèo đã chọn (tên trận + loại kèo + odds), input số tiền, preview tiền thắng (realtime), preview balance sau khi đặt, validate errors
- HÀNH ĐỘNG: Nhập tiền → xem preview → ấn "Đặt cược" → trừ tiền → lưu bet → đóng sheet

---

### S-06: Standings

- **Wireframe:** [S-06_standings.md](./03_wireframe/S-06_standings.md)
- HIỂN THỊ: Bảng xếp hạng Premier League (logo, tên đội, P, W, D, L, GD, Pts — 20 đội)
- HÀNH ĐỘNG: Scroll xem

---

### S-07: Bet History

- **Wireframe:** [S-07_bet_history.md](./03_wireframe/S-07_bet_history.md)
- HIỂN THỊ: Filter tabs (All / Pending / Won / Lost), danh sách bet cards (tên trận, loại kèo, lựa chọn, odds, tiền đặt, tiền thắng, status, ngày)
- HÀNH ĐỘNG: Chuyển filter tab, scroll xem
- LƯU Ý: 1 kèo = 1 card. Cùng trận đặt 3 kèo = 3 card riêng biệt

---

### S-08: Leaderboard

- **Wireframe:** [S-08_leaderboard.md](./03_wireframe/S-08_leaderboard.md)
- HIỂN THỊ: 2 tabs (Thắng nhiều / Thua nhiều), ranked list (rank, username, tổng tiền), sticky footer vị trí bản thân
- HÀNH ĐỘNG: Chuyển tab, scroll xem

---

### S-09: Profile

- **Wireframe:** [S-09_profile.md](./03_wireframe/S-09_profile.md)
- HIỂN THỊ: Username + email, balance, thống kê (tổng kèo, thắng, thua, pending, win rate, tổng tiền thắng), khu vực nạp tiền, button đăng xuất
- HÀNH ĐỘNG: Nạp tiền (input + button), đăng xuất → Login (S-01)

---

## Admin Screens

### S-A01: Admin Dashboard

- **Wireframe:** [S-A01_admin_dashboard.md](./03_wireframe/S-A01_admin_dashboard.md)
- HIỂN THỊ: 4 stat cards (tổng users, tổng bets, tổng tiền, pending bets), trận hot nhất, top 5 users
- HÀNH ĐỘNG: Xem thống kê

---

### S-A02: User Management

- **Wireframe:** [S-A02_user_management.md](./03_wireframe/S-A02_user_management.md)
- HIỂN THỊ: Search bar, danh sách users (username, email, balance, status), button Ban/Unban
- HÀNH ĐỘNG: Search, ban/unban user

---

### S-A03: System Controls

- **Wireframe:** [S-A03_system_controls.md](./03_wireframe/S-A03_system_controls.md)
- HIỂN THỊ: Sync Matches (last sync, button Sync Now, kết quả), Settle Bets (pending count, button Settle Now, kết quả)
- HÀNH ĐỘNG: Ấn Sync Now, ấn Settle Now
- LƯU Ý: Cả 2 có auto chạy ngầm, nút bấm chỉ là trigger thủ công cho demo
