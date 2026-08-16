import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, FONT, WEIGHT } from '@/src/theme';

export function AppHeader({
  title,
  subtitle,
  back,
  dark,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  dark?: boolean;
  right?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bg = dark ? COLORS.surfaceInverse : COLORS.surface;
  const fg = dark ? COLORS.onSurfaceInverse : COLORS.onSurface;
  const sub = dark ? '#C7D0BC' : COLORS.muted;
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + SPACING.sm, backgroundColor: bg }]}>
      <View style={styles.row}>
        {back ? (
          <Pressable
            testID="header-back-button"
            onPress={() => router.back()}
            hitSlop={12}
            style={[styles.backBtn, { backgroundColor: dark ? '#3B4A2F' : COLORS.surfaceTertiary }]}
          >
            <Ionicons name="chevron-back" size={24} color={fg} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: fg }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.sub, { color: sub }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: FONT.xl, fontWeight: WEIGHT.medium },
  sub: { fontSize: FONT.base, marginTop: 2 },
});
