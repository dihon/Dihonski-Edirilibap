import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT, WEIGHT, RADIUS, SHADOW, peso } from '@/src/theme';
import { Button, Input, useToast, Loading } from '@/src/components/ui';
import { AppHeader } from '@/src/components/Header';
import { PaymentSelector, PayMethod } from '@/src/components/PaymentSelector';
import { api } from '@/src/api';

export default function Pabili() {
  const [tab, setTab] = useState<'browse' | 'custom'>('browse');

  return (
    <View style={styles.container}>
      <AppHeader title="Pabili Market" subtitle="We buy & deliver to you" back />
      <View style={styles.segment}>
        <Pressable
          testID="pabili-tab-browse"
          onPress={() => setTab('browse')}
          style={[styles.segBtn, tab === 'browse' && styles.segActive]}
        >
          <Text style={[styles.segText, tab === 'browse' && styles.segTextActive]}>Browse Stores</Text>
        </Pressable>
        <Pressable
          testID="pabili-tab-custom"
          onPress={() => setTab('custom')}
          style={[styles.segBtn, tab === 'custom' && styles.segActive]}
        >
          <Text style={[styles.segText, tab === 'custom' && styles.segTextActive]}>Type a List</Text>
        </Pressable>
      </View>
      {tab === 'browse' ? <BrowseTab /> : <CustomTab />}
    </View>
  );
}

function BrowseTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stores, setStores] = useState<any[] | null>(null);

  useEffect(() => {
    api.stores().then((s: any) => setStores(s)).catch(() => setStores([]));
  }, []);

  if (!stores) return <Loading />;

  return (
    <ScrollView
      contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 90 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.grid}>
        {stores.map((s) => (
          <Pressable
            key={s.id}
            testID={`store-${s.id}`}
            onPress={() => router.push(`/pabili/store/${s.id}` as any)}
            style={({ pressed }) => [styles.storeCard, pressed && { transform: [{ scale: 0.98 }] }]}
          >
            <Image source={{ uri: s.image }} style={styles.storeImg} contentFit="cover" />
            <View style={styles.storeBody}>
              <View style={styles.storeCat}>
                <Text style={styles.storeCatText}>{s.category}</Text>
              </View>
              <Text style={styles.storeName} numberOfLines={2}>
                {s.name}
              </Text>
              <Text style={styles.storeItems}>{s.items.length} items available</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function CustomTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [list, setList] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [weight, setWeight] = useState('');
  const [itemCount, setItemCount] = useState('');
  const [pricing, setPricing] = useState<any>(null);
  const [payment, setPayment] = useState<PayMethod>('cash');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.pricing().then(setPricing).catch(() => setPricing(null));
  }, []);

  const wKg = parseFloat(weight) || 0;
  const iCount = parseInt(itemCount, 10) || 0;
  const fee = pricing
    ? pricing.pabili_service_fee + pricing.pabili_per_kg * wKg + pricing.pabili_per_item * iCount
    : 35;

  const submit = async () => {
    if (list.trim().length < 3) return toast('Please write what you need', 'error');
    if (!address.trim()) return toast('Please add a delivery address', 'error');
    setSubmitting(true);
    try {
      const order = (await api.createOrder({
        kind: 'custom',
        custom_list: list.trim(),
        delivery_address: address.trim(),
        note: note.trim(),
        items: [],
        weight_kg: wKg,
        item_count: iCount,
        payment_method: payment,
      })) as any;
      toast('Pabili request sent!', 'success');
      router.replace(`/track/pabili/${order.id}` as any);
    } catch (e: any) {
      toast(e.message || 'Could not send request', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 200 }}
        bottomOffset={120}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.label}>What do you need us to buy?</Text>
        <View style={styles.textAreaWrap}>
          <Input
            testID="custom-list-input"
            placeholder={'e.g.\n2 kilo bigas\n1 dosena itlog\n1 lata sardinas'}
            value={list}
            onChangeText={setList}
            multiline
            style={{ minHeight: 140, textAlignVertical: 'top' }}
          />
        </View>
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Input
              testID="custom-item-count"
              label="No. of items"
              icon="cube-outline"
              placeholder="e.g. 5"
              value={itemCount}
              onChangeText={setItemCount}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.rowItem}>
            <Input
              testID="custom-weight"
              label="Est. weight (kg)"
              icon="barbell-outline"
              placeholder="e.g. 3"
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
        <Input
          testID="custom-address-input"
          label="Deliver to (address / landmark)"
          icon="home-outline"
          placeholder="e.g. Purok 3, malapit sa barangay hall"
          value={address}
          onChangeText={setAddress}
        />
        <Input
          testID="custom-note-input"
          label="Note (optional)"
          icon="chatbubble-ellipses-outline"
          placeholder="Any brand or budget preference?"
          value={note}
          onChangeText={setNote}
        />
        <View style={styles.feeCard}>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Estimated delivery fee</Text>
            <Text style={styles.feeVal}>{peso(fee)}</Text>
          </View>
          <Text style={styles.feeHint}>
            Base {peso(pricing?.pabili_service_fee ?? 35)}
            {iCount ? ` + ${iCount} item${iCount === 1 ? '' : 's'}` : ''}
            {wKg ? ` + ${wKg}kg` : ''}. You also pay the item cost on delivery.
          </Text>
        </View>
        <Text style={[styles.label, { marginTop: SPACING.lg }]}>Payment method</Text>
        <PaymentSelector value={payment} onChange={setPayment} />
      </KeyboardAwareScrollView>
      <KeyboardStickyView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
          <Button
            testID="request-pabili-custom"
            title="Request Pabili"
            icon="basket"
            onPress={submit}
            loading={submitting}
          />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  segment: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceTertiary,
    borderRadius: RADIUS.md,
    padding: 4,
    margin: SPACING.lg,
  },
  segBtn: { flex: 1, height: 44, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  segActive: { backgroundColor: COLORS.surfaceSecondary, ...SHADOW.soft },
  segText: { fontSize: FONT.base, color: COLORS.muted, fontWeight: WEIGHT.medium },
  segTextActive: { color: COLORS.brandPrimary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: SPACING.md },
  storeCard: {
    width: '47.5%',
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
  },
  storeImg: { width: '100%', height: 110 },
  storeBody: { padding: SPACING.md },
  storeCat: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.brandTertiary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
    marginBottom: SPACING.xs,
  },
  storeCatText: { fontSize: 11, color: COLORS.onBrandTertiary, fontWeight: WEIGHT.medium },
  storeName: { fontSize: FONT.base, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  storeItems: { fontSize: FONT.sm, color: COLORS.muted, marginTop: 2 },
  label: { fontSize: FONT.base, color: COLORS.muted, fontWeight: WEIGHT.medium, marginBottom: SPACING.sm },
  textAreaWrap: { marginBottom: SPACING.xs },
  row: { flexDirection: 'row', gap: SPACING.md },
  rowItem: { flex: 1 },
  feeCard: {
    backgroundColor: COLORS.surfaceTertiary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
  },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feeLabel: { fontSize: FONT.base, color: COLORS.onSurfaceTertiary, fontWeight: WEIGHT.medium },
  feeVal: { fontSize: FONT.lg, color: COLORS.brandPrimary, fontWeight: WEIGHT.medium },
  feeHint: { fontSize: FONT.sm, color: COLORS.muted, marginTop: SPACING.xs, lineHeight: 18 },
  footer: {
    backgroundColor: COLORS.surfaceSecondary,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});
