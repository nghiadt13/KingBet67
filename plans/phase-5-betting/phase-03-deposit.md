# Phase 3: Deposit (S-09 Profile)

## Context

- [Wireframe S-09](file:///d:/works/vsc_test/docs/03_wireframe/S-09_profile.md)
- [API Contract: deposit](file:///d:/works/vsc_test/docs/08_API_CONTRACT.md#L207-L221)
- [Business Rules: Balance](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L22-L30)
- [Existing profile.tsx](file:///d:/works/vsc_test/app/(user-tabs)/profile.tsx)

## Overview

- **Priority:** P1
- **Status:** Pending
- **Effort:** ~1h

Thêm section "Nạp tiền" vào Profile screen. Input + button → gọi RPC `deposit` → update balance.

## UI Structure

Thêm vào giữa info cards và logout button:

```
│  ... (existing info cards) ...    │
│                                   │
│  ── Nạp tiền ──────────────────  │
│  ┌──────────────────────────┐   │
│  │ 💰      500,000          │   │  ← Input (numeric)
│  └──────────────────────────┘   │
│  ┌──────────────────────────┐   │
│  │          NẠP TIỀN         │   │  ← Primary button
│  └──────────────────────────┘   │
│                                   │
│  ⚠ Error message                │  ← Conditional
│  ✅ Nạp thành công! Số dư: xxx  │  ← Conditional
│                                   │
│  ... (existing logout button) ... │
```

## Files

### [MODIFY] `app/(user-tabs)/profile.tsx`

**Add deposit section:**

1. **State:**
```typescript
const [depositAmount, setDepositAmount] = useState("");
const [isDepositing, setIsDepositing] = useState(false);
const [depositError, setDepositError] = useState<string | null>(null);
const [depositSuccess, setDepositSuccess] = useState<string | null>(null);
```

2. **Handler:**
```typescript
const handleDeposit = async () => {
  const amount = parseInt(depositAmount.replace(/\D/g, ""), 10);

  // Validate (BR-B02)
  if (!amount || amount <= 0) {
    setDepositError("Số tiền phải lớn hơn 0");
    return;
  }

  setIsDepositing(true);
  setDepositError(null);
  setDepositSuccess(null);

  const { data, error } = await supabase.rpc("deposit", { p_amount: amount });

  if (error) {
    setDepositError(
      error.message.includes("INVALID_AMOUNT")
        ? "Số tiền không hợp lệ"
        : "Đã xảy ra lỗi, thử lại"
    );
    setIsDepositing(false);
    return;
  }

  // Update local balance
  refreshBalance();
  setDepositSuccess(
    `Nạp thành công! Số dư: ${data.new_balance.toLocaleString()} coins`
  );
  setDepositAmount("");
  setIsDepositing(false);
};
```

3. **UI section** (insert before logout button):
```tsx
{/* Deposit Section */}
<View style={styles.depositSection}>
  <Text style={styles.sectionTitle}>Nạp tiền</Text>
  <View style={styles.inputRow}>
    <MaterialCommunityIcons name="wallet-plus-outline" size={20} color="#9BA1A6" />
    <TextInput
      style={styles.depositInput}
      placeholder="Nhập số tiền"
      keyboardType="numeric"
      value={depositAmount}
      onChangeText={setDepositAmount}
    />
  </View>
  <TouchableOpacity
    style={[styles.depositButton, isDepositing && { opacity: 0.6 }]}
    onPress={handleDeposit}
    disabled={isDepositing}
  >
    {isDepositing ? (
      <ActivityIndicator color="#fff" />
    ) : (
      <Text style={styles.depositButtonText}>Nạp tiền</Text>
    )}
  </TouchableOpacity>

  {depositError && (
    <View style={styles.errorBox}>
      <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#DC2626" />
      <Text style={styles.errorText}>{depositError}</Text>
    </View>
  )}
  {depositSuccess && (
    <View style={styles.successBox}>
      <MaterialCommunityIcons name="check-circle-outline" size={16} color="#16A34A" />
      <Text style={styles.successText}>{depositSuccess}</Text>
    </View>
  )}
</View>
```

4. **New styles:**
- `depositSection`: `marginBottom: 24`
- `sectionTitle`: 13px, uppercase, `#94A3B8`, letterSpacing 0.5, marginBottom 10
- `inputRow`: same as auth input pattern (52px, radius 14, `#F8FAFC` bg, border `#E2E8F0`)
- `depositButton`: Primary Button pattern (`#3B82F6`, 48px)
- `errorBox`: Error Box pattern
- `successBox`: similar to error but `#F0FDF4` bg, `#16A34A` text

### [MODIFY] `stores/authStore.ts`

Add `refreshBalance` action (if not already added in Phase 2):

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
    set((s) => ({
      user: s.user ? { ...s.user, balance: data.balance } : null,
    }));
  }
},
```

## Todo List

- [ ] Add deposit UI section to `profile.tsx`
- [ ] Deposit input (numeric, thousand separator display)
- [ ] Deposit button (Primary Button pattern)
- [ ] Call RPC `deposit` on submit
- [ ] Error handling (INVALID_AMOUNT → Vietnamese)
- [ ] Success message with new balance
- [ ] Refresh balance in authStore after deposit
- [ ] Loading state (ActivityIndicator)
- [ ] Clear input after success

## Success Criteria

- Input amount → press "Nạp tiền" → balance increases in DB
- Profile's balance card updates after deposit
- Error: amount <= 0 → "Số tiền phải lớn hơn 0"
- Loading spinner while depositing
- Success message shows new balance
