import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Pressable, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT, WEIGHT, RADIUS, SHADOW, peso } from '@/src/theme';
import { Button, Card, EmptyState, useToast } from '@/src/components/ui';
import { AppHeader } from '@/src/components/Header';
import { useAuth } from '@/src/auth';
import { api } from '@/src/api';

export default function DriverDashboard() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user, refresh } = useAuth();
  const [online, setOnline] = useState(!!user?.online);
  const [rides, setRides] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = (await api.driverRequests()) as any;
      setOnline(res.online);
      setRides(res.rides || []);
      setOrders(res.orders || []);
    } catch {
      /* ignore */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      timer.current = setInterval(load, 5000);
      return () => {
        if (timer.current) clearInterval(timer.current);
      };
    }, [load]),
  );

  const toggle = async (val: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setOnline(val);
    try {
      await api.setOnline(val);
      await refresh();
      toast(val ? "You're online — waiting for requests" : "You're now offline", val ? 'success' : 'info');
      load();
    } catch {
      setOnline(!val);
      toast('Could not update status', 'error');
    }
  };

  const accept = async (type: 'ride' | 'order', id: string) => {
    setBusy(id);
    try {
      if (type === 'ride') await api.acceptRide(id);
      else await api.acceptOrder(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast('Job accepted! Check My Jobs', 'success');
      load();
    } catch (e: any) {
      toast(e.message || 'Job no longer available', 'error');
      load();
    } finally {
      setBusy(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const hasRequests = rides.length + orders.length > 0;

  return (
    <View style={styles.container}>
      <AppHeader title="Driver Mode" subtitle={`Kuya ${user?.name?.split(' ')[0] || ''} · ${user?.tricycle_no || ''}`} dark />
      <View style={styles.toggleBar}>
        <View>
          <Text style={styles.toggleTitle}>{online ? "You're Online" : "You're Offline"}</Text>
          <Text style={styles.toggleSub}>{online ? 'Receiving requests in Tagkawayan' : 'Go online to get jobs'}</Text>
        </View>
        <Switch
          testID="online-toggle"
          value={online}
          onValueChange={toggle}
          trackColor={{ false: '#5A6B4A', true: COLORS.brandPrimary }}
          thumbColor="#fff"
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />}
      >
        {!online ? (
          <EmptyState
            testID="driver-offline"
            icon="bicycle-outline"
            title="You're offline"
            subtitle="Flip the switch above to start receiving ride and pabili requests."
          />
        ) : !hasRequests ? (
          <EmptyState
            testID="driver-no-requests"
            icon="time-outline"
            title="Waiting for requests..."
            subtitle="New rides and pabili orders will pop up here. Pull down to refresh."
          />
        ) : (
          <>
            {rides.map((r) => (
              <RequestCard key={r.id} type="ride" data={r} busy={busy === r.id} onAccept={() => accept('ride', r.id)} />
            ))}
            {orders.map((o) => (
              <RequestCard key={o.id} type="order" data={o} busy={busy === o.id} onAccept={() => accept('order', o.id)} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function RequestCard({
  type,
  data,
  onAccept,
  busy,
}: {
  type: 'ride' | 'order';
  data: any;
  onAccept: () => void;
  busy: boolean;
}) {
  const isRide = type === 'ride';
  return (
    <Card testID={`request-${data.id}`} style={{ marginBottom: SPACING.md }}>
      <View style={styles.reqHead}>
        <View style={[styles.reqTag, { backgroundColor: isRide ? COLORS.brandTertiary : '#FCE5D6' }]}>
          <Ionicons name={isRide ? 'bicycle' : 'basket'} size={16} color={isRide ? COLORS.brandPrimary : COLORS.brandSecondary} />
          <Text style={[styles.reqTagText, { color: isRide ? COLORS.onBrandTertiary : '#A04010' }]}>
            {isRide ? 'RIDE' : 'PABILI'}
          </Text>
        </View>
        <Text style={styles.reqEarn}>{peso(isRide ? data.fare : data.service_fee)}</Text>
      </View>

      {isRide ? (
        <>
          <RouteLine color={COLORS.brandPrimary} label="Pickup" value={data.pickup} />
          <RouteLine color={COLORS.brandSecondary} label="Drop-off" value={data.dropoff} />
          <Text style={styles.reqMeta}>
            {data.passengers} passenger{data.passengers > 1 ? 's' : ''} · Cash
          </Text>
        </>
      ) : (
        <>
          <RouteLine color={COLORS.brandSecondary} label="Deliver to" value={data.delivery_address} />
          <Text style={styles.reqMeta} numberOfLines={2}>
            {data.kind === 'custom'
              ? data.custom_list
              : `${data.store_name} · ${(data.items || []).length} items · est. ${peso(data.estimated_total)}`}
          </Text>
        </>
      )}

      <View style={styles.reqCustomer}>
        <Ionicons name="person-circle-outline" size={18} color={COLORS.muted} />
        <Text style={styles.reqCustomerText}>{data.customer_name}</Text>
      </View>

      <Button testID={`accept-${data.id}`} title="Accept Job" onPress={onAccept} loading={busy} style={{ marginTop: SPACING.md }} />
    </Card>
  );
}

function RouteLine({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={styles.routeLine}>
      <View style={[styles.routeDot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.routeLabel}>{label}</Text>
        <Text style={styles.routeValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  toggleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceInverse,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    paddingTop: SPACING.xs,
  },
  toggleTitle: { color: '#fff', fontSize: FONT.lg, fontWeight: WEIGHT.medium },
  toggleSub: { color: '#C7D0BC', fontSize: FONT.sm, marginTop: 2 },
  reqHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  reqTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.pill },
  reqTagText: { fontSize: 11, letterSpacing: 1, fontWeight: WEIGHT.medium },
  reqEarn: { fontSize: FONT.xl, color: COLORS.brandPrimary, fontWeight: WEIGHT.medium },
  routeLine: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.sm },
  routeDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  routeLabel: { fontSize: FONT.sm, color: COLORS.muted },
  routeValue: { fontSize: FONT.base, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  reqMeta: { fontSize: FONT.base, color: COLORS.muted, marginTop: 2, lineHeight: 20 },
  reqCustomer: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.md },
  reqCustomerText: { fontSize: FONT.base, color: COLORS.onSurface },
});
