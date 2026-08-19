import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT, WEIGHT, RADIUS, SHADOW } from '@/src/theme';
import { Button, Input, useToast } from '@/src/components/ui';
import { api } from '@/src/api';

export default function AccountDeletion() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    const v = value.trim();
    if (!v) return toast('Please enter your email or phone number', 'error');
    const body = v.includes('@') ? { email: v.toLowerCase() } : { phone: v };
    setLoading(true);
    try {
      await api.requestDeletion(body);
      setDone(true);
    } catch (e: any) {
      toast(e.message || 'Could not submit request', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAwareScrollView
        contentContainerStyle={{
          paddingTop: insets.top + SPACING.xl,
          paddingBottom: insets.bottom + SPACING.xl,
          paddingHorizontal: SPACING.lg,
          flexGrow: 1,
          alignItems: 'center',
        }}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Image
            source={require('../assets/images/icon.png')}
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={styles.brand}>edirilibap</Text>
          <Text style={styles.subBrand}>Tagkawayan Ride & Pabili</Text>

          {done ? (
            <View style={styles.doneWrap}>
              <View style={styles.doneIcon}>
                <Ionicons name="checkmark-circle" size={44} color={COLORS.success} />
              </View>
              <Text style={styles.doneTitle}>Request received</Text>
              <Text style={styles.doneBody}>
                If an account matches the details you provided, it has been marked for deletion. Our team will process the
                removal of the account and its associated data. You may close this page.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.title}>Request Account Deletion</Text>
              <Text style={styles.body}>
                Enter the email address or phone number linked to your account. We will mark your account for deletion, and
                your account and associated data may be permanently removed. This action cannot be undone.
              </Text>
              <Input
                testID="deletion-identifier-input"
                label="Email or phone number"
                icon="person-outline"
                placeholder="you@email.com  or  +63 917 000 0000"
                autoCapitalize="none"
                value={value}
                onChangeText={setValue}
              />
              <Button
                testID="submit-deletion-request"
                title="Request Deletion"
                variant="danger"
                icon="trash-outline"
                onPress={submit}
                loading={loading}
              />
              <View style={styles.note}>
                <Ionicons name="information-circle-outline" size={18} color={COLORS.info} />
                <Text style={styles.noteText}>
                  Prefer to do it in the app? Open your Profile and tap “Delete Account”.
                </Text>
              </View>
            </>
          )}
        </View>

        <Text style={styles.footer}>© Tagkawayan Ride & Pabili</Text>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surfaceTertiary },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    ...SHADOW.card,
  },
  logo: { width: 84, height: 84, borderRadius: 20 },
  brand: { fontSize: FONT['2xl'], color: COLORS.onSurface, fontWeight: WEIGHT.medium, marginTop: SPACING.md },
  subBrand: { fontSize: FONT.base, color: COLORS.muted, marginBottom: SPACING.xl },
  title: { fontSize: FONT.xl, color: COLORS.onSurface, fontWeight: WEIGHT.medium, alignSelf: 'flex-start' },
  body: {
    fontSize: FONT.base,
    color: COLORS.muted,
    lineHeight: 22,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
    alignSelf: 'flex-start',
  },
  note: {
    flexDirection: 'row',
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceTertiary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.lg,
  },
  noteText: { flex: 1, color: COLORS.onSurfaceTertiary, fontSize: FONT.base, lineHeight: 20 },
  doneWrap: { alignItems: 'center', paddingVertical: SPACING.md },
  doneIcon: { marginBottom: SPACING.md },
  doneTitle: { fontSize: FONT.xl, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  doneBody: { fontSize: FONT.base, color: COLORS.muted, textAlign: 'center', lineHeight: 22, marginTop: SPACING.sm },
  footer: { color: COLORS.muted, fontSize: FONT.sm, marginTop: SPACING.xl },
});
