import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, FONT, WEIGHT, RADIUS, RIDE_STATUS, ORDER_STATUS, peso } from '@/src/theme';
import { Card, Badge } from '@/src/components/ui';

export type Job = any;

export function ActivityCard({ item, onPress }: { item: Job; onPress?: () => void }) {
  const router = useRouter();
  const isRide = item.type === 'ride';
  const meta = isRide ? RIDE_STATUS[item.status] : ORDER_STATUS[item.status];
  const go =
    onPress ||
    (() => router.push(`/track/${isRide ? 'ride' : 'pabili'}/${item.id}` as any));

  return (
    <Card testID={`activity-card-${item.id}`} onPress={go} style={styles.card}>
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: isRide ? COLORS.brandTertiary : '#FCE5D6' }]}>
          <Ionicons
            name={isRide ? 'bicycle' : 'basket'}
            size={22}
            color={isRide ? COLORS.brandPrimary : COLORS.brandSecondary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {isRide ? 'Tricycle Ride' : item.store_name || 'Pabili / Market Delivery'}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {isRide ? `${item.pickup} → ${item.dropoff}` : item.delivery_address}
          </Text>
        </View>
        <Text style={styles.price}>{isRide ? peso(item.fare) : peso(item.estimated_total)}</Text>
      </View>
      <View style={styles.bottom}>
        {meta ? <Badge label={meta.label} color={meta.color} /> : null}
        <Text style={styles.date}>{formatWhen(item.created_at)}</Text>
      </View>
    </Card>
  );
}

function formatWhen(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = Date.now();
  const diff = Math.floor((now - d.getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  card: { marginBottom: SPACING.md, borderRadius: RADIUS.lg },
  top: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  icon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FONT.lg, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  sub: { fontSize: FONT.base, color: COLORS.muted, marginTop: 2 },
  price: { fontSize: FONT.lg, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
  },
  date: { fontSize: FONT.sm, color: COLORS.muted },
});
