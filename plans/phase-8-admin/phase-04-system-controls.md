# Phase 4: S-A03 System Controls

## Context

- [Wireframe S-A03](file:///d:/works/vsc_test/docs/03_wireframe/S-A03_system_controls.md)
- [API Contract: sync-matches](file:///d:/works/vsc_test/docs/08_API_CONTRACT.md#L298-L328)
- [API Contract: settle-bets](file:///d:/works/vsc_test/docs/08_API_CONTRACT.md#L332-L364)
- [Business Rules: Sync](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L128-L134)
- [Existing sync-matches](file:///d:/works/vsc_test/supabase/functions/sync-matches/index.ts)
- [Existing settle-bets](file:///d:/works/vsc_test/supabase/functions/settle-bets/index.ts)
- [Existing placeholder](file:///d:/works/vsc_test/app/(admin-tabs)/system.tsx)

## Overview

- **Priority:** P1
- **Status:** Pending
- **Effort:** ~1h

Replace placeholder → system controls: manual Sync Now + Settle Now buttons.

## UI Structure (from wireframe)

```
┌─────────────────────────────────┐
│  Hệ thống                       │
├─────────────────────────────────┤
│                                  │
│  ── Sync Matches ─────────────  │
│                                  │
│  ┌─────────────────────────┐    │
│  │      SYNC NOW           │    │  ← Primary button
│  └─────────────────────────┘    │
│                                  │
│  ✅ Result card (hidden)         │  ← Shows after sync
│  Teams: 20, Matches: 10         │
│  Odds: 5, Settled: 2            │
│                                  │
│  ── Settle Bets ──────────────  │
│                                  │
│  ┌─────────────────────────┐    │
│  │     SETTLE NOW          │    │  ← Primary button
│  └─────────────────────────┘    │
│                                  │
│  ✅ Result card (hidden)         │
│  Matches: 2, Won: 18, Lost: 27  │
│  Winnings: 2,300,000            │
│                                  │
└─────────────────────────────────┘
```

## File

### [MODIFY] `app/(admin-tabs)/system.tsx`

**Key elements:**

1. **State:**
```typescript
// Sync
const [isSyncing, setIsSyncing] = useState(false);
const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
const [syncError, setSyncError] = useState<string | null>(null);

// Settle
const [isSettling, setIsSettling] = useState(false);
const [settleResult, setSettleResult] = useState<SettleResult | null>(null);
const [settleError, setSettleError] = useState<string | null>(null);

interface SyncResult {
  teams_updated: number;
  matches_updated: number;
  odds_calculated: number;
  matches_settled: number;
  bets_settled: number;
  total_winnings: number;
  timestamp: string;
}

interface SettleResult {
  matches_settled: number;
  bets_won: number;
  bets_lost: number;
  total_winnings: number;
}
```

2. **Sync handler:**
```typescript
const handleSync = async () => {
  setIsSyncing(true);
  setSyncResult(null);
  setSyncError(null);

  const { data, error } = await supabase.functions.invoke("sync-matches");

  if (error) {
    setSyncError(error.message ?? "Sync thất bại");
    setIsSyncing(false);
    return;
  }

  setSyncResult(data as SyncResult);
  setIsSyncing(false);
};
```

3. **Settle handler:**
```typescript
const handleSettle = async () => {
  setIsSettling(true);
  setSettleResult(null);
  setSettleError(null);

  const { data, error } = await supabase.functions.invoke("settle-bets");

  if (error) {
    setSettleError(error.message ?? "Settle thất bại");
    setIsSettling(false);
    return;
  }

  setSettleResult(data as SettleResult);
  setIsSettling(false);
};
```

4. **UI layout:**
```tsx
<ScrollView style={styles.container} contentContainerStyle={styles.content}>
  {/* Sync Section */}
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Sync Matches</Text>
    <Text style={styles.sectionDesc}>
      Đồng bộ dữ liệu trận đấu từ football-data.org
    </Text>
    <TouchableOpacity
      style={[styles.actionBtn, isSyncing && { opacity: 0.6 }]}
      onPress={handleSync}
      disabled={isSyncing}
      activeOpacity={0.8}
    >
      {isSyncing ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          <MaterialCommunityIcons name="sync" size={20} color="#fff" />
          <Text style={styles.actionBtnText}>Sync Now</Text>
        </>
      )}
    </TouchableOpacity>

    {syncResult && (
      <View style={styles.resultCard}>
        <MaterialCommunityIcons name="check-circle" size={18} color="#16A34A" />
        <View style={styles.resultContent}>
          <Text style={styles.resultTitle}>Sync thành công</Text>
          <Text style={styles.resultDetail}>
            Teams: {syncResult.teams_updated} · Matches: {syncResult.matches_updated}
          </Text>
          <Text style={styles.resultDetail}>
            Odds: {syncResult.odds_calculated} · Settled: {syncResult.matches_settled}
          </Text>
        </View>
      </View>
    )}
    {syncError && <ErrorBox message={syncError} />}
  </View>

  {/* Settle Section */}
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Settle Bets</Text>
    <Text style={styles.sectionDesc}>
      Xử lý kết quả các trận FINISHED chưa settlement
    </Text>
    <TouchableOpacity
      style={[styles.actionBtn, styles.settleBtn, isSettling && { opacity: 0.6 }]}
      onPress={handleSettle}
      disabled={isSettling}
      activeOpacity={0.8}
    >
      {isSettling ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          <MaterialCommunityIcons name="calculator-variant" size={20} color="#fff" />
          <Text style={styles.actionBtnText}>Settle Now</Text>
        </>
      )}
    </TouchableOpacity>

    {settleResult && (
      <View style={styles.resultCard}>
        <MaterialCommunityIcons name="check-circle" size={18} color="#16A34A" />
        <View style={styles.resultContent}>
          <Text style={styles.resultTitle}>Settle thành công</Text>
          <Text style={styles.resultDetail}>
            Matches: {settleResult.matches_settled} · Won: {settleResult.bets_won} · Lost: {settleResult.bets_lost}
          </Text>
          <Text style={styles.resultDetail}>
            Tổng thưởng: {settleResult.total_winnings.toLocaleString()} coins
          </Text>
        </View>
      </View>
    )}
    {settleError && <ErrorBox message={settleError} />}
  </View>
</ScrollView>
```

5. **ErrorBox helper** (same pattern as other screens):
```tsx
function ErrorBox({ message }: { message: string }) {
  return (
    <View style={styles.errorBox}>
      <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#DC2626" />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}
```

**Design tokens:**
- Section: white card, radius 14, padding 20, marginBottom 16
- sectionTitle: 16px bold `#1E293B`
- sectionDesc: 13px `#64748B`, marginBottom 16
- Action button: Primary pattern but `height: 48`, `gap: 8`, icon + text
- Sync button: `#3B82F6` (primary)
- Settle button: `#8B5CF6` (purple — differentiate from sync)
- Result card: `#F0FDF4` bg, green check, padding 14, radius 10, marginTop 12
- Error box: standard error pattern

## Todo List

- [ ] Replace placeholder `system.tsx`
- [ ] Sync section: button + result display
- [ ] Settle section: button + result display
- [ ] Call `supabase.functions.invoke("sync-matches")`
- [ ] Call `supabase.functions.invoke("settle-bets")`
- [ ] Loading state (ActivityIndicator in button)
- [ ] Result cards showing operation details
- [ ] Error handling with error box
- [ ] ScrollView wrapper

## Success Criteria

- Sync Now button → calls Edge Function → shows result (teams/matches/odds updated)
- Settle Now button → calls Edge Function → shows result (bets won/lost, winnings)
- Error states displayed clearly
- Buttons disabled while loading
- Results persist until next action
