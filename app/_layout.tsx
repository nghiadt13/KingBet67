import { useEffect } from 'react';
import { Stack, useSegments, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { Colors } from '@/constants/colors';

export default function RootLayout() {
  const segments = useSegments();
  const router = useRouter();
  const { session, user, isLoading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  // Auth redirect logic
  useEffect(() => {
    if (isLoading) return;

    const inAuth = segments[0] === '(auth)';

    if (!session) {
      if (!inAuth) {
        router.replace('/(auth)/login');
      }
    } else if (user) {
      if (user.role === 'admin') {
        if (segments[0] !== '(admin-tabs)') {
          router.replace('/(admin-tabs)');
        }
      } else {
        if (segments[0] !== '(tabs)') {
          router.replace('/(tabs)');
        }
      }
    }
  }, [session, user, isLoading]);

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
