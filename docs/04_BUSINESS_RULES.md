# Business Rules

> **Living document** — cập nhật khi phát hiện rule mới trong quá trình implement.
> Dựa trên: [02_USE_CASES.md](./02_USE_CASES.md), [03_UI_SCREENS.md](./03_UI_SCREENS.md)

---

## Tài khoản (Account)

- **BR-A01:** Email phải unique trong hệ thống
- **BR-A02:** Username phải unique trong hệ thống
- **BR-A03:** Password tối thiểu 8 ký tự
- **BR-A04:** Confirm password phải khớp với password khi đăng ký
- **BR-A05:** Khi đăng ký thành công, balance khởi tạo = số tiền mặc định (TBD)
- **BR-A06:** User bị ban → không thể đăng nhập, hiển thị thông báo "Tài khoản đã bị khóa"
- **BR-A07:** User bị ban khi đang đăng nhập → session vẫn hoạt động cho đến khi logout hoặc token hết hạn (không force kick)
- **BR-A08:** Account admin được seed sẵn trong DB, không có chức năng đăng ký admin
- **BR-A09:** Phân biệt User và Admin bằng field `role` trong DB, cùng chung hệ thống đăng nhập

---

## Tiền ảo (Balance)

- **BR-B01:** Nạp tiền ảo: nhập số tiền → cộng thẳng vào balance, không giới hạn
- **BR-B02:** Số tiền nạp phải > 0
- **BR-B03:** Balance không bao giờ âm — mọi giao dịch trừ tiền phải check balance >= amount trước
- **BR-B04:** Khi đặt cược, tiền bị trừ ngay lập tức (không phải khi trận kết thúc)
- **BR-B05:** Khi thắng cược, tiền thưởng = amount × odds, cộng vào balance
- **BR-B06:** Khi thua cược, tiền đã trừ rồi, không cần làm gì thêm

---

## Cá cược (Betting)

- **BR-C01:** Chỉ được đặt cược khi trận ở trạng thái TIMED hoặc SCHEDULED (chưa bắt đầu)
- **BR-C02:** Không được đặt cược trận đang đá (IN_PLAY) hoặc đã kết thúc (FINISHED)
- **BR-C03:** Số tiền cược phải > 0
- **BR-C04:** Số tiền cược không được vượt quá balance hiện tại
- **BR-C05:** Có thể đặt nhiều kèo khác nhau cho cùng 1 trận (VD: vừa 1X2 vừa Tài/Xỉu)
- **BR-C06:** Có thể đặt cùng loại kèo nhiều lần cho cùng 1 trận (VD: 2 lần đặt Home Win với số tiền khác)
- **BR-C07:** Mỗi bet được lưu riêng biệt, có status riêng (PENDING / WON / LOST)
- **BR-C08:** Bet đã đặt thì không hủy được, không sửa được
- **BR-C09:** User bị ban vẫn giữ bets đang pending, chỉ không đăng nhập được

---

## Loại kèo (Bet Types)

- **BR-D01: 1X2 (Kết quả trận)**
  - Chọn: Home Win / Draw / Away Win
  - Kiểm tra: `score.fullTime.home` vs `score.fullTime.away`
  - Home > Away → Home Win, Home = Away → Draw, Home < Away → Away Win

- **BR-D02: Tỉ số chính xác**
  - Chọn từ danh sách tỉ số có sẵn (không nhập tự do)
  - Kiểm tra: `score.fullTime.home == X && score.fullTime.away == Y`
  - Odds cao hơn các kèo khác (khó đoán hơn)

- **BR-D03: Tài/Xỉu 2.5**
  - Tài: tổng bàn thắng > 2.5 (tức >= 3 bàn)
  - Xỉu: tổng bàn thắng <= 2.5 (tức <= 2 bàn)
  - Kiểm tra: `score.fullTime.home + score.fullTime.away`

- **BR-D04: BTTS (Both Teams To Score)**
  - Yes: cả 2 đội đều ghi ít nhất 1 bàn
  - No: có ít nhất 1 đội không ghi bàn
  - Kiểm tra: `score.fullTime.home >= 1 && score.fullTime.away >= 1`

- **BR-D05: Hiệp 1 (1X2)**
  - Giống 1X2 nhưng dựa trên tỉ số hiệp 1
  - Kiểm tra: `score.halfTime.home` vs `score.halfTime.away`

- **BR-D06: Tài/Xỉu 1.5**
  - Tài: tổng bàn thắng > 1.5 (tức >= 2 bàn)
  - Xỉu: tổng bàn thắng <= 1.5 (tức <= 1 bàn)
  - Kiểm tra: `score.fullTime.home + score.fullTime.away`

- **BR-D07: Tài/Xỉu 3.5**
  - Tài: tổng bàn thắng > 3.5 (tức >= 4 bàn)
  - Xỉu: tổng bàn thắng <= 3.5 (tức <= 3 bàn)
  - Kiểm tra: `score.fullTime.home + score.fullTime.away`

