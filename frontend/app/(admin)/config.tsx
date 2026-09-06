import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT, WEIGHT, RADIUS } from '@/src/theme';
import { Button, Input, Loading, useToast, Card } from '@/src/components/ui';
import { AppHeader } from '@/src/components/Header';
import { api } from '@/src/api';

type FieldKey =
  | 'base_fare'
  | 'per_zone'
  | 'pabili_service_fee'
  | 'pabili_per_kg'
  | 'pabili_per_item'
  | 'eta_base_min'
  | 'eta_per_zone_min'
  | 'trusted_min_ratings'
  | 'trusted_min_avg';

const SECTIONS: {
  title: string;
  icon: any;
  color: string;
  fields: { key: FieldKey; label: string; hint: string; prefix?: string; suffix?: string }[];
}[] = [
  {
    title: 'Ride Fare',
    icon: 'bicycle',
    color: COLORS.brandPrimary,
    fields: [
      { key: 'base_fare', label: 'Base fare', hint: 'Minimum fare for any ride', prefix: '₱' },
      { key: 'per_zone', label: 'Per zone', hint: 'Added for each zone of distance', prefix: '₱' },
    ],
  },
  {
    title: 'Pabili Delivery Fee',
    icon: 'basket',
    color: COLORS.brandSecondary,
    fields: [
      { key: 'pabili_service_fee', label: 'Base service fee', hint: 'Flat fee for every pabili', prefix: '₱' },
      { key: 'pabili_per_kg', label: 'Per kilo', hint: 'Added per kilo of total weight', prefix: '₱' },
      { key: 'pabili_per_item', label: 'Per item', hint: 'Added per item requested', prefix: '₱' },
    ],
  },
  {
    title: 'ETA Estimate',
    icon: 'time',
    color: COLORS.info,
    fields: [
      { key: 'eta_base_min', label: 'Base minutes', hint: 'Baseline minutes for any trip', suffix: 'min' },
      { key: 'eta_per_zone_min', label: 'Minutes per zone', hint: 'Added per zone of distance', suffix: 'min' },
    ],
  },
  {
    title: 'Trusted Driver Badge',
    icon: 'shield-checkmark',
    color: COLORS.success,
    fields: [
      { key: 'trusted_min_ratings', label: 'Min. ratings', hint: 'Ratings needed to earn the badge', suffix: '' },
      { key: 'trusted_min_avg', label: 'Min. average stars', hint: 'Average stars needed (e.g. 4.5)', suffix: '' },
    ],
  },
];

export default function AdminConfig() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const cfg = (await api.adminConfig()) as Record<string, number>;
      const v: Record<string, string> = {};
      Object.entries(cfg).forEach(([k, val]) => (v[k] = String(val)));
      setValues(v);
    } catch (e: any) {
      toast(e.message || 'Could not load pricing', 'error');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const save = async () => {
    if (!values) return;
    const body: Record<string, number> = {};
    for (const s of SECTIONS) {
      for (const f of s.fields) {
        const n = Number(values[f.key]);
        if (Number.isNaN(n) || n < 0) {
          return toast(`Enter a valid number for "${f.label}"`, 'error');
        }
        body[f.key] = n;
      }
    }
    setSaving(true);
    try {
      await api.updateConfig(body);
      toast('Pricing updated', 'success');
    } catch (e: any) {
      toast(e.message || 'Could not save', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!values) return <Loading />;

  return (
    <View style={styles.container}>
      <AppHeader title="Pricing Config" subtitle="Set fares & delivery fees" dark />
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 110 }}
        bottomOffset={120}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.info}>
          <Ionicons name="information-circle-outline" size={20} color={COLORS.info} />
          <Text style={styles.infoText}>
            Changes apply instantly to new rides and pabili orders. Existing orders keep their original price.
          </Text>
        </View>

        {SECTIONS.map((section) => (
          <Card key={section.title} style={styles.section}>
            <View style={styles.sectionHead}>
              <View style={[styles.sectionIcon, { backgroundColor: section.color + '22' }]}>
                <Ionicons name={section.icon} size={18} color={section.color} />
              </View>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            {section.fields.map((f) => (
              <View key={f.key} style={styles.fieldWrap}>
                <Input
                  testID={`config-${f.key}`}
                  label={`${f.label}${f.prefix ? ' (₱)' : f.suffix ? ' (min)' : ''}`}
                  keyboardType="decimal-pad"
                  value={values[f.key]}
                  onChangeText={(t) => setValues((prev) => ({ ...(prev as any), [f.key]: t }))}
                />
                <Text style={styles.fieldHint}>{f.hint}</Text>
              </View>
            ))}
          </Card>
        ))}
      </KeyboardAwareScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
        <Button testID="save-config-button" title="Save Pricing" icon="save-outline" onPress={save} loading={saving} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  info: {
    flexDirection: 'row',
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceTertiary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.lg,
  },
  infoText: { flex: 1, color: COLORS.onSurfaceTertiary, fontSize: FONT.base, lineHeight: 20 },
  section: { marginBottom: SPACING.lg },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md },
  sectionIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: FONT.lg, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  fieldWrap: { marginBottom: SPACING.sm },
  fieldHint: { fontSize: FONT.sm, color: COLORS.muted, marginTop: -SPACING.sm, marginBottom: SPACING.sm },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.surfaceSecondary,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});
