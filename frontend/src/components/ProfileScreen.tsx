import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, FONT, WEIGHT, RADIUS } from '@/src/theme';
import { Button, Card } from '@/src/components/ui';
import { AppHeader } from '@/src/components/Header';
import { useAuth } from '@/src/auth';

const ROLE_LABEL: Record<string, string> = {
  customer: 'Customer',
  driver: 'Tricycle Driver',
  admin: 'Administrator',
};

export function ProfileScreen({ dark }: { dark?: boolean }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
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
        <Button testID="logout-button" title="Log Out" variant="outline" icon="log-out-outline" onPress={doLogout} />

        <Text style={styles.footer}>Tagkawayan Ride & Pabili · v1.0</Text>
      </ScrollView>
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
  footer: { textAlign: 'center', color: COLORS.muted, marginTop: SPACING.xl, fontSize: FONT.sm },
});
