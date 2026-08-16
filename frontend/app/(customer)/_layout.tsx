import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { COLORS, WEIGHT, FONT } from '@/src/theme';
import { useAuth } from '@/src/auth';
import { Redirect } from 'expo-router';

export default function CustomerLayout() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role === 'driver') return <Redirect href="/(driver)" />;
  if (user.role === 'admin') return <Redirect href="/(admin)" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.brandPrimary,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarStyle: {
          backgroundColor: COLORS.surfaceSecondary,
          borderTopColor: COLORS.border,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: FONT.sm, fontWeight: WEIGHT.medium },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
