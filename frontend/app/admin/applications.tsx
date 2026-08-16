import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT, WEIGHT, RADIUS } from '@/src/theme';
import { Button, Input, Card, Badge, EmptyState, Loading, useToast } from '@/src/components/ui';
import { AppHeader } from '@/src/components/Header';
import { AuthImage } from '@/src/components/AuthImage';
import { api } from '@/src/api';

const STATUS_COLOR: Record<string, string> = {
  pending: COLORS.warning,
  approved: COLORS.success,
  rejected: COLORS.error,
};

const DOC_LABELS: { key: string; label: string }[] = [
  { key: 'id_card', label: 'ID / License' },
  { key: 'orcr', label: 'OR / CR' },
  { key: 'tricycle_photo', label: 'Tricycle' },
];

export default function AdminApplications() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<any>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      const all = (await api.adminApplications()) as any[];
      all.sort((a, b) => (a.driver_status === 'pending' ? -1 : 1) - (b.driver_status === 'pending' ? -1 : 1));
      setApps(all);
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

  const approve = async (uid: string) => {
    setBusy(uid);
    try {
      await api.approveApplication(uid);
      toast('Driver approved', 'success');
      load();
    } catch (e: any) {
      toast(e.message || 'Failed', 'error');
    } finally {
      setBusy(null);
    }
  };

  const doReject = async () => {
    if (!rejectFor) return;
    setBusy(rejectFor.id);
    try {
      await api.rejectApplication(rejectFor.id, reason.trim() || 'Documents did not meet requirements');
      toast('Application rejected', 'info');
      setRejectFor(null);
      setReason('');
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
      <AppHeader title="Driver Applications" subtitle={`${apps.filter((a) => a.driver_status === 'pending').length} pending`} back dark />
      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + SPACING.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />}
      >
        {apps.length === 0 ? (
          <EmptyState icon="documents-outline" title="No applications yet" />
        ) : (
          apps.map((a) => (
            <Card key={a.id} style={{ marginBottom: SPACING.md }} testID={`application-${a.id}`}>
              <View style={styles.head}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{a.name}</Text>
                  <Text style={styles.meta}>
                    {a.phone || a.email || '—'} · {a.tricycle_no || 'No tricycle no.'}
                  </Text>
                </View>
                <Badge label={a.driver_status} color={STATUS_COLOR[a.driver_status] || COLORS.muted} />
              </View>

              <View style={styles.docsRow}>
                {DOC_LABELS.map((d) => (
                  <View key={d.key} style={styles.docItem}>
                    <AuthImage path={a.driver_docs?.[d.key]} style={styles.docThumb} />
                    <Text style={styles.docLabel}>{d.label}</Text>
                  </View>
                ))}
              </View>

              {a.driver_status === 'pending' ? (
                <View style={styles.actions}>
                  <Button
                    testID={`reject-${a.id}`}
                    title="Reject"
                    variant="outline"
                    onPress={() => {
                      setRejectFor(a);
                      setReason('');
                    }}
                    style={{ flex: 1 }}
                  />
                  <Button
                    testID={`approve-${a.id}`}
                    title="Approve"
                    onPress={() => approve(a.id)}
                    loading={busy === a.id}
                    style={{ flex: 1 }}
                  />
                </View>
              ) : a.driver_status === 'rejected' && a.rejection_reason ? (
                <Text style={styles.rejReason}>Reason: {a.rejection_reason}</Text>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>

      <Modal visible={!!rejectFor} transparent animationType="slide" onRequestClose={() => setRejectFor(null)}>
        <View style={styles.backdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setRejectFor(null)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + SPACING.lg }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Reject {rejectFor?.name}</Text>
            <Text style={styles.sheetSub}>Let them know what to fix.</Text>
            <Input
              testID="reject-reason-input"
              placeholder="e.g. OR/CR photo is blurry"
              value={reason}
              onChangeText={setReason}
              multiline
            />
            <Button testID="confirm-reject-button" title="Confirm Rejection" variant="danger" onPress={doReject} loading={busy === rejectFor?.id} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  name: { fontSize: FONT.lg, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  meta: { fontSize: FONT.base, color: COLORS.muted, marginTop: 2 },
  docsRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  docItem: { flex: 1, alignItems: 'center' },
  docThumb: { width: '100%', height: 88, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceTertiary },
  docLabel: { fontSize: FONT.sm, color: COLORS.muted, marginTop: SPACING.xs },
  actions: { flexDirection: 'row', gap: SPACING.md },
  rejReason: { fontSize: FONT.base, color: COLORS.error, marginTop: SPACING.xs },
  backdrop: { flex: 1, backgroundColor: 'rgba(30,32,27,0.45)' },
  sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: SPACING.lg },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: COLORS.borderStrong, alignSelf: 'center', marginBottom: SPACING.md },
  sheetTitle: { fontSize: FONT.xl, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  sheetSub: { fontSize: FONT.base, color: COLORS.muted, marginTop: 2, marginBottom: SPACING.lg },
});
