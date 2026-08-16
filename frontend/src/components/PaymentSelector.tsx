import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT, WEIGHT, RADIUS } from '@/src/theme';

export type PayMethod = 'cash' | 'gcash';

export function PaymentSelector({ value, onChange }: { value: PayMethod; onChange: (v: PayMethod) => void }) {
  const opts: { key: PayMethod; label: string; sub: string; icon: any }[] = [
    { key: 'cash', label: 'Cash', sub: 'Pay driver directly', icon: 'cash-outline' },
    { key: 'gcash', label: 'GCash', sub: 'Send ref. number', icon: 'phone-portrait-outline' },
  ];
  return (
    <View style={styles.row}>
      {opts.map((o) => {
        const active = value === o.key;
        return (
          <Pressable
            key={o.key}
            testID={`pay-${o.key}`}
            onPress={() => onChange(o.key)}
            style={[styles.opt, active && styles.optActive]}
          >
            <Ionicons name={o.icon} size={22} color={active ? COLORS.brandPrimary : COLORS.muted} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, active && { color: COLORS.brandPrimary }]}>{o.label}</Text>
              <Text style={styles.sub}>{o.sub}</Text>
            </View>
            <Ionicons
              name={active ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={active ? COLORS.brandPrimary : COLORS.borderStrong}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: SPACING.sm },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    minHeight: 56,
  },
  optActive: { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.brandTertiary },
  label: { fontSize: FONT.lg, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  sub: { fontSize: FONT.sm, color: COLORS.muted, marginTop: 2 },
});
