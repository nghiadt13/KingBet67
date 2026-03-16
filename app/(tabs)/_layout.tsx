import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.navBg,
          borderTopColor: Colors.border,
          borderTopWidth: 0.5,
          height: 65,
          paddingBottom: 8,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarActiveTintColor: Colors.neonGreen,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trang chủ',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Trận đấu',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="sports-soccer" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bets"
        options={{
          title: 'Đơn cược',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="receipt-long" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Tôi',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
