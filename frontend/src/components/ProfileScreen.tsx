import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { COLORS, SPACING, FONT, WEIGHT, RADIUS } from '@/src/theme';
import { Button, Card, useToast } from '@/src/components/ui';
import { AppHeader } from '@/src/components/Header';
import { useAuth } from '@/src/auth';
import { api } from '@/src/api';

const ROLE_LABEL: Record<string, string> = {
  customer: 'Customer',
  driver: 'Tricycle Driver',
  admin: 'Administrator',
};

export function ProfileScreen({ dark }: { dark?: boolean }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user, logout } = useAuth();
  const [appStatus, setAppStatus] = useState<string>('none');
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      if (user?.role === 'customer') {
        api.driverApplication().then((a: any) => setAppStatus(a.driver_status || 'none')).catch(() => {});
      }
    }, [user?.role]),
  );

  if (!user) return null;
  const initials = user.name
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const doLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteAccount(user.email ? { email: user.email } : { phone: user.phone });
      setShowDelete(false);
      await logout();
      router.replace('/(auth)/login');
    } catch (e: any) {
      toast(e.message || 'Could not delete account', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="My Profile" dark={dark} />
      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Card style={{ alignItems: 'center', paddingVertical: SPACING.xl }}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <View style={styles.roleTag}>
            <Text style={styles.roleText}>{ROLE_LABEL[user.role] || user.role}</Text>
          </View>
        </Card>

        <View style={{ height: SPACING.lg }} />

        <Card style={{ padding: 0 }}>
          <Row icon="call-outline" label="Phone" value={user.phone || '—'} />
          <Divider />
          <Row icon="mail-outline" label="Email" value={user.email || '—'} />
          {user.role === 'driver' ? (
            <>
              <Divider />
              <Row icon="bicycle-outline" label="Tricycle No." value={user.tricycle_no || '—'} />
            </>
          ) : null}
        </Card>

        <View style={{ height: SPACING.xl }} />

        {user.role === 'customer' ? (
          <Card
            testID="become-driver-card"
            onPress={() => router.push('/driver-apply')}
            style={styles.driverCta}
          >
            <View style={styles.ctaIcon}>
              <Ionicons name="bicycle" size={24} color={COLORS.onBrandSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ctaTitle}>
                {appStatus === 'pending'
                  ? 'Driver application under review'
                  : appStatus === 'rejected'
                  ? 'Application rejected — re-apply'
                  : 'Become a Driver'}
              </Text>
              <Text style={styles.ctaSub}>
                {appStatus === 'pending'
                  ? 'Tap to view your application status'
                  : 'Earn by giving rides & doing pabili runs'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
          </Card>
        ) : null}

        <View style={{ height: SPACING.lg }} />
        <Button testID="logout-button" title="Log Out" variant="outline" icon="log-out-outline" onPress={doLogout} />

        {user.role === 'customer' ? (
          <Pressable
            testID="delete-account-button"
            onPress={() => setShowDelete(true)}
            style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="trash-outline" size={18} color={COLORS.error} />
            <Text style={styles.deleteText}>Delete Account</Text>
          </Pressable>
        ) : null}

        <Text style={styles.footer}>Tagkawayan Ride & Pabili · v1.0</Text>
      </ScrollView>

      <Modal visible={showDelete} transparent animationType="fade" onRequestClose={() => setShowDelete(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !deleting && setShowDelete(false)} />
          <View style={styles.dialog}>
            <View style={styles.dialogIcon}>
              <Ionicons name="warning-outline" size={28} color={COLORS.error} />
            </View>
            <Text style={styles.dialogTitle}>Delete your account?</Text>
            <Text style={styles.dialogBody}>
              Are you sure you want to delete your account? This action is permanent and cannot be undone. Your account and
              associated data may be permanently removed.
            </Text>
            <Button
              testID="confirm-delete-account"
              title="Delete"
              variant="danger"
              onPress={confirmDelete}
              loading={deleting}
            />
            <View style={{ height: SPACING.sm }} />
            <Button
              testID="cancel-delete-account"
              title="Cancel"
              variant="outline"
              onPress={() => setShowDelete(false)}
              disabled={deleting}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Row({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={COLORS.brandPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

const Divider = () => <View style={styles.divider} />;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  avatarText: { color: '#fff', fontSize: FONT['2xl'], fontWeight: WEIGHT.medium },
  name: { fontSize: FONT.xl, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  roleTag: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.brandTertiary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.pill,
  },
  roleText: { color: COLORS.onBrandTertiary, fontSize: FONT.sm, fontWeight: WEIGHT.medium },
  row: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, gap: SPACING.md },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.brandTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { fontSize: FONT.sm, color: COLORS.muted },
  rowValue: { fontSize: FONT.lg, color: COLORS.onSurface, marginTop: 2 },
  divider: { height: 1, backgroundColor: COLORS.divider, marginLeft: SPACING.lg + 40 + SPACING.md },
  driverCta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: '#FCE5D6', borderColor: '#F5C9AC' },
  ctaIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.brandSecondary, alignItems: 'center', justifyContent: 'center' },
  ctaTitle: { fontSize: FONT.base, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  ctaSub: { fontSize: FONT.sm, color: COLORS.muted, marginTop: 2 },
  footer: { textAlign: 'center', color: COLORS.muted, marginTop: SPACING.xl, fontSize: FONT.sm },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  deleteText: { color: COLORS.error, fontSize: FONT.base, fontWeight: WEIGHT.medium },
  backdrop: { flex: 1, backgroundColor: 'rgba(30,32,27,0.55)', alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  dialog: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  dialogIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.error + '22',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  dialogTitle: { fontSize: FONT.xl, color: COLORS.onSurface, fontWeight: WEIGHT.medium, textAlign: 'center' },
  dialogBody: { fontSize: FONT.base, color: COLORS.muted, textAlign: 'center', marginTop: SPACING.sm, marginBottom: SPACING.xl, lineHeight: 21 },
});
