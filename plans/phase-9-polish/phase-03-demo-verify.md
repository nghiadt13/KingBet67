# Phase 3: Demo Flow Verification

## Overview

- **Priority:** P2
- **Status:** Pending
- **Effort:** ~30min

Manual end-to-end test following the demo script. Not a code phase — this is a testing checklist.

## Demo Flow Script

### Flow 1: User Registration → Betting → Settlement

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open app | Loading splash → Login screen |
| 2 | Tap "Đăng ký" → Register | Create account → redirect to Home |
| 3 | Check Profile | Balance = 1,000,000 (default), stats = 0 |
| 4 | Browse matches | Match list with matchday navigation |
| 5 | Filter: "Sắp đá" | Only TIMED/SCHEDULED matches |
| 6 | Tap match → Detail | Scores/status + odds sections visible |
| 7 | Tap odds → Place bet | Bottom sheet: amount input, preview, confirm |
| 8 | Confirm bet | Success → balance decreased |
| 9 | Go to History tab | New bet shows as PENDING |
| 10 | Go to Profile tab | Stats: 1 total bet, 0 won, 0 lost, 1 pending |
| 11 | Deposit 500,000 | Success → balance increased |

### Flow 2: Admin Sync → Settlement

| Step | Action | Expected Result |
|------|--------|-----------------|
| 12 | Login as admin | Redirect to Admin Dashboard |
| 13 | Dashboard | 4 stat cards populated, top users shown |
| 14 | System → Sync Now | Result card: teams, matches, odds updated |
| 15 | System → Settle Now | Result card: bets settled (if any FINISHED) |
| 16 | Users tab | User list, search works, ban/unban works |

### Flow 3: Post-Settlement Verification

| Step | Action | Expected Result |
|------|--------|-----------------|
| 17 | Login as user | Redirect to Home |
| 18 | History tab | Settled bets show WON/LOST status |
| 19 | Profile | Stats updated: win rate, total winnings |
| 20 | Leaderboard | User appears in ranking |
| 21 | Check balance | WON bets: balance += winnings; LOST: no change |

### Flow 4: Edge Cases

| Step | Action | Expected Result |
|------|--------|-----------------|
| 22 | Admin bans user → user reopens app | Auto logout, "Tài khoản đã bị khóa" |
| 23 | Admin tries to bet | No odds shown / canBet = false |
| 24 | POSTPONED match detail | Info banner, no odds |
| 25 | Place bet with insufficient balance | Error: "Số dư không đủ" |
| 26 | Place bet on FINISHED match | Error: "Trận đấu không mở cược" |

## Bug Tracking Template

| # | Screen | Bug Description | Severity | Status |
|---|--------|-----------------|----------|--------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

> Fill in during demo testing. Fix all High/Medium severity bugs before submission.

## Success Criteria

- 🟢 All 26 demo steps pass
- 🟢 No crashes or blank screens
- 🟢 No unhandled errors in console
- 🟢 All business rules enforced (spot-check BR-K01, BR-B03, BR-G02)
