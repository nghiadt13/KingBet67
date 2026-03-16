# Use Cases / User Flows

> Dựa trên: [01_PROBLEM.md](./01_PROBLEM.md)
> 2 roles: **User**, **Admin**

---

## User

### Tài khoản & Tiền

- **UC-01: Đăng ký**
  - Nhập email, password, tên hiển thị
  - Tạo tài khoản, balance khởi tạo = số tiền mặc định (TBD)
  - Tự động đăng nhập sau khi đăng ký

- **UC-02: Đăng nhập**
  - Nhập email, password
  - Đăng nhập thành công → vào app

- **UC-03: Xem hồ sơ cá nhân**
  - Xem: tên, email, balance hiện tại
  - Thống kê: tổng số kèo đã đặt, số kèo thắng, số kèo thua, win rate, tổng tiền thắng
  - _Lưu ý: 1 trận đặt 3 kèo = tính 3 bets_

- **UC-04: Nạp tiền ảo**
  - Nhập số tiền muốn nạp
  - Ấn nút → cộng thẳng vào balance
  - Không giới hạn, không cần xác nhận

### Trận đấu

- **UC-05: Xem danh sách trận đấu**
  - Hiển thị các trận sắp diễn ra (TIMED/SCHEDULED)
  - Mỗi trận: logo 2 đội, tên đội, ngày giờ, matchday
  - Filter/tab: sắp diễn ra / đang diễn ra / đã kết thúc

- **UC-06: Xem chi tiết trận đấu**
  - Thông tin 2 đội (tên, logo, thứ hạng hiện tại, phong độ)
  - Odds cho từng loại kèo (1X2, tài/xỉu, BTTS, hiệp 1)
  - Tỉ số (nếu đã kết thúc hoặc đang diễn ra)
  - Nút đặt cược (nếu trận chưa bắt đầu)

- **UC-07: Xem bảng xếp hạng giải đấu (standings)**
  - Bảng xếp hạng Premier League từ API
  - Hiển thị: thứ hạng, tên đội, P/W/D/L, GD, Pts

### Cá cược

- **UC-08: Đặt cược**
  - Chọn trận (phải ở trạng thái TIMED/SCHEDULED, chưa bắt đầu)
  - Chọn loại kèo:
    - 1X2: chọn Home Win / Draw / Away Win
    - Tỉ số chính xác: nhập tỉ số (VD: 2-1)
    - Tài/xỉu 2.5: chọn Tài (> 2.5) hoặc Xỉu (≤ 2.5)
    - BTTS: chọn Yes hoặc No
    - Hiệp 1: chọn Home / Draw / Away
  - Có thể đặt **nhiều kèo khác nhau** cho cùng 1 trận
  - Nhập số tiền cược
  - Kiểm tra: đủ balance không? Trận chưa bắt đầu chưa?
  - Xác nhận → trừ tiền → lưu bet (status: PENDING)

- **UC-09: Xem lịch sử cược**
  - Danh sách tất cả bets của mình
  - Filter: All / Pending / Won / Lost
  - Mỗi bet: trận nào, loại kèo, đặt gì, số tiền, odds, status
  - Nếu Won: hiển thị số tiền thắng

### Xếp hạng

- **UC-10: Xem leaderboard người chơi**
  - Xếp hạng theo tổng tiền thắng (winnings)
  - Hiển thị: rank, tên, tổng thắng, win rate
  - Bonus: tab "thua nhiều nhất" cho vui

---

## Admin

### Tài khoản

- **UC-A01: Đăng nhập Admin**
  - Cùng hệ thống đăng nhập, phân biệt bằng role
  - Account admin được seed sẵn trong DB (không có đăng ký admin)
  - Redirect vào Admin Dashboard sau khi đăng nhập

### Dashboard

- **UC-A02: Xem Dashboard thống kê**
  - Tổng số users
  - Tổng số bets (all time)
  - Tổng tiền ảo đang lưu thông
  - Bets đang pending (chờ kết quả)
  - Trận đấu có nhiều người đặt cược nhất
  - Top 5 users giàu nhất (mini leaderboard)

### Quản lý Users

- **UC-A03: Xem danh sách users**
  - Hiển thị: tên, email, balance, tổng bets, trạng thái (active/banned)
  - Search theo tên hoặc email

- **UC-A04: Ban / Unban user**
  - Chọn user → ban (khóa đăng nhập) hoặc unban
  - User bị ban không thể đăng nhập

### Quản lý hệ thống

- **UC-A05: Trigger Sync Matches**
  - Bấm nút "Sync Now"
  - Fetch data mới nhất từ football-data.org API
  - Cập nhật trận đấu, tỉ số, trạng thái vào DB
  - Hiển thị: bao nhiêu trận được cập nhật
  - _Lưu ý: hệ thống cũng auto sync mỗi 5-10 phút_

- **UC-A06: Trigger Settle Bets**
  - Bấm nút "Settle Now"
  - Tìm tất cả trận FINISHED mà chưa settle
  - So kết quả với bets → cập nhật WON/LOST → cộng tiền cho người thắng
  - Hiển thị: bao nhiêu bets đã xử lý, tổng tiền thưởng
  - _Lưu ý: hệ thống cũng auto settle khi sync phát hiện trận kết thúc_

---

## Hệ thống (Auto, không cần user action)

- **UC-S01: Auto Sync Matches**
  - Backend scheduler chạy mỗi 5-10 phút
  - Fetch matches từ API → cập nhật DB
  - Nếu phát hiện trận chuyển sang FINISHED → trigger settle

- **UC-S02: Auto Settle Bets**
  - Khi trận chuyển FINISHED:
    - Lấy tất cả bets PENDING cho trận đó
    - So sánh từng bet với kết quả thực tế
    - Đúng → status = WON, cộng tiền (amount × odds)
    - Sai → status = LOST

- **UC-S03: Tính Odds**
  - Khi sync trận mới hoặc khi standings thay đổi
  - Dựa trên thứ hạng 2 đội (standings) + lợi thế sân nhà
  - Tính odds cho 5 loại kèo: 1X2, tỉ số, tài/xỉu, BTTS, hiệp 1
