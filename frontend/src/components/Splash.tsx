import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';

export function Splash() {
  return (
    <View style={styles.container} testID="app-splash">
      <Image
        source={require('../../assets/images/icon.png')}
        style={styles.logo}
        contentFit="contain"
      />
      <Text style={styles.tag}>TAGKAWAYAN · QUEZON</Text>
      <ActivityIndicator color="#FFFFFF" style={{ marginTop: 20 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#3E6DB3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 220, height: 220, borderRadius: 44 },
  tag: {
    color: '#DCE8FF',
    fontSize: 12,
    letterSpacing: 3,
    fontWeight: '500',
    marginTop: 18,
  },
});
