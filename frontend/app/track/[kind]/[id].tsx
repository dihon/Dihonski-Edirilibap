import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  COLORS,
  SPACING,
  FONT,
  WEIGHT,
  RADIUS,
  SHADOW,
  peso,
  RIDE_STATUS,
  ORDER_STATUS,
  RIDE_FLOW,
  ORDER_FLOW,
} from '@/src/theme';
import { Button, Card, Input, Loading, useToast } from '@/src/components/ui';
import { AppHeader } from '@/src/components/Header';
import { api } from '@/src/api';

export default function Track() {
  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const isRide = kind === 'ride';
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [gcashRef, setGcashRef] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [rateBusy, setRateBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = isRide ? await api.ride(id) : await api.order(id);
      setData(res);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [id, isRide]);

  useEffect(() => {
    load();
    timer.current = setInterval(load, 4000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  const cancel = async () => {
    try {
      if (isRide) await api.rideStatus(id, 'cancelled');
      else await api.orderStatus(id, 'cancelled');
      toast('Cancelled', 'info');
      load();
    } catch (e: any) {
      toast(e.message || 'Could not cancel', 'error');
    }
  };

  const submitPay = async () => {
    if (gcashRef.trim().length < 4) return toast('Enter a valid GCash reference number', 'error');
    setPayBusy(true);
    try {
      await api.submitPayment(isRide ? 'rides' : 'orders', id, gcashRef.trim());
      toast('Reference sent! Waiting for confirmation.', 'success');
      setGcashRef('');
      load();
    } catch (e: any) {
      toast(e.message || 'Could not submit', 'error');
    } finally {
      setPayBusy(false);
    }
  };

  const submitRating = async () => {
    if (stars === 0) return toast('Please choose a star rating', 'error');
    setRateBusy(true);
    try {
      await api.rate(id, isRide ? 'ride' : 'pabili', stars, comment.trim());
      toast('Salamat sa iyong rating!', 'success');
      load();
    } catch (e: any) {
      toast(e.message || 'Could not submit rating', 'error');
    } finally {
      setRateBusy(false);
    }
  };

  if (loading || !data) return <Loading />;

  const flow = isRide ? RIDE_FLOW : ORDER_FLOW;
  const statusMap = isRide ? RIDE_STATUS : ORDER_STATUS;
  const meta = statusMap[data.status];
  const currentStep = meta?.step ?? 0;
  const cancelled = data.status === 'cancelled';
  const completed = data.status === 'completed';
  const hasDriver = !!data.driver_id;
  const canCancel = ['requested', 'accepted'].includes(data.status);

  return (
    <View style={styles.container}>
      <AppHeader
        title={isRide ? 'Your Ride' : 'Your Pabili'}
        subtitle={isRide ? `${data.pickup} → ${data.dropoff}` : data.store_name || 'Custom list'}
        back
      />
      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.statusHero, { backgroundColor: (meta?.color || COLORS.info) + '18' }]}>
          <View style={[styles.statusIcon, { backgroundColor: meta?.color || COLORS.info }]}>
            <Ionicons
              name={cancelled ? 'close' : completed ? 'checkmark' : isRide ? 'bicycle' : 'basket'}
              size={30}
              color="#fff"
            />
          </View>
          <Text style={styles.statusTitle}>{meta?.label || data.status}</Text>
          <Text style={styles.statusSub}>
            {cancelled
              ? 'This request was cancelled.'
              : completed
              ? 'Salamat! Sana nakatulong kami.'
              : hasDriver
              ? 'Your driver is on it.'
              : 'Hang tight, hinahanap namin ang pinakamalapit na driver.'}
          </Text>
        </View>

        {!cancelled ? (
          <Card style={{ marginTop: SPACING.lg }}>
            {flow.map((step, idx) => {
              const done = idx <= currentStep;
              const active = idx === currentStep && !completed;
              return (
                <View key={step} style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <View
                      style={[
                        styles.node,
                        done && { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
                        active && { transform: [{ scale: 1.15 }] },
                      ]}
                    >
                      {done ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
                    </View>
                    {idx < flow.length - 1 ? (
                      <View style={[styles.line, idx < currentStep && { backgroundColor: COLORS.brandPrimary }]} />
                    ) : null}
                  </View>
                  <Text style={[styles.timelineText, done && { color: COLORS.onSurface }]}>
                    {statusMap[step].label}
                  </Text>
                </View>
              );
            })}
          </Card>
        ) : null}

        {hasDriver && !cancelled ? (
          <Card style={{ marginTop: SPACING.lg }}>
            <Text style={styles.cardLabel}>YOUR DRIVER</Text>
            <View style={styles.driverRow}>
              <View style={styles.driverAvatar}>
                <Text style={styles.driverInitials}>
                  {String(data.driver_name || 'D')
                    .split(' ')
                    .map((s: string) => s[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.driverName}>{data.driver_name}</Text>
                <Text style={styles.driverTrike}>
                  <Ionicons name="bicycle" size={14} color={COLORS.muted} /> {data.driver_tricycle || 'Tricycle'}
                </Text>
                {data.driver_rating_count > 0 ? (
                  <Text style={styles.driverRating}>
                    <Ionicons name="star" size={13} color={COLORS.warning} /> {Number(data.driver_rating).toFixed(1)} ({data.driver_rating_count})
                  </Text>
                ) : null}
              </View>
              {data.driver_phone ? (
                <Pressable
                  testID="call-driver-button"
                  onPress={() => Linking.openURL(`tel:${data.driver_phone}`)}
                  style={styles.callBtn}
                >
                  <Ionicons name="call" size={22} color="#fff" />
                </Pressable>
              ) : null}
            </View>
          </Card>
        ) : null}

        <Card style={{ marginTop: SPACING.lg }}>
          <Text style={styles.cardLabel}>{isRide ? 'TRIP DETAILS' : 'ORDER DETAILS'}</Text>
          {isRide ? (
            <>
              <Detail icon="ellipse" color={COLORS.brandPrimary} label="Pickup" value={data.pickup} />
              <Detail icon="location" color={COLORS.brandSecondary} label="Drop-off" value={data.dropoff} />
              <Detail icon="people-outline" label="Passengers" value={String(data.passengers)} />
              {data.note ? <Detail icon="chatbubble-outline" label="Note" value={data.note} /> : null}
              <View style={styles.totalBar}>
                <Text style={styles.totalBarLabel}>Fare (cash)</Text>
                <Text style={styles.totalBarVal}>{peso(data.fare)}</Text>
              </View>
            </>
          ) : (
            <>
              <Detail icon="home-outline" label="Deliver to" value={data.delivery_address} />
              {data.kind === 'custom' ? (
                <Detail icon="list-outline" label="Shopping list" value={data.custom_list} />
              ) : (
                <View style={{ marginTop: SPACING.sm }}>
                  {(data.items || []).map((it: any, i: number) => (
                    <View key={i} style={styles.itemLine}>
                      <Text style={styles.itemLineName}>
                        {it.qty}× {it.name}
                      </Text>
                      <Text style={styles.itemLinePrice}>{peso((it.price || 0) * it.qty)}</Text>
                    </View>
                  ))}
                </View>
              )}
              {data.note ? <Detail icon="chatbubble-outline" label="Note" value={data.note} /> : null}
              <View style={styles.totalBar}>
                <Text style={styles.totalBarLabel}>Est. total + fee (cash)</Text>
                <Text style={styles.totalBarVal}>{peso(data.estimated_total)}</Text>
              </View>
            </>
          )}
        </Card>

        {data.payment_method === 'gcash' && !cancelled ? (
          <Card style={{ marginTop: SPACING.lg }}>
            <Text style={styles.cardLabel}>GCASH PAYMENT</Text>
            {data.payment_status === 'confirmed' ? (
              <View style={styles.payRow}>
                <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
                <Text style={styles.payText}>Payment confirmed{data.gcash_ref ? ` · Ref ${data.gcash_ref}` : ''}</Text>
              </View>
            ) : data.payment_status === 'submitted' ? (
              <View style={styles.payRow}>
                <Ionicons name="time-outline" size={22} color={COLORS.warning} />
                <Text style={styles.payText}>Ref {data.gcash_ref} sent. Waiting for confirmation.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.payHint}>
                  Send {peso(isRide ? data.fare : data.estimated_total)} via GCash, then enter the reference number below.
                </Text>
                <Input
                  testID="gcash-ref-input"
                  placeholder="GCash reference no."
                  value={gcashRef}
                  onChangeText={setGcashRef}
                  keyboardType="number-pad"
                />
                <Button testID="submit-gcash-button" title="Submit Reference" onPress={submitPay} loading={payBusy} />
              </>
            )}
          </Card>
        ) : null}

        {completed && hasDriver && !data.rated ? (
          <Card style={{ marginTop: SPACING.lg }}>
            <Text style={styles.cardLabel}>RATE YOUR DRIVER</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Pressable key={s} testID={`star-${s}`} onPress={() => setStars(s)} hitSlop={6}>
                  <Ionicons name={s <= stars ? 'star' : 'star-outline'} size={38} color={COLORS.warning} />
                </Pressable>
              ))}
            </View>
            <Input
              testID="rating-comment"
              placeholder="Add a comment (optional)"
              value={comment}
              onChangeText={setComment}
              multiline
            />
            <Button testID="submit-rating-button" title="Submit Rating" onPress={submitRating} loading={rateBusy} />
          </Card>
        ) : null}

        {completed && hasDriver && data.rated ? (
          <View style={styles.ratedNote}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
            <Text style={styles.ratedText}>You rated this trip {data.rating_stars}★</Text>
          </View>
        ) : null}

        {completed && hasDriver ? (
          <Button
            testID="report-button"
            title="Report a problem with driver"
            variant="outline"
            icon="flag-outline"
            onPress={() => router.push(`/report/${kind}/${id}` as any)}
            style={{ marginTop: SPACING.lg }}
          />
        ) : null}

        {completed || cancelled ? (
          <Button
            title="Back to Home"
            variant="outline"
            onPress={() => router.replace('/(customer)')}
            style={{ marginTop: SPACING.lg }}
            testID="back-home-button"
          />
        ) : null}
      </ScrollView>

      {canCancel ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
          <Button testID="cancel-request-button" title="Cancel Request" variant="danger" onPress={cancel} />
        </View>
      ) : null}
    </View>
  );
}

