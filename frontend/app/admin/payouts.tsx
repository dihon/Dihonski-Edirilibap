import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { COLORS, SPACING, FONT, WEIGHT, RADIUS, SHADOW, peso } from '@/src/theme';
import { Button, useToast } from '@/src/components/ui';
import { AppHeader } from '@/src/components/Header';
import { api } from '@/src/api';

type Preset = 'all' | 'today' | 'week' | 'month';

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function rangeFor(preset: Preset): { date_from?: string; date_to?: string } {
  const now = new Date();
  const today = ymd(now);
  if (preset === 'today') return { date_from: today, date_to: today };
  if (preset === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return { date_from: ymd(start), date_to: today };
  }
  if (preset === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { date_from: ymd(start), date_to: today };
  }
  return {};
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Last 7 days' },
  { key: 'month', label: 'This month' },
];

export default function AdminPayouts() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [preset, setPreset] = useState<Preset>('all');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.adminPayouts(rangeFor(preset)));
    } catch (e: any) {
      toast(e.message || 'Could not load report', 'error');
    } finally {
      setLoading(false);
    }
  }, [preset]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const exportCsv = async () => {
    if (!data || !data.report.length) return toast('Nothing to export', 'info');
    setExporting(true);
    try {
      const header = 'Driver,Tricycle,Rides,Ride Earnings,Pabili,Pabili Earnings,Total\n';
      const lines = data.report
        .map(
          (r: any) =>
            `"${r.driver_name}","${r.tricycle_no || ''}",${r.rides},${r.ride_earnings},${r.orders},${r.pabili_earnings},${r.total}`,
        )
        .join('\n');
      const totals = `\n"TOTAL","",${data.totals.rides},${data.totals.ride_earnings},${data.totals.orders},${data.totals.pabili_earnings},${data.totals.total}`;
      const csv = header + lines + totals;

      if (Platform.OS === 'web') {
        toast('CSV export works on the mobile app', 'info');
        return;
      }
      const label = `${data.from || 'start'}_to_${data.to || 'now'}`.replace(/[^\w-]/g, '');
      const uri = `${FileSystem.cacheDirectory}payouts_${label}.csv`;
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Driver Payout Report', UTI: 'public.comma-separated-values-text' });
      } else {
        toast('Sharing not available on this device', 'error');
      }
    } catch (e: any) {
      toast(e.message || 'Could not export', 'error');
    } finally {
      setExporting(false);
    }
  };

  const totals = data?.totals;

  return (
    <View style={styles.container}>
      <AppHeader title="Driver Payouts" subtitle="Earnings report" back dark />

      <View style={styles.presetRow}>
        {PRESETS.map((p) => (
          <Pressable
            key={p.key}
            testID={`payout-preset-${p.key}`}
            onPress={() => setPreset(p.key)}
            style={[styles.chip, preset === p.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, preset === p.key && styles.chipTextActive]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>

      {loading && !data ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.brandPrimary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 120 }}
          showsVerticalScrollIndicator={false}
        >
          {totals ? (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>TOTAL PAYOUTS</Text>
              <Text style={styles.summaryValue}>{peso(totals.total)}</Text>
              <Text style={styles.summarySub}>
                {totals.drivers} driver{totals.drivers === 1 ? '' : 's'} · {totals.rides} rides · {totals.orders} pabili
              </Text>
              <View style={styles.summarySplit}>
                <View style={styles.splitBox}>
                  <Text style={styles.splitLabel}>Ride fares</Text>
                  <Text style={styles.splitVal}>{peso(totals.ride_earnings)}</Text>
                </View>
                <View style={styles.splitBox}>
                  <Text style={styles.splitLabel}>Pabili fees</Text>
                  <Text style={styles.splitVal}>{peso(totals.pabili_earnings)}</Text>
                </View>
              </View>
            </View>
          ) : null}

          {data?.report?.length ? (
            data.report.map((r: any) => (
              <View key={r.driver_id} style={styles.row} testID={`payout-row-${r.driver_id}`}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.driverName}>{r.driver_name}</Text>
                  <Text style={styles.driverMeta}>
                    {r.tricycle_no ? `${r.tricycle_no} · ` : ''}{r.rides} rides · {r.orders} pabili
                  </Text>
                </View>
                <Text style={styles.rowTotal}>{peso(r.total)}</Text>
              </View>
            ))
          ) : (
            <View style={styles.empty}>
              <Ionicons name="cash-outline" size={40} color={COLORS.muted} />
              <Text style={styles.emptyText}>No completed jobs in this period.</Text>
            </View>
          )}
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
        <Button
          testID="export-payouts-button"
          title="Export as CSV"
          icon="download-outline"
          onPress={exportCsv}
          loading={exporting}
          disabled={!data?.report?.length}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  chip: { height: 36, paddingHorizontal: SPACING.lg, borderRadius: RADIUS.pill, backgroundColor: COLORS.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: COLORS.brandPrimary },
  chipText: { fontSize: FONT.base, color: COLORS.muted, fontWeight: WEIGHT.medium },
  chipTextActive: { color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  summaryCard: { backgroundColor: COLORS.surfaceInverse, borderRadius: RADIUS.lg, padding: SPACING.xl, marginBottom: SPACING.lg, ...SHADOW.card },
  summaryLabel: { color: '#C7D0BC', fontSize: FONT.sm, letterSpacing: 1.5, fontWeight: WEIGHT.medium },
  summaryValue: { color: '#fff', fontSize: 36, fontWeight: WEIGHT.medium, marginTop: SPACING.xs },
  summarySub: { color: '#C7D0BC', fontSize: FONT.base, marginTop: SPACING.xs },
  summarySplit: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg },
  splitBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: RADIUS.md, padding: SPACING.md },
  splitLabel: { color: '#C7D0BC', fontSize: FONT.sm },
  splitVal: { color: '#fff', fontSize: FONT.lg, fontWeight: WEIGHT.medium, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  driverName: { fontSize: FONT.lg, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  driverMeta: { fontSize: FONT.sm, color: COLORS.muted, marginTop: 2 },
  rowTotal: { fontSize: FONT.lg, color: COLORS.brandPrimary, fontWeight: WEIGHT.medium },
  empty: { alignItems: 'center', paddingTop: SPACING['3xl'], gap: SPACING.md },
  emptyText: { fontSize: FONT.base, color: COLORS.muted },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.surfaceSecondary,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});
