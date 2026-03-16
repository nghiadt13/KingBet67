# Phase 2: S-08 Leaderboard Screen

## Context

- [Wireframe S-08](file:///d:/works/vsc_test/docs/03_wireframe/S-08_leaderboard.md)
- [API Contract: get_leaderboard](file:///d:/works/vsc_test/docs/08_API_CONTRACT.md#L225-L239)
- [Business Rules: Leaderboard](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L109-L115)
- [UI Design System](file:///d:/works/vsc_test/docs/10_UI_DESIGN_SYSTEM.md)
- [Existing placeholder](file:///d:/works/vsc_test/app/(user-tabs)/leaderboard.tsx)

## Overview

- **Priority:** P1
- **Status:** Pending
- **Effort:** ~2h

Replace placeholder → full leaderboard with 2 tabs + ranked list + sticky footer.

## UI Structure (from wireframe)

```
┌─────────────────────────────────┐
│  Bảng xếp hạng                  │  ← Tab header
├─────────────────────────────────┤
│ Thắng nhiều │ Thua nhiều        │  ← 2 tabs
├─────────────────────────────────┤
│                                 │
│  🏆 1.  player1    +2,500,000  │  ← Gold medal row
│  🥈 2.  player2    +1,800,000  │  ← Silver medal row
│  🥉 3.  player3    +1,200,000  │  ← Bronze medal row
│     4.  player4      +900,000  │
│     5.  player5      +750,000  │
│     ...                         │
│                                 │
├─────────────────────────────────┤
│  📍 Bạn: #12       +320,000   │  ← Sticky footer
├─────────────────────────────────┤
│ Tab bar                         │
└─────────────────────────────────┘
```

> Wireframe dùng emoji nhưng AGENTS.md: **không dùng emoji làm icons**. Dùng `MaterialCommunityIcons` thay thế.

## Files

### [MODIFY] `app/(user-tabs)/leaderboard.tsx`

Replace placeholder → full screen.

**Key elements:**

1. **Tab buttons** (same pill pattern as history filter tabs):
   - "Thắng nhiều" | "Thua nhiều"
   - `type` state: `"winners"` | `"losers"`

2. **Data fetching:**
```typescript
const [type, setType] = useState<"winners" | "losers">("winners");
const [data, setData] = useState<LeaderboardEntry[]>([]);
const [myRank, setMyRank] = useState<MyRank | null>(null);
const [isLoading, setIsLoading] = useState(true);

// Interfaces
interface LeaderboardEntry {
  username: string;
  total: number;
}
interface MyRank {
  rank: number;
  username: string;
  total: number;
}

const fetchLeaderboard = useCallback(async () => {
  setIsLoading(true);
  const { data: result } = await supabase.rpc("get_leaderboard" as never, {
    p_type: type,
    p_limit: 50,
  } as never);
  if (result) {
    const r = result as { leaderboard: LeaderboardEntry[]; my_rank: MyRank | null };
    setData(r.leaderboard ?? []);
    setMyRank(r.my_rank);
  }
  setIsLoading(false);
}, [type]);

// Fetch on tab change
useEffect(() => {
  fetchLeaderboard();
}, [fetchLeaderboard]);

// Refresh on screen focus
useFocusEffect(
  useCallback(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]),
);
```

3. **Leaderboard row component:**
```typescript
function LeaderboardRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  // Top 3 get medal icons
  const medalIcon = rank === 1 ? "medal-outline" : rank === 2 ? "medal-outline" : rank === 3 ? "medal-outline" : null;
  const medalColor = rank === 1 ? "#F59E0B" : rank === 2 ? "#94A3B8" : rank === 3 ? "#CD7F32" : undefined;
  // Gold, Silver, Bronze colors

  return (
    <View style={[styles.row, rank <= 3 && styles.topRow]}>
      {/* Rank */}
      <View style={styles.rankContainer}>
        {rank <= 3 ? (
          <MaterialCommunityIcons name="medal" size={22} color={medalColor} />
        ) : (
          <Text style={styles.rankText}>{rank}</Text>
        )}
      </View>
      {/* Username */}
      <Text style={styles.username} numberOfLines={1}>{entry.username}</Text>
      {/* Total */}
      <Text style={[styles.total, type === "winners" ? styles.totalWin : styles.totalLost]}>
        {type === "winners" ? "+" : "-"}{entry.total.toLocaleString()}
      </Text>
    </View>
  );
}
```

4. **FlatList:**
```tsx
<FlatList
  data={data}
  keyExtractor={(_, i) => String(i)}
  renderItem={({ item, index }) => (
    <LeaderboardRow entry={item} rank={index + 1} />
  )}
  contentContainerStyle={styles.listContent}
  showsVerticalScrollIndicator={false}
  refreshing={isLoading}
  onRefresh={fetchLeaderboard}
  ListEmptyComponent={<EmptyState />}
/>
```

5. **Sticky footer** (absolutely positioned at bottom, above tab bar):
```tsx
{myRank && (
  <View style={styles.myRankFooter}>
    <MaterialCommunityIcons name="map-marker" size={16} color="#3B82F6" />
    <Text style={styles.myRankLabel}>
      Bạn: #{myRank.rank}
    </Text>
    <Text style={styles.myRankTotal}>
      {type === "winners" ? "+" : "-"}{myRank.total.toLocaleString()}
    </Text>
  </View>
)}
```

**Design tokens:**
- Row height: ~52px
- Top 3 rows: slightly highlighted background
- Gold medal: `#F59E0B`
- Silver: `#94A3B8`
- Bronze: `#CD7F32`
- Rank text: `#94A3B8`, 14px, fontWeight 600
- Username: `#1E293B`, 15px, fontWeight 600
- Total (winners): `#16A34A` (green)
- Total (losers): `#DC2626` (red)
- My rank footer: white card, shadow, sticky bottom, 52px height
- Tabs: same pill pattern as history/match filters

**Empty state:**
- Icon: `trophy-outline`
- Text: "Chưa có dữ liệu xếp hạng"

## Todo List

- [ ] Replace placeholder `leaderboard.tsx`
- [ ] 2 tab buttons (winners/losers)
- [ ] Fetch `get_leaderboard` RPC on tab change
- [ ] `useFocusEffect` for auto-refresh
- [ ] FlatList with ranked rows
- [ ] Top 3 medal icons (gold/silver/bronze)
- [ ] Amount display (+green for winners, -red for losers)
- [ ] Sticky footer with own rank
- [ ] Pull-to-refresh
- [ ] Empty state
- [ ] Loading indicator

## Success Criteria

- 2 tabs switch between winners/losers
- List sorted by total descending
- Top 3 get medal colors
- Own rank shown in sticky footer
- Pull-to-refresh works
- Tab change refetches data
- Empty state when no data
