import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, WEIGHT, RADIUS, SPACING } from '@/src/theme';

export function TrustedBadge({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.badge, compact && styles.compact]} testID="trusted-badge">
      <Ionicons name="shield-checkmark" size={compact ? 12 : 14} color={COLORS.brandPrimary} />
      <Text style={[styles.text, compact && styles.textCompact]}>Trusted</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.brandTertiary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    alignSelf: 'flex-start',
  },
  compact: { paddingVertical: 2 },
  text: { fontSize: FONT.sm, color: COLORS.onBrandTertiary, fontWeight: WEIGHT.medium },
  textCompact: { fontSize: 11 },
});
