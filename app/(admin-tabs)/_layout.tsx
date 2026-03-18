import { Tabs, Redirect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';

export default function AdminTabsLayout() {
  const { session, user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.darkBg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.neonGreen} />
      </View>
    );
  }

  if (!session || !user || user.role !== 'admin') {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.navBg,
          borderTopColor: Colors.border,
          borderTopWidth: 0.5,
          height: 70,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.neonGreen,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="dashboard" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Users',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="system"
        options={{
          title: 'System',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="settings" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
