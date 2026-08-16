import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT, WEIGHT, RADIUS } from '@/src/theme';
import { Button, Input, Loading, useToast, Badge } from '@/src/components/ui';
import { AppHeader } from '@/src/components/Header';
import { api } from '@/src/api';

const ROLE_COLOR: Record<string, string> = {
  customer: COLORS.info,
  driver: COLORS.brandSecondary,
  admin: COLORS.brandPrimary,
};

export default function AdminUsers() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [tricycle, setTricycle] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setUsers((await api.adminUsers()) as any[]);
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

  const changeRole = async (role: string) => {
    if (!selected) return;
    if (role === 'driver' && !tricycle.trim()) {
      return toast('Enter a tricycle number for the driver', 'error');
    }
    setSaving(true);
    try {
      await api.setRole(selected.id, role, tricycle.trim() || undefined);
      toast(`${selected.name} is now ${role}`, 'success');
      setSelected(null);
      setTricycle('');
      load();
    } catch (e: any) {
      toast(e.message || 'Could not update role', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <View style={styles.container}>
      <AppHeader title="Manage Users" subtitle={`${users.length} registered`} dark />
      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />}
        renderItem={({ item }) => (
          <Pressable
            testID={`user-${item.id}`}
            onPress={() => {
              setSelected(item);
              setTricycle(item.tricycle_no || '');
            }}
            style={({ pressed }) => [styles.userRow, pressed && { opacity: 0.9 }]}
          >
            <View style={[styles.avatar, { backgroundColor: ROLE_COLOR[item.role] + '22' }]}>
              <Text style={[styles.avatarText, { color: ROLE_COLOR[item.role] }]}>
                {item.name?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{item.name}</Text>
              <Text style={styles.userMeta} numberOfLines={1}>
                {item.phone || item.email || '—'}
                {item.tricycle_no ? ` · ${item.tricycle_no}` : ''}
              </Text>
            </View>
            <Badge label={item.role} color={ROLE_COLOR[item.role]} />
          </Pressable>
        )}
      />

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.backdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setSelected(null)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + SPACING.lg }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{selected?.name}</Text>
            <Text style={styles.sheetSub}>Change this user's role</Text>

            <Input
              testID="tricycle-input"
              label="Tricycle number (for drivers)"
              icon="bicycle-outline"
              placeholder="e.g. TRK-101"
              value={tricycle}
              onChangeText={setTricycle}
            />

            <Button testID="role-driver" title="Make Driver" onPress={() => changeRole('driver')} loading={saving} />
            <View style={{ height: SPACING.sm }} />
            <Button
              testID="role-customer"
              title="Make Customer"
              variant="outline"
              onPress={() => changeRole('customer')}
              loading={saving}
            />
            <View style={{ height: SPACING.sm }} />
            <Button
              testID="role-admin"
              title="Make Admin"
              variant="ghost"
              onPress={() => changeRole('admin')}
              loading={saving}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FONT.lg, fontWeight: WEIGHT.medium },
  userName: { fontSize: FONT.lg, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  userMeta: { fontSize: FONT.base, color: COLORS.muted, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(30,32,27,0.45)' },
  sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: SPACING.lg },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: COLORS.borderStrong, alignSelf: 'center', marginBottom: SPACING.md },
  sheetTitle: { fontSize: FONT.xl, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  sheetSub: { fontSize: FONT.base, color: COLORS.muted, marginBottom: SPACING.lg, marginTop: 2 },
});