- **BR-D08: Kèo chấp (Spreads/Handicap)**
  - Chọn: Home hoặc Away
  - Line (mức chấp) được lưu trong odds JSON
  - Kiểm tra: `home_score + line` so với `away_score`
  - Nếu `home_score + line > away_score` → Home thắng
  - Nếu `home_score + line < away_score` → Away thắng
  - Nếu bằng nhau (push) → hoàn tiền (refund), status = CANCELLED

---

## Odds (Tỷ lệ cược)

- **BR-E01:** Odds lấy từ The Odds API khi có sẵn (h2h, totals multi-line, spreads), fallback tự tính dựa trên standings
- **BR-E02:** Đội thứ hạng cao hơn → odds thấp hơn (dễ thắng, lời ít)
- **BR-E03:** Đội thứ hạng thấp hơn → odds cao hơn (khó thắng, lời nhiều)
- **BR-E04:** Đội nhà có lợi thế, odds giảm nhẹ so với đội khách
- **BR-E05:** Odds tối thiểu = 1.10 (không bao giờ thấp hơn)
- **BR-E06:** Tỉ số chính xác có odds cao nhất (thường 5.0 - 50.0+)
- **BR-E07:** Odds được tính/fetch khi sync matches và lưu vào DB, không tính lại mỗi lần user xem
- **BR-E08:** Odds không thay đổi sau khi user đã đặt cược (bet lưu odds tại thời điểm đặt)
- **BR-E09:** Kèo chấp push (bằng nhau sau khi cộng chấp) → hoàn tiền (refund)

---

## Trận đấu (Matches)

- **BR-F01:** Data trận đấu lấy từ football-data.org API; odds lấy từ The Odds API + fallback tự tính
- **BR-F02:** Trạng thái trận: TIMED/SCHEDULED → IN_PLAY → FINISHED (do API quyết định)
- **BR-F03:** Trận POSTPONED (hoãn) → không cho đặt cược, hiển thị badge "Hoãn"
- **BR-F04:** Trận CANCELLED → nếu có bets pending → refund tiền cho tất cả bets
- **BR-F05:** Matchday hiện tại = `season.currentMatchday` từ API

---

## Settle Bets (Xử lý kết quả)

- **BR-G01:** Settle chỉ xảy ra khi trận chuyển sang FINISHED
- **BR-G02:** Mỗi bet chỉ settle 1 lần (PENDING → WON hoặc LOST, không đổi ngược lại)
- **BR-G03:** Auto settle: khi sync phát hiện trận FINISHED → tự động xử lý
- **BR-G04:** Manual settle: Admin bấm "Settle Now" → xử lý tất cả trận FINISHED chưa settle
- **BR-G05:** Settle phải atomic: trừ/cộng tiền + update status trong cùng 1 transaction
- **BR-G06:** Nếu settle fail giữa chừng → rollback, không cập nhật partial

---

## Leaderboard

- **BR-H01:** Xếp hạng theo tổng tiền thắng (tổng winnings, không phải balance)
- **BR-H02:** Tiền thắng = tổng (amount × odds) của tất cả bets WON
- **BR-H03:** Tab "Thua nhiều nhất" = xếp theo tổng tiền đã thua (tổng amount của bets LOST)
- **BR-H04:** User bị ban vẫn hiển thị trên leaderboard (data lịch sử)
- **BR-H05:** Vị trí bản thân luôn hiển thị ở footer (sticky)

---

## Thống kê cá nhân (Profile Stats)

- **BR-I01:** Tổng kèo = đếm tất cả bets (bao gồm PENDING + WON + LOST)
- **BR-I02:** 1 trận đặt 3 kèo = tính 3 bets
- **BR-I03:** Win rate = số kèo WON / (số kèo WON + số kèo LOST) × 100%
- **BR-I04:** Bets PENDING không tính vào win rate

---

## Sync (Đồng bộ dữ liệu)

- **BR-J01:** Auto sync chạy mỗi 5-10 phút (scheduler backend)
- **BR-J02:** Sync fetch matches + standings từ API → cập nhật DB
- **BR-J03:** Nếu phát hiện trận chuyển FINISHED → trigger auto settle
- **BR-J04:** Rate limit API: 10 requests/phút (free tier) → phải cache và gọi có kiểm soát
- **BR-J05:** Nếu API down hoặc timeout → giữ data cũ, retry lần sau, không crash app

---

## Admin

- **BR-K01:** Admin không thể ban chính mình
- **BR-K02:** Admin không được phép đặt cược, chỉ có chức năng quản lý
- **BR-K03:** Dashboard thống kê tính realtime từ DB, không cache
- **BR-K04:** "Trận hot nhất" = trận có nhiều bets nhất (đếm số bets, không phải tổng tiền)
