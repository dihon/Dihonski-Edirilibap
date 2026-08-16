import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  TextInputProps,
  ViewStyle,
  StyleProp,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, RADIUS, FONT, WEIGHT, SHADOW } from '@/src/theme';

// ---------------- Button ----------------
type BtnProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
  testID,
}: BtnProps) {
  const bg = {
    primary: COLORS.brandPrimary,
    secondary: COLORS.brandSecondary,
    outline: 'transparent',
    ghost: 'transparent',
    danger: COLORS.error,
  }[variant];
  const fg = {
    primary: COLORS.onBrandPrimary,
    secondary: COLORS.onBrandSecondary,
    outline: COLORS.brandPrimary,
    ghost: COLORS.onSurface,
    danger: COLORS.onError,
  }[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      testID={testID}
      disabled={isDisabled}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg },
        variant === 'outline' && { borderWidth: 1.5, borderColor: COLORS.brandPrimary },
        isDisabled && { opacity: 0.5 },
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.btnRow}>
          {icon && <Ionicons name={icon} size={20} color={fg} style={{ marginRight: SPACING.sm }} />}
          <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ---------------- Card ----------------
export function Card({
  children,
  style,
  onPress,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  testID?: string;
}) {
  const content = <View style={[styles.card, style]}>{children}</View>;
  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] }}
      >
        {content}
      </Pressable>
    );
  }
  return <View testID={testID}>{content}</View>;
}

// ---------------- Input ----------------
export const Input = React.forwardRef<TextInput, TextInputProps & { label?: string; icon?: keyof typeof Ionicons.glyphMap }>(
  ({ label, icon, style, ...props }, ref) => {
    return (
      <View style={{ marginBottom: SPACING.md }}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <View style={styles.inputWrap}>
          {icon && <Ionicons name={icon} size={20} color={COLORS.muted} style={{ marginRight: SPACING.sm }} />}
          <TextInput
            ref={ref}
            placeholderTextColor={COLORS.muted}
            style={[styles.input, style]}
            {...props}
          />
        </View>
      </View>
    );
  },
);
Input.displayName = 'Input';

// ---------------- Badge ----------------
export function Badge({ label, color, testID }: { label: string; color: string; testID?: string }) {
  return (
    <View testID={testID} style={[styles.badge, { backgroundColor: color + '22' }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.badgeText, { color: COLORS.onSurface }]}>{label}</Text>
    </View>
  );
}

// ---------------- EmptyState ----------------
export function EmptyState({
  icon = 'sparkles-outline',
  title,
  subtitle,
  testID,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  testID?: string;
}) {
  return (
    <View testID={testID} style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={40} color={COLORS.brandPrimary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
    </View>
  );
}

// ---------------- Loading ----------------
export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={COLORS.brandPrimary} />
    </View>
  );
}

// ---------------- Toast ----------------
type ToastType = 'success' | 'error' | 'info';
const ToastCtx = createContext<(msg: string, type?: ToastType) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState('');
  const [type, setType] = useState<ToastType>('info');
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (m: string, t: ToastType = 'info') => {
      setMsg(m);
      setType(t);
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start();
      }, 2600);
    },
    [opacity],
  );

  const bg = type === 'success' ? COLORS.success : type === 'error' ? COLORS.error : COLORS.surfaceInverse;
  const icon = type === 'success' ? 'checkmark-circle' : type === 'error' ? 'alert-circle' : 'information-circle';

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <Animated.View pointerEvents="none" style={[styles.toast, { opacity }]}>
        <View style={[styles.toastInner, { backgroundColor: bg }]}>
          <Ionicons name={icon as any} size={20} color="#fff" />
          <Text style={styles.toastText} numberOfLines={2}>
            {msg}
          </Text>
        </View>
      </Animated.View>
    </ToastCtx.Provider>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 56,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    ...SHADOW.soft,
  },
  btnRow: { flexDirection: 'row', alignItems: 'center' },
  btnText: { fontSize: FONT.lg, fontWeight: WEIGHT.medium },
  card: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
  },
  label: { fontSize: FONT.base, color: COLORS.muted, marginBottom: SPACING.xs, fontWeight: WEIGHT.medium },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceTertiary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    minHeight: 56,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  input: { flex: 1, fontSize: FONT.lg, color: COLORS.onSurface, paddingVertical: SPACING.md },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.pill,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: SPACING.sm },
  badgeText: { fontSize: FONT.sm, fontWeight: WEIGHT.medium },
  empty: { alignItems: 'center', justifyContent: 'center', padding: SPACING['2xl'] },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.brandTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: { fontSize: FONT.xl, color: COLORS.onSurface, fontWeight: WEIGHT.medium, textAlign: 'center' },
  emptySub: { fontSize: FONT.base, color: COLORS.muted, textAlign: 'center', marginTop: SPACING.sm, lineHeight: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING['2xl'] },
  toast: { position: 'absolute', bottom: 90, left: SPACING.lg, right: SPACING.lg, alignItems: 'center' },
  toastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    maxWidth: '100%',
    ...SHADOW.card,
  },
  toastText: { color: '#fff', fontSize: FONT.base, marginLeft: SPACING.sm, flexShrink: 1, fontWeight: WEIGHT.medium },
});
