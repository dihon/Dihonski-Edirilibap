import React, { useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '@/src/theme';
import { EmptyState, Loading } from '@/src/components/ui';
import { AppHeader } from '@/src/components/Header';
import { ActivityCard } from '@/src/components/ActivityCard';
import { api } from '@/src/api';

export default function Activity() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [rides, orders] = await Promise.all([api.myRides(), api.myOrders()]);
      const all = [...(rides as any[]), ...(orders as any[])].sort(
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

  return (
    <View style={styles.container}>
      <AppHeader title="My Activity" subtitle="Rides & pabili orders" />
      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 90 }}
          renderItem={({ item }) => <ActivityCard item={item} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />}
          ListEmptyComponent={
            <EmptyState
              testID="activity-empty"
              icon="documents-outline"
              title="No activity yet"
              subtitle="Your rides and pabili orders will appear here."
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
});
