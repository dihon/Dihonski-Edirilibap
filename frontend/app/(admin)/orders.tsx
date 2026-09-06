import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT, WEIGHT, RADIUS, peso, RIDE_STATUS, ORDER_STATUS } from '@/src/theme';
import { Loading, Badge, EmptyState, Input } from '@/src/components/ui';
import { AppHeader } from '@/src/components/Header';
import { api } from '@/src/api';

export default function AdminOrders() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'ride' | 'pabili'>('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const res = (await api.adminOrders()) as any;
      const all = [...(res.rides || []), ...(res.orders || [])].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setItems(all);
    } finally {
      setLoading(false);
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

  const q = search.trim().toLowerCase();
  const filtered = items.filter((i) => {
    if (filter !== 'all' && i.type !== filter) return false;
    if (!q) return true;
    return [i.customer_name, i.driver_name, i.pickup, i.dropoff, i.delivery_address, i.store_name]
      .filter(Boolean)
      .some((f: string) => String(f).toLowerCase().includes(q));
  });
  const chips: { key: typeof filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'ride', label: 'Rides' },
    { key: 'pabili', label: 'Pabili' },
  ];

  if (loading) return <Loading />;

  return (
    <View style={styles.container}>
      <AppHeader title="All Orders" subtitle={`${items.length} total`} dark />
      <View style={styles.chipRow}>
        {chips.map((c) => (
          <Pressable
            key={c.key}
            testID={`filter-${c.key}`}
            onPress={() => setFilter(c.key)}
            style={[styles.chip, filter === c.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, filter === c.key && styles.chipTextActive]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.searchWrap}>
        <Input
          testID="order-search"
          icon="search-outline"
          placeholder="Search customer, driver, address…"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          style={{ marginBottom: 0 }}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: insets.bottom + 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />}
        ListEmptyComponent={<EmptyState icon="cube-outline" title="No orders found" />}
        renderItem={({ item }) => {
          const isRide = item.type === 'ride';
          const meta = isRide ? RIDE_STATUS[item.status] : ORDER_STATUS[item.status];
          return (
            <View style={styles.card} testID={`admin-order-${item.id}`}>
              <View style={styles.cardHead}>
                <View style={styles.cardHeadLeft}>
                  <Ionicons
                    name={isRide ? 'bicycle' : 'basket'}
                    size={18}
                    color={isRide ? COLORS.brandPrimary : COLORS.brandSecondary}
                  />
                  <Text style={styles.cardType}>{isRide ? 'Ride' : 'Pabili'}</Text>
                </View>
                {meta ? <Badge label={meta.label} color={meta.color} /> : null}
              </View>
              <Text style={styles.cardRoute} numberOfLines={1}>
                {isRide ? `${item.pickup} → ${item.dropoff}` : item.delivery_address}
              </Text>
              <View style={styles.cardFoot}>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {item.customer_name}
                  {item.driver_name ? ` · Driver: ${item.driver_name}` : ' · unassigned'}
                </Text>
                <Text style={styles.cardPrice}>{peso(isRide ? item.fare : item.estimated_total)}</Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  searchWrap: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  chipRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  chip: {
    height: 36,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surfaceTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chipActive: { backgroundColor: COLORS.brandPrimary },
  chipText: { fontSize: FONT.base, color: COLORS.muted, fontWeight: WEIGHT.medium },
  chipTextActive: { color: '#fff' },
  card: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  cardHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  cardType: { fontSize: FONT.base, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  cardRoute: { fontSize: FONT.base, color: COLORS.onSurface },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.sm },
  cardMeta: { fontSize: FONT.sm, color: COLORS.muted, flex: 1 },
  cardPrice: { fontSize: FONT.base, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
});
