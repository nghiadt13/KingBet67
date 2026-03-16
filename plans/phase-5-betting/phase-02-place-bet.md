# Phase 2: Bet Store + Place Bet Bottom Sheet (S-05)

## Context

- [Wireframe S-05](file:///d:/works/vsc_test/docs/03_wireframe/S-05_place_bet.md)
- [API Contract: place_bet](file:///d:/works/vsc_test/docs/08_API_CONTRACT.md#L182-L203)
- [UI Design System](file:///d:/works/vsc_test/docs/10_UI_DESIGN_SYSTEM.md)
- [Business Rules: Betting](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L33-L44)
- [Business Rules: Odds](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L75-L84)
- [Business Rules: Admin](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L138-L144)
- [Existing odds-section.tsx](file:///d:/works/vsc_test/components/odds-section.tsx)
- [Existing match/[id].tsx](file:///d:/works/vsc_test/app/match/[id].tsx)

## Overview

- **Priority:** P1
- **Status:** Pending
- **Effort:** ~2.5h

Core betting flow: tap odds button → open bottom sheet → enter amount → preview → confirm → done.

## UI Structure (from wireframe)

```
┌── Bottom Sheet ──────────────────┐
│  ── ─ ──                         │  ← Drag handle
│                                  │
│  ⚽ Arsenal vs Chelsea           │  ← Match info
│  Kèo: 1X2 — Home Win            │  ← Bet type + choice
│  Odds: @1.45                     │  ← Odds value
│                                  │
│  Số tiền cược:                   │
│  ┌──────────────────────────┐   │
│  │ 💰      100,000          │   │  ← Input (numeric keyboard)
│  └──────────────────────────┘   │
│                                  │
│  Tiền thắng:        145,000     │  ← amount × odds (realtime)
│  Số dư sau:         850,000     │  ← balance - amount (realtime)
│                                  │
│  ⚠ Số dư không đủ               │  ← Error (conditional)
│                                  │
│  ┌──────────────────────────┐   │
│  │       ĐẶT CƯỢC           │   │  ← Primary button
│  └──────────────────────────┘   │
│                                  │
└──────────────────────────────────┘
```

## Files

### [NEW] `stores/betStore.ts`

```typescript
import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { Bet, BetStatus, BetType } from "@/types/database";

// Joined bet with match info (for history)
export interface BetWithMatch extends Bet {
  match: {
    id: string;
    matchday: number;
    utc_date: string;
    status: string;
    home_score: number | null;
    away_score: number | null;
    home_team: { name: string; short_name: string; crest_url: string | null };
    away_team: { name: string; short_name: string; crest_url: string | null };
  };
}

// Place bet sheet state
interface BetSelection {
  matchId: string;
  matchLabel: string;  // "Arsenal vs Chelsea"
  betType: BetType;
  betTypeLabel: string; // "Kết quả trận (1X2)"
  betChoice: string;   // "home", "over", "1-0"
  betChoiceLabel: string; // "Arsenal", "Tài (>2.5)", etc.
  odds: number;
}

type HistoryFilter = "ALL" | "PENDING" | "WON" | "LOST";

interface BetState {
  // Place Bet sheet
  selection: BetSelection | null;
  isPlacing: boolean;
  placeError: string | null;
  placeSuccess: boolean;

  // Bet History (S-07)
  bets: BetWithMatch[];
  isLoadingBets: boolean;
  historyFilter: HistoryFilter;

  // Actions
  openBetSheet: (selection: BetSelection) => void;
  closeBetSheet: () => void;
  placeBet: (amount: number) => Promise<boolean>;
  fetchBetHistory: () => Promise<void>;
  setHistoryFilter: (filter: HistoryFilter) => void;
}
```

**Key logic:**

```typescript
placeBet: async (amount) => {
  const sel = get().selection;
  if (!sel) return false;

  set({ isPlacing: true, placeError: null });

  const { data, error } = await supabase.rpc("place_bet", {
    p_match_id: sel.matchId,
    p_bet_type: sel.betType,
    p_bet_choice: sel.betChoice,
    p_amount: amount,
  });

  if (error) {
    // Map RPC error codes to Vietnamese messages
    const msg = mapBetError(error.message);
    set({ placeError: msg, isPlacing: false });
    return false;
  }

  set({ isPlacing: false, placeSuccess: true });
  return true;
}
```

**Error mapping:**

```typescript
function mapBetError(code: string): string {
  if (code.includes("MATCH_NOT_OPEN"))
    return "Trận đã bắt đầu hoặc kết thúc, không thể đặt cược";
  if (code.includes("INSUFFICIENT_BALANCE"))
    return "Số dư không đủ";
  if (code.includes("INVALID_BET"))
    return "Kèo không hợp lệ";
  if (code.includes("USER_BANNED"))
    return "Tài khoản đã bị khóa";
  return "Đã xảy ra lỗi, vui lòng thử lại";
}
```

### [NEW] `components/place-bet-sheet.tsx`

Bottom sheet component sử dụng `@gorhom/bottom-sheet`.

```typescript
interface PlaceBetSheetProps {
  // No props needed — reads from betStore
}
```

**Key behavior:**

1. **Mount:** Listens to `betStore.selection` — if not null, snap to open
2. **Match info header:** Display match label + bet type + choice + odds
3. **Amount input:**
   - `TextInput` with `keyboardType="numeric"`
   - Format with thousand separators on display
   - Min: 1,000 coins (practical minimum)
   - Max: user's current balance
4. **Preview (realtime):**
   - `Tiền thắng: ${Math.round(amount * odds).toLocaleString()}`
   - `Số dư sau: ${(balance - amount).toLocaleString()}`
   - Update on every keystroke
5. **Validation:**
   - `amount <= 0` → disable button
   - `amount > balance` → show error "Số dư không đủ", disable button
   - `amount` not a number → disable button
6. **Submit:**
   - Call `betStore.placeBet(amount)`
   - On success: show success message (toast/alert) → close sheet → refresh balance
   - On error: display error from store
7. **Close:** Reset store selection

**Design tokens (from UI Design System):**
- Sheet background: `#FFFFFF`
- Handle bar: `#E2E8F0`, 40px wide, 4px height
- Match info: card style (no separate container needed)
- Amount input: standard Input pattern (52px height, radius 14, icon left)
- Preview text: `#64748B` label + `#1E293B` value
- Error: Error Box pattern (`#FEF2F2` bg + `alert-circle-outline`)
- Button: Primary Button pattern

**Bottom sheet config:**
```typescript
const snapPoints = useMemo(() => ["55%"], []);
// enablePanDownToClose={true}
// backdropComponent with opacity animation
```

### [MODIFY] `app/match/[id].tsx`

Wire `onSelectOdd` callbacks to open bet sheet.

**Changes:**
1. Import `useBetStore` + `PlaceBetSheet`
2. For each `OddsSection`, add `onSelectOdd`:

```typescript
const { openBetSheet } = useBetStore();
const user = useAuthStore((s) => s.user);

// Guard: admin cannot bet (BR-K02)
const canBet = user?.role !== "admin";

// Handler factory
const handleSelectOdd = (
  betType: BetType,
  betTypeLabel: string,
  choice: string,
  choiceLabel: string,
  oddsValue: number,
) => {
  if (!canBet) return;
  openBetSheet({
    matchId: match.id,
    matchLabel: `${match.home_team.short_name} vs ${match.away_team.short_name}`,
    betType,
    betTypeLabel,
    betChoice: choice,
    betChoiceLabel: choiceLabel,
    odds: oddsValue,
  });
};

// Example: 1X2
<OddsSection
  title="Kết quả trận (1X2)"
  odds={odds.match_result}
  labels={{ home: homeTeam, draw: "Hòa", away: awayTeam }}
  columns={3}
  onSelectOdd={(choice, value) =>
    handleSelectOdd("match_result", "Kết quả trận (1X2)",
      choice, labels[choice], value)
  }
/>
```

3. Render `<PlaceBetSheet />` at bottom of screen

### [MODIFY] `components/odds-section.tsx` + `components/correct-score-grid.tsx`

Already have `onSelectOdd` / `onSelectScore` props — no changes needed. Just verify type compatibility.

### [MODIFY] `stores/authStore.ts`

Add `refreshBalance` action:

```typescript
refreshBalance: async () => {
  const userId = get().user?.id;
  if (!userId) return;
  const { data } = await supabase
    .from("users")
    .select("balance")
    .eq("id", userId)
    .single();
  if (data) {
    set((s) => ({ user: s.user ? { ...s.user, balance: data.balance } : null }));
  }
}
```

Called after successful bet placement + deposit.

## Installation Required

```bash
npx expo install @gorhom/bottom-sheet
```

> `react-native-gesture-handler` + `react-native-reanimated` already included in Expo SDK 54.

> **Alternative:** Nếu không muốn thêm dependency, dùng `Modal` với custom slide-up animation. Tuy nhiên `@gorhom/bottom-sheet` là standard cho RN và behavior (drag, snap, backdrop) tốt hơn rất nhiều.

## Todo List

- [ ] Install `@gorhom/bottom-sheet`
- [ ] Create `stores/betStore.ts` (selection, placeBet, error mapping)
- [ ] Create `components/place-bet-sheet.tsx` (bottom sheet UI)
- [ ] Wire `onSelectOdd` in `app/match/[id].tsx` → open sheet
- [ ] Wire `onSelectScore` in same file → open sheet for correct_score
- [ ] Amount input with numeric keyboard + thousand separator
- [ ] Preview: tiền thắng + số dư sau (realtime)
- [ ] Validation: amount > 0, <= balance
- [ ] Submit: call RPC `place_bet`
- [ ] Error display: map RPC error codes → Vietnamese
- [ ] Success: toast/alert + close sheet + refresh balance
- [ ] Admin guard: hide bet options for admin role (BR-K02)
- [ ] Add `refreshBalance` to `authStore.ts`

## Success Criteria

- Tap odds button → bottom sheet opens with correct info
- Enter amount → preview updates realtime
- Amount > balance → error shown, button disabled
- Submit → RPC call → bet created in DB → balance deducted → sheet closes
- Error cases show Vietnamese messages
- Admin user tapping odds → nothing happens (or disabled state)
- Balance in profile/header updates after successful bet
