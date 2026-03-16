# Phase 3: S-09 Profile — Stats Section

## Context

- [Wireframe S-09](file:///d:/works/vsc_test/docs/03_wireframe/S-09_profile.md)
- [API Contract: get_user_stats](file:///d:/works/vsc_test/docs/08_API_CONTRACT.md#L243-L261)
- [Business Rules: Profile Stats](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L119-L125)
- [Existing profile.tsx](file:///d:/works/vsc_test/app/(user-tabs)/profile.tsx)

## Overview

- **Priority:** P1
- **Status:** Pending
- **Effort:** ~1.5h

Enhance Profile screen: add "Thống kê" section between info cards and deposit.

## Current State

Profile screen currently has:
1. Avatar + username + "member since" ← keep
2. Info cards (username, email, balance) ← keep
3. Deposit section ← keep
4. Logout button ← keep

**Missing:** Stats section (wireframe shows this between balance and deposit)

## UI Structure (from wireframe)

```
│  ... (existing info cards) ...    │
│                                   │
│  ── 📊 Thống kê ────────────── │
│                                   │
│  ┌─────────────────────────────┐ │
│  │  Tổng kèo:         45      │ │
│  │  ✅ Thắng:    28   (62%)   │ │
│  │  ❌ Thua:     12           │ │
│  │  ⏳ Pending:   5           │ │
│  │  💵 Tổng thắng: +2,500,000│ │
│  └─────────────────────────────┘ │
│                                   │
│  ... (existing deposit section)   │
```

> No emojis → use `MaterialCommunityIcons`

## File

### [MODIFY] `app/(user-tabs)/profile.tsx`

**Add stats data fetching:**

```typescript
import { useFocusEffect } from "expo-router";

// Stats state
interface UserStats {
  total_bets: number;
  won_count: number;
  lost_count: number;
  pending_count: number;
  win_rate: number;
  total_winnings: number;
}

const [stats, setStats] = useState<UserStats | null>(null);
const [isLoadingStats, setIsLoadingStats] = useState(true);

const fetchStats = useCallback(async () => {
  setIsLoadingStats(true);
  const { data } = await supabase.rpc("get_user_stats" as never);
  if (data) setStats(data as UserStats);
  setIsLoadingStats(false);
}, []);

// Refresh on screen focus (balance might've changed from betting)
useFocusEffect(
  useCallback(() => {
    fetchStats();
    refreshBalance(); // keep balance up-to-date
  }, [fetchStats, refreshBalance]),
);
```

**Add stats UI section** (insert between cardContainer and depositSection):

```tsx
{/* Stats Section */}
<View style={styles.statsSection}>
  <Text style={styles.sectionTitle}>Thống kê</Text>
  {isLoadingStats ? (
    <ActivityIndicator color="#3B82F6" />
  ) : stats ? (
    <View style={styles.statsCard}>
      <StatRow
        icon="chart-bar"
        label="Tổng kèo đặt"
        value={stats.total_bets.toString()}
      />
      <StatRow
        icon="check-circle-outline"
        iconColor="#16A34A"
        label="Thắng"
        value={`${stats.won_count}`}
        extra={stats.win_rate > 0 ? `(${stats.win_rate}%)` : undefined}
        extraColor="#16A34A"
      />
      <StatRow
        icon="close-circle-outline"
        iconColor="#DC2626"
        label="Thua"
        value={`${stats.lost_count}`}
      />
      <StatRow
        icon="clock-outline"
        iconColor="#F59E0B"
        label="Đang chờ"
        value={`${stats.pending_count}`}
      />
      <View style={styles.statsDivider} />
      <StatRow
        icon="cash-multiple"
        iconColor="#16A34A"
        label="Tổng tiền thắng"
        value={`+${stats.total_winnings.toLocaleString()}`}
        valueColor="#16A34A"
        bold
      />
    </View>
  ) : (
    <Text style={styles.noStatsText}>Chưa có dữ liệu</Text>
  )}
</View>
```

**StatRow helper component** (inline or extracted):

```tsx
function StatRow({
  icon, iconColor, label, value, extra, extraColor, valueColor, bold
}: {
  icon: string;
  iconColor?: string;
  label: string;
  value: string;
  extra?: string;
  extraColor?: string;
  valueColor?: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.statRow}>
      <MaterialCommunityIcons
        name={icon as any}
        size={18}
        color={iconColor ?? "#64748B"}
      />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[
        styles.statValue,
        bold && { fontWeight: "700" },
        valueColor && { color: valueColor },
      ]}>
        {value}
      </Text>
      {extra && (
        <Text style={[styles.statExtra, extraColor && { color: extraColor }]}>
          {extra}
        </Text>
      )}
    </View>
  );
}
```

**New styles:**

```typescript
// Stats Section
statsSection: { marginBottom: 24 },
statsCard: {
  backgroundColor: "#FFFFFF",
  borderRadius: 14,
  padding: 16,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.04,
  shadowRadius: 3,
  elevation: 1,
},
statRow: {
  flexDirection: "row",
  alignItems: "center",
  paddingVertical: 8,
  gap: 10,
},
statLabel: {
  flex: 1,
  fontSize: 14,
  color: "#64748B",
},
statValue: {
  fontSize: 14,
  fontWeight: "600",
  color: "#1E293B",
},
statExtra: {
  fontSize: 12,
  color: "#94A3B8",
  marginLeft: 4,
},
statsDivider: {
  height: 1,
  backgroundColor: "#F1F5F9",
  marginVertical: 4,
},
noStatsText: {
  fontSize: 13,
  color: "#94A3B8",
  textAlign: "center",
  paddingVertical: 20,
},
```

### Optional Enhancement: Balance Card Upgrade

Replace the simple "Balance" info card with a more prominent display:

```tsx
// Instead of balance in the flat card list, show it as a prominent card:
<View style={styles.balanceCard}>
  <Text style={styles.balanceLabel}>Số dư</Text>
  <Text style={styles.balanceAmount}>
    {user?.balance.toLocaleString() ?? "0"} coins
  </Text>
</View>
```

With styles:
```typescript
balanceCard: {
  backgroundColor: "#EFF6FF",
  borderRadius: 14,
  padding: 20,
  alignItems: "center",
  marginBottom: 24,
  borderWidth: 1,
  borderColor: "#DBEAFE",
},
balanceLabel: { fontSize: 12, color: "#3B82F6", fontWeight: "600", textTransform: "uppercase" },
balanceAmount: { fontSize: 28, fontWeight: "800", color: "#1E293B", marginTop: 4 },
```

> This is optional — matches the wireframe where balance is shown prominently. Can also keep the current info card approach for consistency.

## Todo List

- [ ] Add `get_user_stats` RPC call on profile load
- [ ] `useFocusEffect` for stats refresh
- [ ] Stats section UI (card with icon rows)
- [ ] StatRow helper component (inline ok)
- [ ] Handle loading state (ActivityIndicator)
- [ ] Handle empty/null stats
- [ ] New styles for stats section
- [ ] Optional: upgrade balance display to prominent card

## Success Criteria

- Profile shows stats section: total bets, won/lost/pending counts, win rate, total winnings
- Stats refresh on tab focus
- Win rate shows percentage (BR-I03)
- PENDING bets excluded from win rate (BR-I04)
- Color coding: green for wins, red for losses, amber for pending
- Total winnings displayed in green with + prefix
