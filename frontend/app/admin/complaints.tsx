import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT, WEIGHT, RADIUS } from '@/src/theme';
import { Button, Card, Badge, EmptyState, Loading, useToast } from '@/src/components/ui';
import { AppHeader } from '@/src/components/Header';
import { api } from '@/src/api';

const CAT_LABEL: Record<string, string> = {
  rude: 'Rude',
  scammer: 'Scammer',
  unprofessional: 'Unprofessional',
  abusive: 'Abusive',
  drunk: 'Drunk',
  need_police_action: 'Needs Police Action',
};

export default function AdminComplaints() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems((await api.adminComplaints()) as any[]);
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

  const resolve = async (id: string) => {
    setBusy(id);
    try {
      await api.resolveComplaint(id);
      toast('Marked as reviewed', 'success');
      load();
    } catch (e: any) {
      toast(e.message || 'Failed', 'error');
    } finally {
      setBusy(null);
    }
  };

  const suspend = async (driverId: string, name: string) => {
    setBusy(driverId);
    try {
      await api.banUser(driverId, true, 'Suspended due to complaint');
      toast(`${name} suspended`, 'info');
      load();
    } catch (e: any) {
      toast(e.message || 'Failed', 'error');
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <Loading />;

  return (
    <View style={styles.container}>
      <AppHeader title="Complaints" subtitle={`${items.filter((c) => c.status === 'open').length} open`} back dark />
      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + SPACING.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />}
      >
        {items.length === 0 ? (
          <EmptyState icon="shield-checkmark-outline" title="No complaints" subtitle="All clear — no complaints filed." />
        ) : (
          items.map((c) => {
            const police = c.category === 'need_police_action';
            return (
              <Card key={c.id} style={{ marginBottom: SPACING.md }} testID={`complaint-${c.id}`}>
                <View style={styles.head}>
                  <View style={[styles.catTag, { backgroundColor: (police ? COLORS.error : COLORS.warning) + '22' }]}>
                    <Ionicons name={police ? 'shield' : 'flag'} size={14} color={police ? COLORS.error : COLORS.warning} />
                    <Text style={[styles.catText, { color: police ? COLORS.error : COLORS.onSurface }]}>
                      {CAT_LABEL[c.category] || c.category}
                    </Text>
                  </View>
                  <Badge label={c.status} color={c.status === 'open' ? COLORS.warning : COLORS.success} />
                </View>

                <Text style={styles.line}>
                  <Text style={styles.lineLabel}>Driver: </Text>
                  {c.driver_name || '—'}
                </Text>
                <Text style={styles.line}>
                  <Text style={styles.lineLabel}>From: </Text>
                  {c.customer_name}
                </Text>
                {c.description ? <Text style={styles.desc}>“{c.description}”</Text> : null}

                <View style={styles.actions}>
                  <Button
                    testID={`suspend-${c.id}`}
                    title="Suspend Driver"
                    variant="danger"
                    onPress={() => suspend(c.driver_id, c.driver_name)}
                    loading={busy === c.driver_id}
                    style={{ flex: 1 }}
                  />
                  {c.status === 'open' ? (
                    <Button
                      testID={`resolve-${c.id}`}
                      title="Reviewed"
                      variant="outline"
                      onPress={() => resolve(c.id)}
                      loading={busy === c.id}
                      style={{ flex: 1 }}
                    />
                  ) : null}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  catTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.pill },
  catText: { fontSize: FONT.sm, fontWeight: WEIGHT.medium },
  line: { fontSize: FONT.base, color: COLORS.onSurface, marginBottom: 2 },
  lineLabel: { color: COLORS.muted },
  desc: { fontSize: FONT.base, color: COLORS.onSurface, fontStyle: 'italic', marginTop: SPACING.sm, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md },
});
