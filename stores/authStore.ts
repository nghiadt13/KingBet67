import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { User } from '@/types/database';
import { Session } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
  fetchUserProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => {
  let _authListenerActive = false;

  return {
  session: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      set({ session, user: null, isAuthenticated: false });

      if (session) {
        await get().fetchUserProfile();
      }

      set({ isLoading: false });

      // Only subscribe once
      if (!_authListenerActive) {
        _authListenerActive = true;
        supabase.auth.onAuthStateChange(async (_event, session) => {
          set({ session, user: null, isAuthenticated: false });
          if (session) {
            await get().fetchUserProfile();
          } else {
            set({ user: null, isAuthenticated: false });
          }
        });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Check if banned
      await get().fetchUserProfile();
      const user = get().user;
      if (user?.is_banned) {
        await supabase.auth.signOut();
        set({ session: null, user: null, isAuthenticated: false });
        throw new Error('Tài khoản đã bị khóa');
      }
    } catch (err: any) {
      set({ error: err.message || 'Đăng nhập thất bại' });
    } finally {
      set({ isLoading: false });
    }
  },

  signUp: async (email: string, password: string, username: string) => {
    set({ isLoading: true, error: null });
    try {
      // Check username availability
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .maybeSingle();

      if (existing) {
        throw new Error('Username đã tồn tại');
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
        },
      });
      if (error) throw error;
      return true;
    } catch (err: any) {
      set({ error: err.message || 'Đăng ký thất bại' });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    await supabase.auth.signOut();
    set({ session: null, user: null, isAuthenticated: false, isLoading: false });
  },

  clearError: () => set({ error: null }),

  fetchUserProfile: async () => {
    const session = get().session;
    if (!session) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error) throw error;
      set({ user: data as User, isAuthenticated: true });
    } catch {
      // Profile not ready yet (trigger may be slow)
      set({ user: null, isAuthenticated: false });
    }
  },
}});
