import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT, WEIGHT, RADIUS, peso, RIDE_STATUS, ORDER_STATUS } from '@/src/theme';
import { Input, Badge, EmptyState } from '@/src/components/ui';
import { AppHeader } from '@/src/components/Header';
import { api } from '@/src/api';

const PAGE_SIZE = 10;

export default function AdminList() {
  const { type, title } = useLocalSearchParams<{ type: string; title: string }>();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'time' | 'name'>('time');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.adminList({ type: type!, q, sort, order, page, page_size: PAGE_SIZE });
      setData(res);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [type, q, sort, order, page]);

  // reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [q, sort, order]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const kind = data?.kind || 'user';
  const total = data?.total || 0;
  const pages = data?.pages || 1;

  const chips: { key: 'time' | 'name'; label: string }[] = [
    { key: 'time', label: 'Sort: Time' },
    { key: 'name', label: 'Sort: Name' },
  ];

  return (
    <View style={styles.container}>
      <AppHeader title={title || 'Results'} subtitle={`${total} total`} back dark />

      <View style={styles.controls}>
        <Input
          testID="admin-list-search"
          icon="search-outline"
          placeholder="Filter by rider, customer, or location..."
          value={q}
          onChangeText={setQ}
          autoCapitalize="none"
        />
        <View style={styles.chipRow}>
          {chips.map((c) => (
            <Pressable
              key={c.key}
              testID={`sort-${c.key}`}
              onPress={() => setSort(c.key)}
              style={[styles.chip, sort === c.key && styles.chipActive]}
            >
              <Text style={[styles.chipText, sort === c.key && styles.chipTextActive]}>{c.label}</Text>
            </Pressable>
          ))}
          <Pressable
            testID="order-toggle"
            onPress={() => setOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
            style={styles.orderBtn}
          >
            <Ionicons name={order === 'desc' ? 'arrow-down' : 'arrow-up'} size={16} color={COLORS.brandPrimary} />
            <Text style={styles.orderText}>{order === 'desc' ? 'Newest / Z–A' : 'Oldest / A–Z'}</Text>
          </Pressable>
        </View>
      </View>

      {loading && !data ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.brandPrimary} /></View>
      ) : (
        <FlatList
          data={data?.items || []}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: insets.bottom + 100 }}
          renderItem={({ item }) =>
            kind === 'user' ? <UserRow item={item} /> : <JobRow item={item} kind={kind} />
          }
          ListEmptyComponent={<EmptyState icon="search-outline" title="No results" subtitle="Try a different search or filter." />}
        />
      )}

      {data && pages > 0 ? (
        <View style={[styles.pager, { paddingBottom: insets.bottom + SPACING.md }]}>
          <Pressable
            testID="page-prev"
            disabled={page <= 1}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
          >
            <Ionicons name="chevron-back" size={20} color={page <= 1 ? COLORS.muted : COLORS.onSurface} />
          </Pressable>
          <Text style={styles.pageText}>Page {page} of {pages}</Text>
          <Pressable
            testID="page-next"
            disabled={page >= pages}
            onPress={() => setPage((p) => Math.min(pages, p + 1))}
            style={[styles.pageBtn, page >= pages && styles.pageBtnDisabled]}
          >
            <Ionicons name="chevron-forward" size={20} color={page >= pages ? COLORS.muted : COLORS.onSurface} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function JobRow({ item, kind }: { item: any; kind: string }) {
  const isRide = kind === 'ride';
  const meta = isRide ? RIDE_STATUS[item.status] : ORDER_STATUS[item.status];
  return (
    <View style={styles.card} testID={`row-${item.id}`}>
      <View style={styles.cardHead}>
        <View style={styles.cardHeadLeft}>
          <Ionicons name={isRide ? 'bicycle' : 'basket'} size={18} color={isRide ? COLORS.brandPrimary : COLORS.brandSecondary} />
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
          {item.driver_name ? ` · ${item.driver_name}` : ' · unassigned'}
        </Text>
        <Text style={styles.cardPrice}>{peso(isRide ? item.fare : item.estimated_total)}</Text>
      </View>
      <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
    </View>
  );
}

function UserRow({ item }: { item: any }) {
  const color = item.role === 'driver' ? COLORS.brandSecondary : item.role === 'admin' ? COLORS.brandPrimary : COLORS.info;
  return (
    <View style={styles.card} testID={`row-${item.id}`}>
      <View style={styles.cardHead}>
        <View style={styles.cardHeadLeft}>
          <View style={[styles.avatar, { backgroundColor: color + '22' }]}>
            <Text style={[styles.avatarText, { color }]}>{item.name?.[0]?.toUpperCase() || '?'}</Text>
          </View>
          <View>
            <Text style={styles.cardType}>{item.name}</Text>
            <Text style={styles.cardMeta}>{item.phone || item.email || '—'}{item.tricycle_no ? ` · ${item.tricycle_no}` : ''}</Text>
          </View>
        </View>
        <Badge label={item.role} color={color} />
      </View>
      {item.role === 'driver' && item.rating_count > 0 ? (
        <Text style={styles.cardDate}>
          <Ionicons name="star" size={12} color={COLORS.warning} /> {Number(item.rating_avg).toFixed(1)} ({item.rating_count})
          {item.banned ? '  ·  ⛔ Suspended' : ''}
        </Text>
      ) : item.banned ? (
        <Text style={styles.cardDate}>⛔ Suspended</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  controls: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  chip: { height: 36, paddingHorizontal: SPACING.lg, borderRadius: RADIUS.pill, backgroundColor: COLORS.surfaceTertiary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chipActive: { backgroundColor: COLORS.brandPrimary },
  chipText: { fontSize: FONT.base, color: COLORS.muted, fontWeight: WEIGHT.medium },
  chipTextActive: { color: '#fff' },
  orderBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: SPACING.md, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.brandPrimary, flexShrink: 0 },
  orderText: { fontSize: FONT.sm, color: COLORS.brandPrimary, fontWeight: WEIGHT.medium },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  cardHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  cardType: { fontSize: FONT.base, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  cardRoute: { fontSize: FONT.base, color: COLORS.onSurface },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.sm },
  cardMeta: { fontSize: FONT.sm, color: COLORS.muted, flex: 1 },
  cardPrice: { fontSize: FONT.base, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  cardDate: { fontSize: FONT.sm, color: COLORS.muted, marginTop: SPACING.xs },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FONT.lg, fontWeight: WEIGHT.medium },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surfaceSecondary,
  },
  pageBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  pageBtnDisabled: { opacity: 0.4 },
  pageText: { fontSize: FONT.base, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
});
