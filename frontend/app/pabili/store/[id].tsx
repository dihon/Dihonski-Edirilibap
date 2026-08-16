import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT, WEIGHT, RADIUS, SHADOW, peso } from '@/src/theme';
import { Button, Input, useToast, Loading } from '@/src/components/ui';
import { AppHeader } from '@/src/components/Header';
import { api } from '@/src/api';

const SERVICE_FEE = 35;

export default function StoreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [store, setStore] = useState<any>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.store(id).then(setStore).catch(() => toast('Could not load store', 'error'));
  }, [id]);

  const { itemsTotal, count } = useMemo(() => {
    if (!store) return { itemsTotal: 0, count: 0 };
    let total = 0;
    let c = 0;
    for (const it of store.items) {
      const q = qty[it.id] || 0;
      total += q * (it.price || 0);
      c += q;
    }
    return { itemsTotal: total, count: c };
  }, [store, qty]);

  const setItemQty = (itemId: string, delta: number) =>
    setQty((prev) => ({ ...prev, [itemId]: Math.max(0, (prev[itemId] || 0) + delta) }));

  const submit = async () => {
    if (count === 0) return toast('Add at least one item', 'error');
    if (!address.trim()) return toast('Please add a delivery address', 'error');
    const items = store.items
      .filter((it: any) => (qty[it.id] || 0) > 0)
      .map((it: any) => ({ name: it.name, qty: qty[it.id], price: it.price, unit: it.unit }));
    setSubmitting(true);
    try {
      const order = (await api.createOrder({
        kind: 'preset',
        store_id: store.id,
        store_name: store.name,
        items,
        delivery_address: address.trim(),
      })) as any;
      toast('Pabili request sent!', 'success');
      router.replace(`/track/pabili/${order.id}` as any);
    } catch (e: any) {
      toast(e.message || 'Could not send request', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!store) return <Loading />;

  return (
    <View style={styles.container}>
      <AppHeader title={store.name} subtitle={store.category} back />
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 220 }}
        bottomOffset={140}
        showsVerticalScrollIndicator={false}
      >
        <Image source={{ uri: store.image }} style={styles.banner} contentFit="cover" />

        <Input
          testID="store-address-input"
          label="Deliver to (address / landmark)"
          icon="home-outline"
          placeholder="e.g. Purok 3, malapit sa barangay hall"
          value={address}
          onChangeText={setAddress}
        />

        <Text style={styles.section}>Choose items</Text>
        {store.items.map((it: any) => {
          const q = qty[it.id] || 0;
          return (
            <View key={it.id} style={styles.itemRow} testID={`item-${it.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{it.name}</Text>
                <Text style={styles.itemPrice}>
                  {peso(it.price)} <Text style={styles.itemUnit}>/ {it.unit}</Text>
                </Text>
              </View>
              {q === 0 ? (
                <Pressable
                  testID={`add-${it.id}`}
                  onPress={() => setItemQty(it.id, 1)}
                  style={styles.addBtn}
                >
                  <Ionicons name="add" size={22} color={COLORS.brandPrimary} />
                </Pressable>
              ) : (
                <View style={styles.qtyRow}>
                  <Pressable testID={`minus-${it.id}`} onPress={() => setItemQty(it.id, -1)} style={styles.qtyBtn}>
                    <Ionicons name="remove" size={20} color={COLORS.onSurface} />
                  </Pressable>
                  <Text style={styles.qtyVal}>{q}</Text>
                  <Pressable testID={`plus-${it.id}`} onPress={() => setItemQty(it.id, 1)} style={styles.qtyBtn}>
                    <Ionicons name="add" size={20} color={COLORS.onSurface} />
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
      </KeyboardAwareScrollView>

      <KeyboardStickyView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
          <View style={styles.summaryRow}>
            <Text style={styles.sumLabel}>Items ({count})</Text>
            <Text style={styles.sumVal}>{peso(itemsTotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.sumLabel}>Service fee</Text>
            <Text style={styles.sumVal}>{peso(SERVICE_FEE)}</Text>
          </View>
          <View style={[styles.summaryRow, { marginBottom: SPACING.md }]}>
            <Text style={styles.totalLabel}>Estimated total</Text>
            <Text style={styles.totalVal}>{peso(itemsTotal + SERVICE_FEE)}</Text>
          </View>
          <Button
            testID="request-pabili-preset"
            title="Request Pabili"
            icon="basket"
            onPress={submit}
            loading={submitting}
            disabled={count === 0}
          />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  banner: { width: '100%', height: 140, borderRadius: RADIUS.lg, marginBottom: SPACING.lg },
  section: { fontSize: FONT.lg, color: COLORS.onSurface, fontWeight: WEIGHT.medium, marginBottom: SPACING.md },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    minHeight: 60,
  },
  itemName: { fontSize: FONT.lg, color: COLORS.onSurface },
  itemPrice: { fontSize: FONT.base, color: COLORS.brandPrimary, marginTop: 2, fontWeight: WEIGHT.medium },
  itemUnit: { color: COLORS.muted, fontWeight: WEIGHT.regular },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: COLORS.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceTertiary,
    borderRadius: RADIUS.pill,
    padding: 3,
  },
  qtyBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyVal: { width: 36, textAlign: 'center', fontSize: FONT.lg, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  footer: {
    backgroundColor: COLORS.surfaceSecondary,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...SHADOW.card,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xs },
  sumLabel: { fontSize: FONT.base, color: COLORS.muted },
  sumVal: { fontSize: FONT.base, color: COLORS.onSurface },
  totalLabel: { fontSize: FONT.lg, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  totalVal: { fontSize: FONT.xl, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
});
