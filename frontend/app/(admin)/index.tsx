import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT, WEIGHT, RADIUS, SHADOW } from '@/src/theme';
import { Loading } from '@/src/components/ui';
import { AppHeader } from '@/src/components/Header';
import { api } from '@/src/api';

export default function AdminOverview() {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setStats(await api.adminStats());
    } catch {
      /* ignore */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!stats) return <Loading />;

  const cards = [
    { label: 'Total Rides', value: stats.rides, icon: 'bicycle', color: COLORS.brandPrimary },
    { label: 'Total Orders', value: stats.orders, icon: 'basket', color: COLORS.brandSecondary },
    { label: 'Active Rides', value: stats.active_rides, icon: 'navigate', color: COLORS.info },
    { label: 'Active Orders', value: stats.active_orders, icon: 'time', color: COLORS.warning },
    { label: 'Customers', value: stats.customers, icon: 'people', color: COLORS.brandPrimary },
    { label: 'Drivers', value: stats.drivers, icon: 'car', color: COLORS.brandSecondary },
  ];

  return (
    <View style={styles.container}>
      <AppHeader title="Admin Overview" subtitle="Tagkawayan Ride & Pabili" dark />
      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />}
      >
        <View style={styles.onlineBanner}>
          <View style={styles.pulse} />
          <Text style={styles.onlineText}>
            {stats.online_drivers} driver{stats.online_drivers === 1 ? '' : 's'} online right now
          </Text>
        </View>

        <View style={styles.grid}>
          {cards.map((c) => (
            <View key={c.label} style={styles.statCard} testID={`stat-${c.label}`}>
              <View style={[styles.statIcon, { backgroundColor: c.color + '22' }]}>
                <Ionicons name={c.icon as any} size={22} color={c.color} />
              </View>
              <Text style={styles.statValue}>{c.value}</Text>
              <Text style={styles.statLabel}>{c.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  onlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.brandTertiary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.lg,
  },
  pulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.success },
  onlineText: { color: COLORS.onBrandTertiary, fontSize: FONT.base, fontWeight: WEIGHT.medium },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: SPACING.md },
  statCard: {
    width: '47.5%',
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
  },
  statIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md },
  statValue: { fontSize: 30, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  statLabel: { fontSize: FONT.base, color: COLORS.muted, marginTop: 2 },
});