function Detail({
  icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={18} color={color || COLORS.muted} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  statusHero: { borderRadius: RADIUS.lg, padding: SPACING.xl, alignItems: 'center' },
  statusIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  statusTitle: { fontSize: FONT.xl, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  statusSub: { fontSize: FONT.base, color: COLORS.muted, textAlign: 'center', marginTop: SPACING.xs, lineHeight: 20 },
  timelineRow: { flexDirection: 'row', gap: SPACING.md },
  timelineLeft: { alignItems: 'center', width: 24 },
  node: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { width: 2, flex: 1, minHeight: 22, backgroundColor: COLORS.border, marginVertical: 2 },
  timelineText: { fontSize: FONT.base, color: COLORS.muted, paddingBottom: SPACING.lg, paddingTop: 1 },
  cardLabel: { fontSize: FONT.sm, color: COLORS.muted, letterSpacing: 1, fontWeight: WEIGHT.medium, marginBottom: SPACING.md },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  driverAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverInitials: { color: '#fff', fontSize: FONT.lg, fontWeight: WEIGHT.medium },
  driverName: { fontSize: FONT.lg, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  driverTrike: { fontSize: FONT.base, color: COLORS.muted, marginTop: 2 },
  driverRating: { fontSize: FONT.sm, color: COLORS.onSurface, marginTop: 4 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  payText: { flex: 1, fontSize: FONT.base, color: COLORS.onSurface, lineHeight: 20 },
  payHint: { fontSize: FONT.base, color: COLORS.muted, marginBottom: SPACING.md, lineHeight: 20 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  ratedNote: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, justifyContent: 'center', marginTop: SPACING.lg },
  ratedText: { fontSize: FONT.base, color: COLORS.success, fontWeight: WEIGHT.medium },
  callBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  detailLabel: { fontSize: FONT.sm, color: COLORS.muted },
  detailValue: { fontSize: FONT.base, color: COLORS.onSurface, marginTop: 2, lineHeight: 20 },
  itemLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  itemLineName: { fontSize: FONT.base, color: COLORS.onSurface, flex: 1 },
  itemLinePrice: { fontSize: FONT.base, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  totalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  totalBarLabel: { fontSize: FONT.base, color: COLORS.muted },
  totalBarVal: { fontSize: FONT.xl, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
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
