# Phase 2: Error Handling & UX Polish

## Context

- [Match store](file:///d:/works/vsc_test/stores/matchStore.ts) — no error state
- [Home screen](file:///d:/works/vsc_test/app/(user-tabs)/index.tsx) — uses `useEffect` not `useFocusEffect`
- [Leaderboard](file:///d:/works/vsc_test/app/(user-tabs)/leaderboard.tsx) — no error handling on fetch fail
- [History](file:///d:/works/vsc_test/app/(user-tabs)/history.tsx) — no error handling on fetch fail

## Overview

- **Priority:** P2
- **Status:** Pending
- **Effort:** ~1.5h

Add error states where missing, fix focus refresh, consistency pass.

## Files

### [MODIFY] `app/(user-tabs)/index.tsx` — Home screen focus refresh

**Problem:** Home uses `useEffect(() => { fetchMatches(); }, [])` — data stale when switching back from other tabs. Every other tab uses `useFocusEffect`.

**Fix:**
```tsx
import { useFocusEffect } from "expo-router";

// Replace:
useEffect(() => { fetchMatches(); }, []);

// With:
useFocusEffect(
  useCallback(() => {
    fetchMatches(currentMatchday);
  }, [currentMatchday]),
);
```

> Note: `fetchMatches` takes optional matchday. When refocusing, use current matchday to avoid resetting to default.

### [MODIFY] `stores/matchStore.ts` — Add error state

**Add error handling to store:**
```typescript
interface MatchState {
  // ... existing
  error: string | null;
  clearError: () => void;
}

// In fetchMatches:
fetchMatches: async (matchday?) => {
  set({ isLoadingMatches: true, error: null });
  const { data, error } = await supabase.from("matches").select(...);
  if (error) {
    set({ error: "Không thể tải danh sách trận đấu", isLoadingMatches: false });
    return;
  }
  // ... existing logic
},

// In fetchMatchDetail:
fetchMatchDetail: async (id) => {
  set({ isLoadingDetail: true, error: null });
  const { data, error } = await supabase.from("matches").select(...);
  if (error) {
    set({ error: "Không thể tải chi tiết trận đấu", isLoadingDetail: false });
    return;
  }
  // ... existing logic
},
```

### [MODIFY] `app/(user-tabs)/index.tsx` — Show error state

```tsx
const { error, clearError } = useMatchStore();

// After loading check, before FlatList:
{error && (
  <View style={styles.errorBanner}>
    <MaterialCommunityIcons name="wifi-off" size={18} color="#DC2626" />
    <Text style={styles.errorBannerText}>{error}</Text>
    <TouchableOpacity onPress={() => { clearError(); fetchMatches(currentMatchday); }}>
      <Text style={styles.retryText}>Thử lại</Text>
    </TouchableOpacity>
  </View>
)}
```

### [MODIFY] `app/(user-tabs)/leaderboard.tsx` — Error handling

```tsx
const [error, setError] = useState<string | null>(null);

const fetchLeaderboard = useCallback(async () => {
  setIsLoading(true);
  setError(null);
  const { data: result, error: fetchError } = await supabase.rpc(...);
  if (fetchError) {
    setError("Không thể tải bảng xếp hạng");
    setIsLoading(false);
    return;
  }
  // ... existing
}, [type]);

// In render: show error state similar to empty state
{error && (
  <View style={styles.center}>
    <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#FCA5A5" />
    <Text style={styles.emptyText}>{error}</Text>
    <TouchableOpacity onPress={fetchLeaderboard}>
      <Text style={styles.retryText}>Thử lại</Text>
    </TouchableOpacity>
  </View>
)}
```

### [MODIFY] `app/(user-tabs)/history.tsx` — Error handling

Same pattern as leaderboard.

### [MODIFY] `app/(user-tabs)/standings.tsx` — Error handling

Check if standings screen handles errors. If not, add same pattern.

### Styles for error/retry UI

```typescript
// Shared pattern for all screens:
errorBanner: {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: "#FEF2F2",
  borderRadius: 10,
  padding: 12,
  margin: 20,
  gap: 8,
},
errorBannerText: {
  flex: 1,
  fontSize: 13,
  color: "#DC2626",
},
retryText: {
  fontSize: 13,
  fontWeight: "600",
  color: "#3B82F6",
},
```

## Consistency Checklist

| Screen | Loading | Empty | Error | Pull-to-refresh | Focus refresh |
|--------|---------|-------|-------|-----------------|---------------|
| Home (matches) | ✅ | ✅ | ❌→Fix | ✅ | ❌→Fix |
| Standings | ✅ | ❌ Check | ❌ Check | ❌ Check | ❌ Check |
| History | ✅ | ✅ | ❌→Fix | ✅ | ✅ |
| Leaderboard | ✅ | ✅ | ❌→Fix | ✅ | ✅ |
| Profile | ✅ | ✅ | ✅ (deposit) | N/A | ✅ |
| Match Detail | ✅ | N/A | ❌ Check | N/A | N/A |
| Admin Dashboard | ✅ | ✅ | ❌ Check | N/A | ✅ |
| Admin Users | ✅ | ✅ | ✅ (Alert) | ✅ | ✅ |
| Admin System | ✅ | N/A | ✅ | N/A | N/A |

## Todo List

- [ ] Home: replace `useEffect` with `useFocusEffect`
- [ ] matchStore: add `error` state + handling
- [ ] Home: show error banner with retry
- [ ] Leaderboard: add error handling + retry
- [ ] History: add error handling + retry
- [ ] Standings: audit and fix if needed
- [ ] Admin Dashboard: audit and fix if needed
- [ ] Consistent error/retry styles

## Success Criteria

- All screens gracefully handle API failures
- Error state shows retry option
- Home tab refreshes data on focus
- No blank/stuck screens on network error
