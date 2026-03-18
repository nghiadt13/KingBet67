import { useEffect } from 'react';
import { Stack, useSegments, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { useAuthStore } from '@/stores/authStore';
import { Colors } from '@/constants/colors';

export default function RootLayout() {
  const segments = useSegments();
  const router = useRouter();
  const { session, user, isLoading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
    SystemUI.setBackgroundColorAsync(Colors.navBg);
  }, []);

  // Auth redirect logic — only redirect admins; guests browse freely
  useEffect(() => {
    if (isLoading) return;

    const inAuth = segments[0] === '(auth)';
    const inAdmin = segments[0] === '(admin-tabs)';

    if (session && user) {
      // Admin → redirect to admin panel
      if (user.role === 'admin') {
        if (!inAdmin) {
          router.replace('/(admin-tabs)/dashboard');
        }
      } else if (inAdmin) {
        // Non-admin user inside admin area → back to main tabs
        router.replace('/(tabs)');
      } else if (inAuth) {
        // Logged-in user on auth page → go to main tabs
        router.replace('/(tabs)');
      }
    } else if (!session && !inAuth) {
      // Guest user — let them browse (tabs) freely, no redirect
      if (inAdmin) {
        router.replace('/(tabs)');
      } else if (segments[0] !== '(tabs)' && segments[0] !== 'match' && segments[0] !== 'leaderboard') {
        router.replace('/(tabs)');
      }
    }
  }, [session, user, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.darkBg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.neonGreen} />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(admin-tabs)" />
        <Stack.Screen
          name="match/[id]"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="leaderboard"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
