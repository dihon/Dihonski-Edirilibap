import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { fileUrl } from '@/src/api';
import { COLORS } from '@/src/theme';

export function AuthImage({ path, style }: { path?: string | null; style?: StyleProp<ViewStyle> }) {
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    if (path) {
      fileUrl(path).then((u) => alive && setUri(u));
    }
    return () => {
      alive = false;
    };
  }, [path]);

  if (!path) {
    return (
      <View style={[styles.fallback, style]}>
        <Ionicons name="image-outline" size={28} color={COLORS.muted} />
      </View>
    );
  }
  if (!uri) {
    return (
      <View style={[styles.fallback, style]}>
        <ActivityIndicator color={COLORS.brandPrimary} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={[styles.fallback, style]}>
        <Ionicons name="alert-circle-outline" size={28} color={COLORS.error} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={style as any}
      contentFit="cover"
      onError={() => setError(true)}
      transition={200}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: COLORS.surfaceTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
