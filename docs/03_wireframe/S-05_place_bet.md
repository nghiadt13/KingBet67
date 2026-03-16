# S-05: Place Bet (Bottom Sheet)

> Hiện lên khi user tap chọn 1 kèo ở Match Detail (S-04)

```
┌─────────────────────────────────┐
│                                 │
│  (Match Detail phía sau, mờ)   │
│                                 │
│                                 │
│                                 │
├─ Bottom Sheet ──────────────────┤
│  ── ─ ──                        │  ← Drag handle
│                                 │
│  ⚽ Arsenal vs Chelsea          │
│  Kèo: 1X2 — Home Win           │
│  Odds: @1.45                    │
│                                 │
│  Số tiền cược:                  │
│  ┌─────────────────────────┐   │
│  │        100,000          │   │  ← Input số tiền
│  └─────────────────────────┘   │
│                                 │
│  💰 Tiền thắng:    145,000     │  ← amount × odds (realtime)
│  💳 Balance sau:   850,000     │  ← balance - amount (realtime)
│                                 │
│  ⚠️ Số dư không đủ              │  ← Validate (ẩn mặc định)
│                                 │
│  ┌─────────────────────────┐   │
│  │      ĐẶT CƯỢC          │   │
│  └─────────────────────────┘   │
│                                 │
└─────────────────────────────────┘
```
