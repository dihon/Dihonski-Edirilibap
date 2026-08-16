import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT, WEIGHT, RADIUS } from '@/src/theme';
import { Button, Input, useToast } from '@/src/components/ui';
import { useAuth } from '@/src/auth';

const HERO =
  'https://images.unsplash.com/photo-1577884551857-f7b320795bfc?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000';

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { loginEmail, loginPhone } = useAuth();
  const [mode, setMode] = useState<'email' | 'phone'>('phone');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      if (mode === 'email') {
        if (!email.trim() || !password) throw new Error('Enter your email and password');
        await loginEmail(email.trim().toLowerCase(), password);
      } else {
        if (!phone.trim() || !name.trim()) throw new Error('Enter your phone number and name');
        await loginPhone(phone.trim(), name.trim());
      }
      router.replace('/');
    } catch (e: any) {
      toast(e.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(43,54,36,0.55)', 'rgba(43,54,36,0.95)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.heroText, { paddingTop: insets.top + SPACING.lg }]}>
          <Text style={styles.brandTag}>TAGKAWAYAN, QUEZON</Text>
          <Text style={styles.brandTitle}>Ride & Pabili</Text>
          <Text style={styles.brandSub}>Book a tricycle or send us to the market — sagot ka namin.</Text>
        </View>
      </View>

      <KeyboardAwareScrollView
        style={styles.sheet}
        contentContainerStyle={{ padding: SPACING.xl, paddingBottom: insets.bottom + SPACING.xl }}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>Maligayang pagbabalik!</Text>
        <Text style={styles.subheading}>Log in to continue.</Text>

        <View style={styles.segment}>
          <Pressable
            testID="login-mode-phone"
            onPress={() => setMode('phone')}
            style={[styles.segBtn, mode === 'phone' && styles.segActive]}
          >
            <Text style={[styles.segText, mode === 'phone' && styles.segTextActive]}>Phone</Text>
          </Pressable>
          <Pressable
            testID="login-mode-email"
            onPress={() => setMode('email')}
            style={[styles.segBtn, mode === 'email' && styles.segActive]}
          >
            <Text style={[styles.segText, mode === 'email' && styles.segTextActive]}>Email</Text>
          </Pressable>
        </View>

        {mode === 'phone' ? (
          <>
            <Input
              testID="login-phone-input"
              label="Phone number"
              icon="call-outline"
              placeholder="+63 917 000 0000"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            <Input
              testID="login-name-input"
              label="Full name"
              icon="person-outline"
              placeholder="Juan Dela Cruz"
              value={name}
              onChangeText={setName}
            />
          </>
        ) : (
          <>
            <Input
              testID="login-email-input"
              label="Email"
              icon="mail-outline"
              placeholder="you@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Input
              testID="login-password-input"
              label="Password"
              icon="lock-closed-outline"
              placeholder="Your password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </>
        )}

        <View style={{ height: SPACING.sm }} />
        <Button testID="login-submit-button" title="Log In" onPress={submit} loading={loading} />

        <Pressable
          testID="go-to-signup"
          onPress={() => router.push('/(auth)/signup')}
          style={styles.footerLink}
        >
          <Text style={styles.footerText}>
            Wala pang account? <Text style={styles.footerStrong}>Mag-sign up</Text>
          </Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surfaceInverse },
  hero: { height: 300 },
  heroText: { flex: 1, justifyContent: 'flex-end', padding: SPACING.xl },
  brandTag: { color: '#DCE8CF', fontSize: FONT.sm, letterSpacing: 2, fontWeight: WEIGHT.medium },
  brandTitle: { color: '#fff', fontSize: 40, fontWeight: WEIGHT.medium, marginTop: SPACING.xs },
  brandSub: { color: '#E8EEDF', fontSize: FONT.base, marginTop: SPACING.sm, lineHeight: 20 },
  sheet: {
    flex: 1,
    marginTop: -24,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  heading: { fontSize: FONT['2xl'], color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  subheading: { fontSize: FONT.base, color: COLORS.muted, marginTop: SPACING.xs, marginBottom: SPACING.lg },
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
