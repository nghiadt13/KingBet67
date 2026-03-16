# Phase 05: Auth Guard + Role-based Routing

## Context

- [app/_layout.tsx](../../app/_layout.tsx) — Current root layout (Stack with 3 groups)
- Phase 1 pattern: ThemeProvider, StatusBar, useColorScheme

## Overview

- **Priority:** P1
- **Status:** Completed ✅
- **Effort:** 30m

Modify root layout: initialize auth, redirect based on session + role.

## Key Insights

- Pattern: `useSegments()` + `router.replace()` in root layout
- 3 states: no session → auth, user session → user-tabs, admin session → admin-tabs
- Loading state: show nothing (or splash) while checking session
- `initialize()` gọi 1 lần khi app mount
- `useEffect` watch session + user changes → redirect

## Related Code Files

| Action | File | Description |
|--------|------|-------------|
| Modify | `app/_layout.tsx` | Add auth guard logic |

## Implementation Steps

1. Modify `app/_layout.tsx`:

```typescript
import { useEffect } from 'react';
import { useSegments, useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const segments = useSegments();
  const router = useRouter();
  const { session, user, isLoading, initialize } = useAuthStore();

  // Initialize auth on mount (once)
  useEffect(() => {
    initialize();
  }, []);

  // Auth redirect logic
  useEffect(() => {
    if (isLoading) return;

    const inAuth = segments[0] === '(auth)';

    if (!session) {
      // Not logged in → go to auth
      if (!inAuth) {
        router.replace('/(auth)/login');
      }
    } else if (user) {
      // Logged in + user profile loaded → route by role
      if (user.role === 'admin') {
        if (segments[0] !== '(admin-tabs)') {
          router.replace('/(admin-tabs)');
        }
      } else {
        if (segments[0] !== '(user-tabs)') {
          router.replace('/(user-tabs)');
        }
      }
    }
    // If session exists but user is null → still loading user profile, wait
  }, [session, user, isLoading]);

  // Show loading while checking session
  if (isLoading) {
    return null; // hoặc SplashScreen
  }

  return (
    <ThemeProvider value={...}>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(user-tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(admin-tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="match/[id]" options={{ title: 'Match Detail' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
```

2. Key logic:
   - `!session && !inAuth` → redirect to login
   - `session && user?.role === 'admin'` → redirect to admin-tabs
   - `session && user?.role === 'user'` → redirect to user-tabs
   - `session && !user` → wait (user profile still loading)

3. Remove Supabase connection test from `(user-tabs)/index.tsx` (cleanup Phase 1 temporary code)

## Todo

- [x] Add auth imports to `_layout.tsx`
- [x] Call `initialize()` on mount
- [x] Add redirect logic based on session + user.role
- [x] Add loading state (return null while loading)
- [x] Remove Supabase connection test from Home screen
- [x] Verify: no flash of wrong screen on app start

## Success Criteria

- Cold start (no session) → Login screen
- Login as user → auto redirect to user-tabs
- Login as admin → auto redirect to admin-tabs
- Logout → redirect back to login
- App restart (session persisted) → auto redirect to correct tabs (no login screen flash)

## Risk Assessment

- **Medium:** Flash of login screen before redirect on warm start → mitigated by `return null` while loading
- **Low:** Segments not matching after redirect → verify `segments[0]` values with console.log
