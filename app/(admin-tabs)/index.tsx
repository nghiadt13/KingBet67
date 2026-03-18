import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function AdminIndexRedirect() {
  const { session, user } = useAuthStore();

  if (!session || !user || user.role !== 'admin') {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(admin-tabs)/dashboard" />;
}
