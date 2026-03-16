# Phase 3: S-A02 User Management

## Context

- [Wireframe S-A02](file:///d:/works/vsc_test/docs/03_wireframe/S-A02_user_management.md)
- [API Contract: Admin users list](file:///d:/works/vsc_test/docs/08_API_CONTRACT.md#L150-L162)
- [API Contract: Ban/Unban](file:///d:/works/vsc_test/docs/08_API_CONTRACT.md#L166-L176)
- [Business Rules: BR-K01](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L140) — admin cannot ban themselves
- [RLS: admin can read/update all users](file:///d:/works/vsc_test/supabase/schema.sql#L456-L458)
- [Existing placeholder](file:///d:/works/vsc_test/app/(admin-tabs)/users.tsx)

## Overview

- **Priority:** P1
- **Status:** Pending
- **Effort:** ~2h

Replace placeholder → full user list with search, ban/unban functionality.

## UI Structure (from wireframe)

```
┌─────────────────────────────────┐
│  Quản lý Users                   │
├─────────────────────────────────┤
│  ┌─────────────────────────┐    │
│  │ 🔍 Tìm username/email   │    │  ← Search input
│  └─────────────────────────┘    │
├─────────────────────────────────┤
│                                  │
│  ┌─────────────────────────┐    │
│  │ 👤 username1             │    │
│  │ 📧 user1@email.com      │    │
│  │ 💰 1,500,000   ● Active │    │
│  │                  [ Ban ] │    │  ← Ban button
│  └─────────────────────────┘    │
│                                  │
│  ┌─────────────────────────┐    │
│  │ 👤 username2             │    │
│  │ 📧 user2@email.com      │    │
│  │ 💰 800,000   🚫 Banned  │    │
│  │                [Unban]  │    │  ← Unban button
│  └─────────────────────────┘    │
│                                  │
│  ... (scroll)                    │
└─────────────────────────────────┘
```

## File

### [MODIFY] `app/(admin-tabs)/users.tsx`

**Key elements:**

1. **Data fetching:**
```typescript
import { User } from "@/types/database";

const [users, setUsers] = useState<User[]>([]);
const [searchQuery, setSearchQuery] = useState("");
const [isLoading, setIsLoading] = useState(true);
const adminId = useAuthStore((s) => s.user?.id);

const fetchUsers = useCallback(async () => {
  setIsLoading(true);
  let query = supabase
    .from("users")
    .select("*")
    .eq("role", "user")               // Only show regular users, not admin
    .order("created_at", { ascending: false });

  const { data } = await query;
  setUsers((data as User[]) ?? []);
  setIsLoading(false);
}, []);
```

2. **Client-side search** (simpler than server-side `.or(ilike)` for small dataset):
```typescript
const filteredUsers = useMemo(() => {
  if (!searchQuery.trim()) return users;
  const q = searchQuery.toLowerCase();
  return users.filter(
    (u) =>
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q),
  );
}, [users, searchQuery]);
```

> Alternative: server-side search with `.or(ilike)` per API Contract. But for student project with < 100 users, client-side is simpler and faster.

3. **Search input:**
```tsx
<View style={styles.searchRow}>
  <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
  <TextInput
    style={styles.searchInput}
    placeholder="Tìm username hoặc email"
    placeholderTextColor="#94A3B8"
    value={searchQuery}
    onChangeText={setSearchQuery}
    autoCapitalize="none"
  />
  {searchQuery.length > 0 && (
    <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={8}>
      <MaterialCommunityIcons name="close-circle" size={18} color="#CBD5E1" />
    </TouchableOpacity>
  )}
</View>
```

4. **User card component:**
```tsx
function UserCard({ user, isSelf, onToggleBan }: {
  user: User;
  isSelf: boolean;
  onToggleBan: (userId: string, ban: boolean) => void;
}) {
  return (
    <View style={styles.userCard}>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{user.username}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
        <View style={styles.userMeta}>
          <Text style={styles.userBalance}>
            {user.balance.toLocaleString()} coins
          </Text>
          {user.is_banned ? (
            <View style={styles.bannedBadge}>
              <MaterialCommunityIcons name="cancel" size={12} color="#DC2626" />
              <Text style={styles.bannedText}>Banned</Text>
            </View>
          ) : (
            <View style={styles.activeBadge}>
              <View style={styles.activeDot} />
              <Text style={styles.activeText}>Active</Text>
            </View>
          )}
        </View>
      </View>
      {/* Ban/Unban button — disabled for self (BR-K01) */}
      {!isSelf && (
        <TouchableOpacity
          style={user.is_banned ? styles.unbanBtn : styles.banBtn}
          onPress={() => onToggleBan(user.id, !user.is_banned)}
          activeOpacity={0.7}
        >
          <Text style={user.is_banned ? styles.unbanText : styles.banText}>
            {user.is_banned ? "Unban" : "Ban"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
```

5. **Ban/Unban handler:**
```typescript
const handleToggleBan = async (userId: string, ban: boolean) => {
  // BR-K01: cannot ban self
  if (userId === adminId) return;

  const { error } = await supabase
    .from("users")
    .update({ is_banned: ban })
    .eq("id", userId);

  if (error) {
    Alert.alert("Lỗi", error.message);
    return;
  }

  // Update local state
  setUsers((prev) =>
    prev.map((u) => (u.id === userId ? { ...u, is_banned: ban } : u)),
  );
};
```

6. **FlatList:**
```tsx
<FlatList
  data={filteredUsers}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => (
    <UserCard
      user={item}
      isSelf={item.id === adminId}
      onToggleBan={handleToggleBan}
    />
  )}
  contentContainerStyle={styles.listContent}
  showsVerticalScrollIndicator={false}
  refreshing={isLoading}
  onRefresh={fetchUsers}
  ListEmptyComponent={<EmptyState />}
/>
```

**Design tokens:**
- Search row: same input pattern (52px, radius 14, `#F8FAFC` bg)
- User card: white, radius 14, shadow, padding 16
- Username: 15px bold `#1E293B`
- Email: 13px `#64748B`
- Balance: 13px `#1E293B`
- Active badge: green dot (`#16A34A`) + "Active" text
- Banned badge: red cancel icon + "Banned" text
- Ban button: red outline (`#FEF2F2` bg, `#DC2626` text)
- Unban button: blue outline (`#EFF6FF` bg, `#3B82F6` text)

## Todo List

- [ ] Replace placeholder `users.tsx`
- [ ] Fetch all users (role = 'user')
- [ ] Search input (client-side filter by username/email)
- [ ] User cards with info (username, email, balance, status)
- [ ] Ban/Unban button per user
- [ ] BR-K01: cannot ban self (button hidden for admin's own row)
- [ ] Optimistic local state update on ban/unban
- [ ] Pull-to-refresh
- [ ] Empty state
- [ ] `useFocusEffect` for auto-refresh

## Success Criteria

- Admin sees list of all users (role = 'user')
- Search filters by username/email
- Ban button sets `is_banned = true`, unban reverses
- Admin cannot ban themselves (button hidden)
- Card shows Active/Banned status
- Pull-to-refresh works
