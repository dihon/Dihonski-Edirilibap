import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT, WEIGHT, RADIUS, SHADOW } from '@/src/theme';
import { EmptyState } from '@/src/components/ui';
import { ActivityCard } from '@/src/components/ActivityCard';
import { useAuth } from '@/src/auth';
import { api } from '@/src/api';

const RIDE_IMG =
  'https://images.unsplash.com/photo-1577884551857-f7b320795bfc?crop=entropy&cs=srgb&fm=jpg&q=85&w=800';
const MARKET_IMG =
  'https://images.unsplash.com/photo-1506484381205-f7945653044d?crop=entropy&cs=srgb&fm=jpg&q=85&w=800';

export default function CustomerHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [recent, setRecent] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [rides, orders] = await Promise.all([api.myRides(), api.myOrders()]);
      const all = [...(rides as any[]), ...(orders as any[])].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setRecent(all.slice(0, 4));
    } catch {
      /* ignore */
    } finally {
      setLoaded(true);
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

  const firstName = user?.name?.split(' ')[0] || 'kabayan';

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + SPACING.lg, paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.hello}>Kumusta,</Text>
            <Text style={styles.name}>{firstName}! 👋</Text>
          </View>
          <View style={styles.locBadge}>
            <Ionicons name="location" size={14} color={COLORS.brandPrimary} />
            <Text style={styles.locText}>Tagkawayan</Text>
          </View>
        </View>

        <Text style={styles.section}>What do you need today?</Text>

        <View style={styles.cardsWrap}>
          <ServiceCard
            testID="home-book-ride"
            image={RIDE_IMG}
            tint="rgba(28,89,44,0.86)"
            tag="TRANSPORT"
            title="Book a Ride"
            sub="Hail a tricycle around town"
            icon="bicycle"
            onPress={() => router.push('/ride/book')}
          />
          <ServiceCard
            testID="home-pabili"
            image={MARKET_IMG}
            tint="rgba(160,64,16,0.86)"
            tag="PABILI"
            title="Market Delivery"
            sub="We buy & deliver to your door"
            icon="basket"
            onPress={() => router.push('/pabili')}
          />
        </View>

        <View style={styles.recentHead}>
          <Text style={styles.section}>Recent Activity</Text>
          {recent.length > 0 ? (
            <Pressable testID="see-all-activity" onPress={() => router.push('/(customer)/activity')}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: SPACING.lg }}>
          {loaded && recent.length === 0 ? (
            <EmptyState
              testID="home-empty"
              icon="rocket-outline"
              title="Ready for your first trip?"
              subtitle="Book a ride or send us to the market — your activity will show up here."
            />
          ) : (
            recent.map((item) => <ActivityCard key={item.id} item={item} />)
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function ServiceCard({
  image,
  tint,
  tag,
  title,
  sub,
  icon,
  onPress,
  testID,
}: {
  image: string;
  tint: string;
  tag: string;
  title: string;
  sub: string;
  icon: any;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.serviceCard, pressed && { transform: [{ scale: 0.98 }] }]}
    >
      <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={['transparent', tint]} style={StyleSheet.absoluteFill} />
      <View style={styles.serviceIcon}>
        <Ionicons name={icon} size={26} color="#fff" />
      </View>
      <View style={styles.serviceText}>
        <Text style={styles.serviceTag}>{tag}</Text>
        <Text style={styles.serviceTitle}>{title}</Text>
        <Text style={styles.serviceSub}>{sub}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  hello: { fontSize: FONT.base, color: COLORS.muted },
  name: { fontSize: FONT['2xl'], color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  locBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.brandTertiary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
  },
  locText: { color: COLORS.onBrandTertiary, fontSize: FONT.sm, fontWeight: WEIGHT.medium },
  section: {
    fontSize: FONT.lg,
    color: COLORS.onSurface,
    fontWeight: WEIGHT.medium,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  cardsWrap: { paddingHorizontal: SPACING.lg, gap: SPACING.md, marginBottom: SPACING.xl },
  serviceCard: {
    height: 150,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    ...SHADOW.card,
  },
  serviceIcon: {
    position: 'absolute',
    top: SPACING.lg,
    right: SPACING.lg,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceText: { padding: SPACING.lg },
  serviceTag: { color: 'rgba(255,255,255,0.85)', fontSize: FONT.sm, letterSpacing: 1.5, fontWeight: WEIGHT.medium },
  serviceTitle: { color: '#fff', fontSize: FONT.xl, fontWeight: WEIGHT.medium, marginTop: 2 },
  serviceSub: { color: 'rgba(255,255,255,0.9)', fontSize: FONT.base, marginTop: 2 },
  recentHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: SPACING.lg,
  },
  seeAll: { color: COLORS.brandPrimary, fontSize: FONT.base, fontWeight: WEIGHT.medium },
});
