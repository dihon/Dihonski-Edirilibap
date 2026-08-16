import React, { useState, useMemo } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT, WEIGHT, RADIUS } from '@/src/theme';
import { Input } from '@/src/components/ui';

export function PickerModal({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: string[];
  selected?: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const filtered = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(q.toLowerCase())),
    [options, q],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} testID="picker-backdrop" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + SPACING.lg }]}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
            <Pressable testID="picker-close" onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={26} color={COLORS.muted} />
            </Pressable>
          </View>
          <Input
            icon="search-outline"
            placeholder="Search place..."
            value={q}
            onChangeText={setQ}
            testID="picker-search"
          />
          <FlatList
            data={filtered}
            keyExtractor={(i) => i}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 380 }}
            renderItem={({ item }) => {
              const active = item === selected;
              return (
                <Pressable
                  testID={`picker-option-${item}`}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                  style={({ pressed }) => [styles.opt, pressed && { backgroundColor: COLORS.surfaceTertiary }]}
                >
                  <Ionicons
                    name={active ? 'radio-button-on' : 'location-outline'}
                    size={22}
                    color={active ? COLORS.brandPrimary : COLORS.muted}
                  />
                  <Text style={[styles.optText, active && { color: COLORS.brandPrimary }]}>{item}</Text>
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(30,32,27,0.45)' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: SPACING.lg,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.borderStrong,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  title: { fontSize: FONT.xl, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
    minHeight: 52,
  },
  optText: { fontSize: FONT.lg, color: COLORS.onSurface },
});
