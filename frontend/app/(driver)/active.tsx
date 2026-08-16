import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Linking, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  COLORS,
  SPACING,
  FONT,
  WEIGHT,
  RADIUS,
  peso,
  RIDE_FLOW,
  ORDER_FLOW,
  RIDE_STATUS,
  ORDER_STATUS,
} from '@/src/theme';
import { Button, Card, EmptyState, Badge, useToast, Loading } from '@/src/components/ui';
import { AppHeader } from '@/src/components/Header';
import { api } from '@/src/api';

export default function DriverActive() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [rides, setRides] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [payBusy, setPayBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = (await api.driverActive()) as any;
      setRides(res.rides || []);
      setOrders(res.orders || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const advance = async (type: 'ride' | 'order', item: any) => {
    const flow = type === 'ride' ? RIDE_FLOW : ORDER_FLOW;
    const idx = flow.indexOf(item.status);
    const next = flow[idx + 1];
    if (!next) return;
    setBusy(item.id);
    try {
      if (type === 'ride') await api.rideStatus(item.id, next);
      else await api.orderStatus(item.id, next);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (next === 'completed') toast('Job completed! 🎉', 'success');
      load();
    } catch (e: any) {
      toast(e.message || 'Could not update', 'error');
    } finally {
      setBusy(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const confirmPay = async (type: 'ride' | 'order', item: any) => {
    setPayBusy(item.id);
    try {
      await api.confirmPayment(type === 'ride' ? 'rides' : 'orders', item.id);
      toast('GCash payment confirmed', 'success');
      load();
    } catch (e: any) {
      toast(e.message || 'Could not confirm', 'error');
    } finally {
      setPayBusy(null);
    }
  };

  if (loading) return <Loading />;
  const empty = rides.length + orders.length === 0;

  return (
    <View style={styles.container}>
      <AppHeader title="My Jobs" subtitle="Active rides & deliveries" dark />
      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />}
      >
        {empty ? (
          <EmptyState
            testID="active-empty"
            icon="checkmark-done-outline"
            title="No active jobs"
            subtitle="Accepted rides and pabili orders will show here. Head to Dashboard to accept jobs."
          />
        ) : (
          <>
            {rides.map((r) => (
              <JobCard key={r.id} type="ride" item={r} busy={busy === r.id} payBusy={payBusy === r.id} onAdvance={() => advance('ride', r)} onConfirmPay={() => confirmPay('ride', r)} />
            ))}
            {orders.map((o) => (
              <JobCard key={o.id} type="order" item={o} busy={busy === o.id} payBusy={payBusy === o.id} onAdvance={() => advance('order', o)} onConfirmPay={() => confirmPay('order', o)} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function JobCard({
  type,
  item,
  onAdvance,
  busy,
  payBusy,
  onConfirmPay,
}: {
  type: 'ride' | 'order';
  item: any;
  onAdvance: () => void;
  busy: boolean;
  payBusy: boolean;
  onConfirmPay: () => void;
}) {
  const isRide = type === 'ride';
  const flow = isRide ? RIDE_FLOW : ORDER_FLOW;
  const map = isRide ? RIDE_STATUS : ORDER_STATUS;
  const idx = flow.indexOf(item.status);
  const next = flow[idx + 1];
  const meta = map[item.status];

  const nextLabel = next ? map[next].label : null;

  return (
    <Card testID={`job-${item.id}`} style={{ marginBottom: SPACING.md }}>
      <View style={styles.head}>
        <View style={[styles.tag, { backgroundColor: isRide ? COLORS.brandTertiary : '#FCE5D6' }]}>
          <Ionicons name={isRide ? 'bicycle' : 'basket'} size={16} color={isRide ? COLORS.brandPrimary : COLORS.brandSecondary} />
          <Text style={[styles.tagText, { color: isRide ? COLORS.onBrandTertiary : '#A04010' }]}>
            {isRide ? 'RIDE' : 'PABILI'}
          </Text>
        </View>
        {meta ? <Badge label={meta.label} color={meta.color} /> : null}
      </View>

      <Text style={styles.route}>
        {isRide ? `${item.pickup} → ${item.dropoff}` : item.delivery_address}
      </Text>
      {!isRide ? (
        <Text style={styles.sub} numberOfLines={2}>
          {item.kind === 'custom' ? item.custom_list : `${item.store_name} · ${(item.items || []).length} items`}
        </Text>
      ) : null}

      <View style={styles.customerRow}>
        <View style={styles.custInfo}>
          <Ionicons name="person-circle-outline" size={18} color={COLORS.muted} />
          <Text style={styles.custText}>{item.customer_name}</Text>
          <Text style={styles.earn}>· {peso(isRide ? item.fare : item.estimated_total)}</Text>
        </View>
        {item.customer_phone ? (
          <Pressable
            testID={`call-customer-${item.id}`}
            onPress={() => Linking.openURL(`tel:${item.customer_phone}`)}
            style={styles.callBtn}
          >
            <Ionicons name="call" size={18} color="#fff" />
          </Pressable>
        ) : null}
      </View>

      {item.payment_method === 'gcash' ? (
        item.payment_status === 'confirmed' ? (
          <View style={styles.payLine}>
            <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
            <Text style={styles.payLineText}>GCash paid · Ref {item.gcash_ref}</Text>
          </View>
        ) : item.payment_status === 'submitted' ? (
          <Button
            testID={`confirm-pay-${item.id}`}
            title={`Confirm GCash · Ref ${item.gcash_ref}`}
            variant="outline"
            onPress={onConfirmPay}
            loading={payBusy}
            style={{ marginTop: SPACING.md }}
          />
        ) : (
          <View style={styles.payLine}>
            <Ionicons name="phone-portrait-outline" size={16} color={COLORS.muted} />
            <Text style={styles.payLineText}>GCash — awaiting customer reference</Text>
          </View>
        )
      ) : (
        <View style={styles.payLine}>
          <Ionicons name="cash-outline" size={16} color={COLORS.muted} />
          <Text style={styles.payLineText}>Cash on delivery</Text>
        </View>
      )}

      {next ? (
        <Button
          testID={`advance-${item.id}`}
          title={next === 'completed' ? 'Complete Job' : `Mark: ${nextLabel}`}
          onPress={onAdvance}
          loading={busy}
          variant={next === 'completed' ? 'primary' : 'secondary'}
          style={{ marginTop: SPACING.md }}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.pill },
  tagText: { fontSize: 11, letterSpacing: 1, fontWeight: WEIGHT.medium },
  route: { fontSize: FONT.lg, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  sub: { fontSize: FONT.base, color: COLORS.muted, marginTop: 2, lineHeight: 20 },
  customerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.md },
  custInfo: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, flex: 1 },
  custText: { fontSize: FONT.base, color: COLORS.onSurface },
  earn: { fontSize: FONT.base, color: COLORS.brandPrimary, fontWeight: WEIGHT.medium },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payLine: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.md },
  payLineText: { fontSize: FONT.base, color: COLORS.muted },
});
