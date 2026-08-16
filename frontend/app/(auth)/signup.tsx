import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT, WEIGHT, RADIUS } from '@/src/theme';
import { Button, Input, useToast } from '@/src/components/ui';
import { AppHeader } from '@/src/components/Header';
import { useAuth } from '@/src/auth';

export default function Signup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { signupEmail, signupPhone } = useAuth();
  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      if (!name.trim()) throw new Error('Please enter your full name');
      if (mode === 'email') {
        if (!email.trim() || password.length < 5) throw new Error('Email and a 5+ char password required');
        await signupEmail(name.trim(), email.trim().toLowerCase(), password);
      } else {
        if (!phone.trim()) throw new Error('Please enter your phone number');
        await signupPhone(name.trim(), phone.trim());
      }
      toast('Welcome to Tagkawayan Ride & Pabili!', 'success');
      router.replace('/');
    } catch (e: any) {
      toast(e.message || 'Sign up failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Create account" subtitle="Join your local ride & pabili" back />
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: SPACING.xl, paddingBottom: insets.bottom + SPACING.xl }}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.segment}>
          <Pressable
            testID="signup-mode-phone"
            onPress={() => setMode('phone')}
            style={[styles.segBtn, mode === 'phone' && styles.segActive]}
          >
            <Text style={[styles.segText, mode === 'phone' && styles.segTextActive]}>Phone + Name</Text>
          </Pressable>
          <Pressable
            testID="signup-mode-email"
            onPress={() => setMode('email')}
            style={[styles.segBtn, mode === 'email' && styles.segActive]}
          >
            <Text style={[styles.segText, mode === 'email' && styles.segTextActive]}>Email</Text>
          </Pressable>
        </View>

        <Input
          testID="signup-name-input"
          label="Full name"
          icon="person-outline"
          placeholder="Juan Dela Cruz"
          value={name}
          onChangeText={setName}
        />

        {mode === 'phone' ? (
          <Input
            testID="signup-phone-input"
            label="Phone number"
            icon="call-outline"
            placeholder="+63 917 000 0000"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
        ) : (
          <>
            <Input
              testID="signup-email-input"
              label="Email"
              icon="mail-outline"
              placeholder="you@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Input
              testID="signup-password-input"
              label="Password"
              icon="lock-closed-outline"
              placeholder="At least 5 characters"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </>
        )}

        <View style={{ height: SPACING.sm }} />
        <Button testID="signup-submit-button" title="Create Account" onPress={submit} loading={loading} />

        <Pressable testID="go-to-login" onPress={() => router.back()} style={styles.footerLink}>
          <Text style={styles.footerText}>
            May account na? <Text style={styles.footerStrong}>Mag-log in</Text>
          </Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  segment: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceTertiary,
    borderRadius: RADIUS.md,
    padding: 4,
    marginBottom: SPACING.lg,
  },
  segBtn: { flex: 1, height: 44, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  segActive: { backgroundColor: COLORS.surfaceSecondary },
  segText: { fontSize: FONT.base, color: COLORS.muted, fontWeight: WEIGHT.medium },
  segTextActive: { color: COLORS.brandPrimary },
  footerLink: { marginTop: SPACING.xl, alignItems: 'center' },
  footerText: { color: COLORS.muted, fontSize: FONT.base },
  footerStrong: { color: COLORS.brandPrimary, fontWeight: WEIGHT.medium },
});
