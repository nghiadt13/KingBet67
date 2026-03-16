# Problem & Vision

## Problem

Cần một project mobile app đủ phức tạp, có logic nghiệp vụ rõ ràng,
dữ liệu real-time từ API, và UI hấp dẫn để nộp đồ án môn học.

## Vision

App mô phỏng cá cược bóng đá với tiền ảo.
User dùng tiền ảo để đặt cược các trận đấu thật (data từ football-data.org API),
hệ thống tự tính odds dựa trên bảng xếp hạng và tự động trả thưởng khi trận kết thúc.
Bảng xếp hạng theo tổng tiền thắng được (winnings) — ai kiếm nhiều nhất = giỏi nhất,
và cũng có bảng "thua nhiều nhất" cho vui.

## Target Users

- **User**: đăng ký, đăng nhập, xem trận đấu, đặt cược,
  xem lịch sử, xem leaderboard, nạp tiền ảo.
- **Admin**: dashboard thống kê, quản lý users, trigger sync/settle thủ công.

## Scope v1

### LÀM:

- Đăng ký / Đăng nhập
- Nạp tiền ảo (nhập số, ấn nạp, cộng vào balance — không giới hạn)
- Xem danh sách trận đấu Premier League (lịch thi đấu, kết quả)
- Xem bảng xếp hạng giải đấu (standings từ API)
- Xem chi tiết trận đấu (thông tin 2 đội, odds)
- Đặt cược:
  - Kèo thắng/thua/hòa (1X2)
  - Kèo tỉ số chính xác
  - Kèo tài/xỉu 2.5 (tổng bàn thắng > 2.5 hay ≤ 2.5)
  - Kèo cả 2 đội ghi bàn (BTTS — Both Teams To Score)
  - Kèo kết quả hiệp 1 (1X2 dựa trên halfTime score)
- Tự động trả thưởng khi trận kết thúc (settle bets)
- Lịch sử cược cá nhân (pending / won / lost)
- Bảng xếp hạng người chơi (leaderboard theo tổng tiền thắng)
- Hồ sơ cá nhân (balance, thống kê thắng/thua)
- **Admin:** Dashboard thống kê (tổng users, bets, tiền, trận hot, top users)
- **Admin:** Quản lý users (xem danh sách, ban/unban)
- **Admin:** Nút Sync Now / Settle Now (trigger thủ công, bổ sung cho auto)
- **Auto:** Backend tự sync matches mỗi 5-10 phút + tự settle khi trận kết thúc

### KHÔNG LÀM (v1):

- Kèo chấp, kèo xiên (parlay)
- Live score realtime (WebSocket) — poll API định kỳ là đủ
- Chat, social features
- Thanh toán tiền thật
- Push notifications
- Admin CRUD trận đấu (data từ API, không cần tạo/xóa tay)
- Multiple leagues (chỉ Premier League)

### CÓ THỂ MỞ RỘNG (v2, nếu còn thời gian):

- Thêm các giải đấu khác (La Liga, Bundesliga, Champions League)
- Push notifications khi trận kết thúc
- Dark mode / theme switching

## Data Source

- **API:** [football-data.org](https://www.football-data.org/) (free tier)
- **Giải đấu:** Premier League (code: `PL`)
- **Data có sẵn:** matches, standings, scores (fullTime + halfTime), team info, crests
- **Odds:** Tự tính dựa trên standings (position, form) — không lấy odds từ API
- **Rate limit:** 10 requests/phút (free tier)
