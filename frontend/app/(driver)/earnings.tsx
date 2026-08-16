import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT, WEIGHT, RADIUS, SHADOW, peso } from '@/src/theme';
import { Loading } from '@/src/components/ui';
import { AppHeader } from '@/src/components/Header';
import { api } from '@/src/api';

export default function DriverEarnings() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api.driverEarnings());
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

  if (!data) return <Loading />;

  return (
    <View style={styles.container}>
      <AppHeader title="Earnings" subtitle="Your completed jobs" dark />
      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />}
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>TODAY'S EARNINGS</Text>
          <Text style={styles.heroValue}>{peso(data.today)}</Text>
          <Text style={styles.heroSub}>
            {data.count_today} completed job{data.count_today === 1 ? '' : 's'} today
          </Text>
        </View>

        <View style={styles.row}>
          <StatBox label="This Week" value={peso(data.week)} sub={`${data.count_week} jobs`} icon="calendar-outline" />
          <StatBox label="All Time" value={peso(data.total)} sub={`${data.count} jobs`} icon="wallet-outline" />
        </View>

        <View style={styles.ratingCard}>
          <View style={styles.ratingIcon}>
            <Ionicons name="star" size={26} color={COLORS.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ratingValue}>
              {data.rating_count > 0 ? `${Number(data.rating_avg).toFixed(1)} / 5.0` : 'No ratings yet'}
            </Text>
            <Text style={styles.ratingSub}>
              {data.rating_count > 0
                ? `Based on ${data.rating_count} customer rating${data.rating_count === 1 ? '' : 's'}`
                : 'Complete jobs to earn ratings'}
            </Text>
          </View>
        </View>

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.info} />
          <Text style={styles.noteText}>
            Earnings count your ride fares and pabili service fees from completed jobs. Item costs are paid by the customer.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function StatBox({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: any }) {
  return (
    <View style={styles.statBox}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={20} color={COLORS.brandPrimary} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  heroCard: { backgroundColor: COLORS.surfaceInverse, borderRadius: RADIUS.lg, padding: SPACING.xl, marginBottom: SPACING.md, ...SHADOW.card },
  heroLabel: { color: '#C7D0BC', fontSize: FONT.sm, letterSpacing: 1.5, fontWeight: WEIGHT.medium },
  heroValue: { color: '#fff', fontSize: 40, fontWeight: WEIGHT.medium, marginTop: SPACING.xs },
  heroSub: { color: '#C7D0BC', fontSize: FONT.base, marginTop: SPACING.xs },
  row: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  statBox: { flex: 1, backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, ...SHADOW.card },
  statIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.brandTertiary, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
  statValue: { fontSize: FONT.xl, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  statLabel: { fontSize: FONT.base, color: COLORS.onSurface, marginTop: 2 },
  statSub: { fontSize: FONT.sm, color: COLORS.muted, marginTop: 2 },
  ratingCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, ...SHADOW.card },
  ratingIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFF3D6', alignItems: 'center', justifyContent: 'center' },
  ratingValue: { fontSize: FONT.xl, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  ratingSub: { fontSize: FONT.base, color: COLORS.muted, marginTop: 2 },
  note: { flexDirection: 'row', gap: SPACING.sm, backgroundColor: COLORS.surfaceTertiary, padding: SPACING.md, borderRadius: RADIUS.md, marginTop: SPACING.lg },
  noteText: { flex: 1, color: COLORS.onSurfaceTertiary, fontSize: FONT.base, lineHeight: 20 },
});
