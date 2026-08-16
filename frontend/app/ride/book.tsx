import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT, WEIGHT, RADIUS, SHADOW, peso } from '@/src/theme';
import { Button, Input, Card, useToast } from '@/src/components/ui';
import { AppHeader } from '@/src/components/Header';
import { PickerModal } from '@/src/components/PickerModal';
import { PaymentSelector, PayMethod } from '@/src/components/PaymentSelector';
import { api } from '@/src/api';

export default function BookRide() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [landmarks, setLandmarks] = useState<string[]>([]);
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [note, setNote] = useState('');
  const [payment, setPayment] = useState<PayMethod>('cash');
  const [fare, setFare] = useState<number | null>(null);
  const [picker, setPicker] = useState<null | 'pickup' | 'dropoff'>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.landmarks().then((lm: any[]) => setLandmarks(lm.map((l) => l.name))).catch(() => {});
  }, []);

  useEffect(() => {
    if (pickup && dropoff && pickup !== dropoff) {
      api.estimate(pickup, dropoff).then((r: any) => setFare(r.fare)).catch(() => setFare(null));
    } else {
      setFare(null);
    }
  }, [pickup, dropoff]);

  const submit = async () => {
    if (!pickup || !dropoff) return toast('Please choose pickup and drop-off', 'error');
    if (pickup === dropoff) return toast('Pickup and drop-off must be different', 'error');
    setSubmitting(true);
    try {
      const ride = (await api.createRide({ pickup, dropoff, passengers, note, payment_method: payment })) as any;
      toast('Finding a driver near you...', 'success');
      router.replace(`/track/ride/${ride.id}` as any);
    } catch (e: any) {
      toast(e.message || 'Could not book ride', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Book a Ride" subtitle="Tricycle around Tagkawayan" back />
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 200 }}
        bottomOffset={100}
        showsVerticalScrollIndicator={false}
      >
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <LocRow
            testID="ride-pickup"
            dotColor={COLORS.brandPrimary}
            label="PICKUP"
            value={pickup || 'Where are you now?'}
            placeholder={!pickup}
            onPress={() => setPicker('pickup')}
          />
          <View style={styles.rowDivider} />
          <LocRow
            testID="ride-dropoff"
            dotColor={COLORS.brandSecondary}
            label="DROP-OFF"
            value={dropoff || 'Where to?'}
            placeholder={!dropoff}
            onPress={() => setPicker('dropoff')}
          />
        </Card>

        <Text style={styles.sectionLabel}>Passengers</Text>
        <View style={styles.stepper}>
          <Pressable
            testID="passengers-minus"
            onPress={() => setPassengers((p) => Math.max(1, p - 1))}
            style={styles.stepBtn}
          >
            <Ionicons name="remove" size={24} color={COLORS.onSurface} />
          </Pressable>
          <Text style={styles.stepValue}>{passengers}</Text>
          <Pressable
            testID="passengers-plus"
            onPress={() => setPassengers((p) => Math.min(6, p + 1))}
            style={styles.stepBtn}
          >
            <Ionicons name="add" size={24} color={COLORS.onSurface} />
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Note for driver (optional)</Text>
        <Input
          testID="ride-note"
          placeholder="e.g. May bagahe ako / tabi sa tindahan"
          value={note}
          onChangeText={setNote}
          multiline
        />

        <Text style={styles.sectionLabel}>Payment method</Text>
        <PaymentSelector value={payment} onChange={setPayment} />
      </KeyboardAwareScrollView>

      <KeyboardStickyView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Estimated fare</Text>
            <Text style={styles.fareValue}>{fare != null ? peso(fare) : '—'}</Text>
          </View>
          <Button
            testID="find-driver-button"
            title="Find a Driver"
            icon="search"
            onPress={submit}
            loading={submitting}
            disabled={!pickup || !dropoff}
          />
        </View>
      </KeyboardStickyView>

      <PickerModal
        visible={picker === 'pickup'}
        title="Set pickup point"
        options={landmarks}
        selected={pickup}
        onSelect={setPickup}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={picker === 'dropoff'}
        title="Set drop-off point"
        options={landmarks}
        selected={dropoff}
        onSelect={setDropoff}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

function LocRow({
  dotColor,
  label,
  value,
  placeholder,
  onPress,
  testID,
}: {
  dotColor: string;
  label: string;
  value: string;
  placeholder?: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.locRow}>
      <View style={[styles.locDot, { backgroundColor: dotColor }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.locLabel}>{label}</Text>
        <Text style={[styles.locValue, placeholder && { color: COLORS.muted }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.lg, minHeight: 68 },
  locDot: { width: 14, height: 14, borderRadius: 7 },
  locLabel: { fontSize: FONT.sm, color: COLORS.muted, letterSpacing: 1, fontWeight: WEIGHT.medium },
  locValue: { fontSize: FONT.lg, color: COLORS.onSurface, marginTop: 2, fontWeight: WEIGHT.medium },
  rowDivider: { height: 1, backgroundColor: COLORS.divider, marginLeft: SPACING.lg + 14 + SPACING.md },
  sectionLabel: { fontSize: FONT.base, color: COLORS.muted, fontWeight: WEIGHT.medium, marginTop: SPACING.xl, marginBottom: SPACING.sm },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surfaceTertiary,
    borderRadius: RADIUS.md,
    padding: SPACING.xs,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { fontSize: FONT.xl, color: COLORS.onSurface, width: 56, textAlign: 'center', fontWeight: WEIGHT.medium },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xl,
    backgroundColor: COLORS.brandTertiary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  payText: { color: COLORS.onBrandTertiary, fontSize: FONT.base, flex: 1 },
  footer: {
    backgroundColor: COLORS.surfaceSecondary,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...SHADOW.card,
  },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  fareLabel: { fontSize: FONT.base, color: COLORS.muted },
  fareValue: { fontSize: FONT['2xl'], color: COLORS.onSurface, fontWeight: WEIGHT.medium },
});
