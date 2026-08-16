import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT, WEIGHT, RADIUS, SHADOW } from '@/src/theme';
import { Button, Input, useToast } from '@/src/components/ui';
import { AppHeader } from '@/src/components/Header';
import { api } from '@/src/api';

const CATEGORIES: { key: string; label: string; icon: any }[] = [
  { key: 'rude', label: 'Rude', icon: 'sad-outline' },
  { key: 'scammer', label: 'Scammer', icon: 'alert-circle-outline' },
  { key: 'unprofessional', label: 'Unprofessional', icon: 'thumbs-down-outline' },
  { key: 'abusive', label: 'Abusive', icon: 'hand-left-outline' },
  { key: 'drunk', label: 'Drunk', icon: 'wine-outline' },
  { key: 'need_police_action', label: 'Needs Police Action', icon: 'shield-outline' },
];

export default function Report() {
  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!category) return toast('Please choose a complaint type', 'error');
    setSubmitting(true);
    try {
      await api.fileComplaint({
        job_id: id,
        job_type: kind === 'ride' ? 'ride' : 'pabili',
        category,
        description: description.trim(),
      });
      toast('Complaint submitted. Admin will review it.', 'success');
      router.back();
    } catch (e: any) {
      toast(e.message || 'Could not submit complaint', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Report a Problem" subtitle="File a complaint against the driver" back />
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 200 }}
        bottomOffset={120}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.section}>What went wrong?</Text>
        <View style={styles.grid}>
          {CATEGORIES.map((c) => {
            const active = category === c.key;
            const danger = c.key === 'need_police_action';
            return (
              <Pressable
                key={c.key}
                testID={`category-${c.key}`}
                onPress={() => setCategory(c.key)}
                style={[styles.chip, active && (danger ? styles.chipDanger : styles.chipActive)]}
              >
                <Ionicons
                  name={c.icon}
                  size={22}
                  color={active ? '#fff' : danger ? COLORS.error : COLORS.onSurface}
                />
                <Text style={[styles.chipText, active && { color: '#fff' }]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>Tell us more (optional)</Text>
        <Input
          testID="complaint-description"
          placeholder="Describe what happened so the admin can act on it."
          value={description}
          onChangeText={setDescription}
          multiline
          style={{ minHeight: 120, textAlignVertical: 'top' }}
        />

        <View style={styles.info}>
          <Ionicons name="lock-closed-outline" size={18} color={COLORS.info} />
          <Text style={styles.infoText}>
            Your report goes only to the admin. For emergencies, please also contact local authorities directly.
          </Text>
        </View>
      </KeyboardAwareScrollView>

      <KeyboardStickyView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
          <Button testID="submit-complaint-button" title="Submit Complaint" variant="danger" onPress={submit} loading={submitting} />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  section: { fontSize: FONT.lg, color: COLORS.onSurface, fontWeight: WEIGHT.medium, marginBottom: SPACING.md, marginTop: SPACING.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  chip: {
    width: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    minHeight: 56,
  },
  chipActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  chipDanger: { backgroundColor: COLORS.error, borderColor: COLORS.error },
  chipText: { fontSize: FONT.base, color: COLORS.onSurface, fontWeight: WEIGHT.medium, flexShrink: 1 },
  info: { flexDirection: 'row', gap: SPACING.sm, backgroundColor: COLORS.surfaceTertiary, padding: SPACING.md, borderRadius: RADIUS.md, marginTop: SPACING.lg },
  infoText: { flex: 1, color: COLORS.onSurfaceTertiary, fontSize: FONT.base, lineHeight: 20 },
  footer: { backgroundColor: COLORS.surfaceSecondary, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border, ...SHADOW.card },
});
