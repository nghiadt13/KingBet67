# Phase 02: Auth Store (Zustand)

## Context

- [lib/supabase.ts](../../lib/supabase.ts) — Supabase client singleton
- [types/database.ts](../../types/database.ts) — User type
- Phase 1 pattern: imports use `@/` path alias

## Overview

- **Priority:** P1
- **Status:** Not Started ⏳
- **Effort:** 45m

Zustand store quản lý auth state: session, user profile, loading, errors.

## Key Insights

- **Không dùng Zustand persist** — Supabase đã persist session qua AsyncStorage
- Store chỉ giữ in-memory state, init bằng cách check existing session
- `onAuthStateChange` listener là source of truth
- User profile (public.users row) fetch riêng sau auth — auth.users ≠ public.users
- `fetchUser` có retry logic cho case trigger chưa chạy xong (race condition)

## Related Code Files

| Action | File | Description |
|--------|------|-------------|
| Create | `stores/authStore.ts` | Zustand auth store |

## Implementation Steps

1. Tạo `stores/authStore.ts`:

```typescript
import { create } from "zustand";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { User } from "@/types/database";

interface AuthState {
  session: Session | null;
  user: User | null;     // public.users row (NOT auth.users)
  isLoading: boolean;
  error: string | null;
  
  // Actions
  initialize: () => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isLoading: true,
  error: null,

  initialize: async () => {
    // 1. Get existing session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      // Fetch user profile
      await fetchUserProfile(session.user.id, set);
    }
    
    set({ session, isLoading: false });
    
    // 2. Subscribe to auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      set({ session });
      
      if (event === 'SIGNED_IN' && session) {
        await fetchUserProfile(session.user.id, set);
      }
      if (event === 'SIGNED_OUT') {
        set({ user: null });
      }
    });
  },

  signUp: async (email, password, username) => {
    set({ error: null, isLoading: true });
    
    // Pre-validate username
    const { data: available } = await supabase.rpc('check_username_available', {
      p_username: username,
    });
    if (!available) {
      set({ error: 'Username đã tồn tại', isLoading: false });
      return;
    }
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    
    if (error) {
      set({ error: error.message, isLoading: false });
      return;
    }
    // onAuthStateChange will handle the rest
    set({ isLoading: false });
  },

  signIn: async (email, password) => {
    set({ error: null, isLoading: true });
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      set({ error: error.message, isLoading: false });
      return;
    }
    // onAuthStateChange will handle session + fetchUser
    // Ban check happens in fetchUserProfile
    set({ isLoading: false });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null });
  },

  clearError: () => set({ error: null }),
}));

// Helper: fetch public.users + ban check
async function fetchUserProfile(
  userId: string,
  set: (state: Partial<AuthState>) => void,
) {
  // Retry up to 3 times (trigger may not have run yet after signUp)
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (data) {
      // Ban check (BR-A06)
      if (data.is_banned) {
        await supabase.auth.signOut();
        set({ error: "Tài khoản đã bị khóa", session: null, user: null });
        return;
      }
      set({ user: data });
      return;
    }

    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 500)); // wait 500ms before retry
    }
  }
  // If all retries fail, user profile doesn't exist yet — unusual but handle gracefully
  console.warn("[Auth] Could not fetch user profile after 3 attempts");
}
```

2. Key patterns to follow (from existing codebase):
   - Import paths: `@/lib/supabase`, `@/types/database`
   - TypeScript strict: no `any` types
   - Comments in English, user-facing strings in Vietnamese

## Todo

- [x] Tạo `stores/authStore.ts`
- [x] Export `useAuthStore` hook
- [x] Include: initialize, signUp, signIn, signOut, clearError
- [x] Include: fetchUserProfile with retry + ban check
- [x] No persist middleware (Supabase handles persistence)

## Success Criteria

- `useAuthStore()` returns typed state
- `initialize()` restores existing session on app startup
- `signUp()` pre-validates username → calls Supabase signUp
- `signIn()` → fetches user profile → checks banned
- `signOut()` → clears state

## Risk Assessment

- **High:** Race condition signUp → trigger → fetchUser. Mitigated by retry logic.
- **Medium:** onAuthStateChange fires multiple times. OK — fetchUserProfile is idempotent.
