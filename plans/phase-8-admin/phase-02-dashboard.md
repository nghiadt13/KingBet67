# Phase 2: S-A01 Admin Dashboard

## Context

- [Wireframe S-A01](file:///d:/works/vsc_test/docs/03_wireframe/S-A01_admin_dashboard.md)
- [API Contract: get_admin_stats](file:///d:/works/vsc_test/docs/08_API_CONTRACT.md#L265-L292)
- [Business Rules: Admin](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L138-L144)
- [Existing placeholder](file:///d:/works/vsc_test/app/(admin-tabs)/index.tsx)

## Overview

- **Priority:** P1
- **Status:** Pending
- **Effort:** ~1.5h

Replace placeholder → admin dashboard with stat cards, hottest match, top 5 users.

## UI Structure (from wireframe)

```
┌─────────────────────────────────┐
│  Admin Dashboard                 │  ← Tab header
├─────────────────────────────────┤
│                                  │
│  ┌──────────┐ ┌──────────┐     │
│  │  👥 42   │ │ 📋 1,234 │     │  ← 2×2 stat cards grid
│  │  Users   │ │  Bets    │     │
│  └──────────┘ └──────────┘     │
│  ┌──────────┐ ┌──────────┐     │
│  │ 💰 50M   │ │ ⏳ 156   │     │
│  │  Tiền    │ │ Pending  │     │
│  └──────────┘ └──────────┘     │
│                                  │
│  ── Trận hot nhất ─────────── │
│  ⚽ Arsenal vs Chelsea           │
│  89 bets                         │
│                                  │
│  ── Top 5 Users ──────────── │
│  1. username1     +2,500,000    │
│  2. username2     +1,800,000    │
│  ...                             │
│                                  │
├─────────────────────────────────┤
│ Tab bar                          │
└─────────────────────────────────┘
```

## File

### [MODIFY] `app/(admin-tabs)/index.tsx`

**Key elements:**

1. **Data fetching:**
```typescript
interface AdminStats {
  total_users: number;
  total_bets: number;
  total_money_circulation: number;
  pending_bets: number;
  hottest_match: {
    id: string;
    home_team_name: string;
    away_team_name: string;
    bet_count: number;
  } | null;
  top_users: { username: string; total_winnings: number }[];
}

const [stats, setStats] = useState<AdminStats | null>(null);
const [isLoading, setIsLoading] = useState(true);

const fetchStats = useCallback(async () => {
  setIsLoading(true);
  const { data } = await supabase.rpc("get_admin_stats" as never);
  if (data) setStats(data as AdminStats);
  setIsLoading(false);
}, []);

useFocusEffect(useCallback(() => { fetchStats(); }, [fetchStats]));
```

2. **Stat cards** (2×2 grid):

| Card | Icon | Label | Value | Color |
|------|------|-------|-------|-------|
| Users | `account-group` | Users | `total_users` | `#3B82F6` |
| Bets | `ticket-confirmation` | Total Bets | `total_bets` | `#8B5CF6` (purple) |
| Money | `cash-multiple` | Tiền lưu thông | `total_money_circulation` formatted | `#16A34A` |
| Pending | `clock-outline` | Pending Bets | `pending_bets` | `#F59E0B` |

```tsx
function StatCard({ icon, label, value, color }: {...}) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <MaterialCommunityIcons name={icon} size={24} color={color} />
      <Text style={styles.statNumber}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// Grid
<View style={styles.statsGrid}>
  <StatCard icon="account-group" label="Users" value={stats.total_users} color="#3B82F6" />
  <StatCard icon="ticket-confirmation" label="Total Bets" value={stats.total_bets} color="#8B5CF6" />
  <StatCard icon="cash-multiple" label="Tiền lưu thông" value={formatMoney(stats.total_money_circulation)} color="#16A34A" />
  <StatCard icon="clock-outline" label="Pending Bets" value={stats.pending_bets} color="#F59E0B" />
</View>
```

Grid styles: `flexDirection: "row", flexWrap: "wrap"`, each card `width: "48%"`.

3. **Hottest match:**
```tsx
{stats.hottest_match ? (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Trận hot nhất</Text>
    <View style={styles.hottestCard}>
      <MaterialCommunityIcons name="fire" size={20} color="#EF4444" />
      <Text style={styles.hottestMatch}>
        {stats.hottest_match.home_team_name} vs {stats.hottest_match.away_team_name}
      </Text>
      <Text style={styles.hottestCount}>{stats.hottest_match.bet_count} bets</Text>
    </View>
  </View>
) : null}
```

4. **Top 5 users:**
```tsx
<View style={styles.section}>
  <Text style={styles.sectionTitle}>Top 5 Users</Text>
  {stats.top_users.map((u, i) => (
    <View key={u.username} style={styles.topUserRow}>
      <Text style={styles.topUserRank}>{i + 1}.</Text>
      <Text style={styles.topUserName}>{u.username}</Text>
      <Text style={styles.topUserWin}>+{u.total_winnings.toLocaleString()}</Text>
    </View>
  ))}
  {stats.top_users.length === 0 && (
    <Text style={styles.emptyText}>Chưa có dữ liệu</Text>
  )}
</View>
```

**Design notes:**
- `ScrollView` wrapper (content can be long)
- Background: `#F8FAFC` (standard)
- Stat cards: white, borderRadius 14, left border 3px with accent color
- Sections: standard sectionTitle pattern (13px uppercase grey)

## Todo List

- [ ] Replace placeholder `index.tsx`
- [ ] Stat cards 2×2 grid (users, bets, money, pending)
- [ ] Hottest match card with fire icon
- [ ] Top 5 users ranked list
- [ ] `useFocusEffect` for auto-refresh
- [ ] Loading state
- [ ] Handle null hottest_match
- [ ] Format large numbers (abbreviate millions)

## Success Criteria

- Login as admin → Dashboard shows 4 stat cards
- Hottest match displayed (or hidden if no bets)
- Top 5 users with winnings
- Data refreshes on tab focus
