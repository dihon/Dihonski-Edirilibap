import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT, WEIGHT, RADIUS, SHADOW } from '@/src/theme';
import { Loading } from '@/src/components/ui';
import { AppHeader } from '@/src/components/Header';
import { api } from '@/src/api';

export default function AdminOverview() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
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
    { label: 'Total Rides', value: stats.rides, icon: 'bicycle', color: COLORS.brandPrimary, type: 'total_rides' },
    { label: 'Total Orders', value: stats.orders, icon: 'basket', color: COLORS.brandSecondary, type: 'total_orders' },
    { label: 'Active Rides', value: stats.active_rides, icon: 'navigate', color: COLORS.info, type: 'active_rides' },
    { label: 'Active Orders', value: stats.active_orders, icon: 'time', color: COLORS.warning, type: 'active_orders' },
    { label: 'Customers', value: stats.customers, icon: 'people', color: COLORS.brandPrimary, type: 'customers' },
    { label: 'Drivers', value: stats.drivers, icon: 'car', color: COLORS.brandSecondary, type: 'drivers' },
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

        <View style={styles.actions}>
          <Pressable
            testID="admin-applications-card"
            onPress={() => router.push('/admin/applications')}
            style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.9 }]}
          >
            <View style={[styles.actionIcon, { backgroundColor: COLORS.warning + '22' }]}>
              <Ionicons name="document-attach" size={22} color={COLORS.warning} />
            </View>
            <Text style={styles.actionTitle}>Driver Applications</Text>
            <Text style={styles.actionSub}>{stats.pending_applications} pending review</Text>
            {stats.pending_applications > 0 ? <View style={styles.dotBadge} /> : null}
          </Pressable>
          <Pressable
            testID="admin-complaints-card"
            onPress={() => router.push('/admin/complaints')}
            style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.9 }]}
          >
            <View style={[styles.actionIcon, { backgroundColor: COLORS.error + '22' }]}>
              <Ionicons name="flag" size={22} color={COLORS.error} />
            </View>
            <Text style={styles.actionTitle}>Complaints</Text>
            <Text style={styles.actionSub}>{stats.open_complaints} open</Text>
            {stats.open_complaints > 0 ? <View style={styles.dotBadge} /> : null}
          </Pressable>
        </View>

        <Pressable
          testID="admin-payouts-card"
          onPress={() => router.push('/admin/payouts')}
          style={({ pressed }) => [styles.payoutCard, pressed && { opacity: 0.9 }]}
        >
          <View style={[styles.actionIcon, { backgroundColor: COLORS.brandPrimary + '22', marginBottom: 0 }]}>
            <Ionicons name="cash" size={22} color={COLORS.brandPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Driver Payouts</Text>
            <Text style={styles.actionSub}>Earnings report · export CSV</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
        </Pressable>

        <Text style={styles.sectionTitle}>At a glance</Text>
        <View style={styles.grid}>
          {cards.map((c) => (
            <Pressable
              key={c.label}
              testID={`stat-${c.label}`}
              onPress={() => router.push(`/admin/list?type=${c.type}&title=${encodeURIComponent(c.label)}` as any)}
              style={({ pressed }) => [styles.statCard, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}
            >
              <View style={[styles.statIcon, { backgroundColor: c.color + '22' }]}>
                <Ionicons name={c.icon as any} size={22} color={c.color} />
              </View>
              <Text style={styles.statValue}>{c.value}</Text>
              <Text style={styles.statLabel}>{c.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.muted} style={styles.statChevron} />
            </Pressable>
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
  actions: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  payoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.xl,
    ...SHADOW.card,
  },
  actionCard: {
    flex: 1,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
  },
  actionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md },
  actionTitle: { fontSize: FONT.base, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  actionSub: { fontSize: FONT.sm, color: COLORS.muted, marginTop: 2 },
  dotBadge: { position: 'absolute', top: SPACING.md, right: SPACING.md, width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.error },
  sectionTitle: { fontSize: FONT.lg, color: COLORS.onSurface, fontWeight: WEIGHT.medium, marginBottom: SPACING.md },
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
  statChevron: { position: 'absolute', top: SPACING.lg, right: SPACING.md },
});
