import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT, WEIGHT, RADIUS, SHADOW } from '@/src/theme';
import { Button, Input, useToast, Loading } from '@/src/components/ui';
import { AppHeader } from '@/src/components/Header';
import { AuthImage } from '@/src/components/AuthImage';
import { api, uploadImage } from '@/src/api';
import { useAuth } from '@/src/auth';

type DocKey = 'id_card' | 'orcr' | 'tricycle_photo';
const DOCS: { key: DocKey; label: string; hint: string; icon: any }[] = [
  { key: 'id_card', label: 'Valid Government ID / License', hint: "Driver's license or national ID", icon: 'card-outline' },
  { key: 'orcr', label: 'Tricycle OR / CR', hint: 'Official Receipt / Certificate of Registration', icon: 'document-text-outline' },
  { key: 'tricycle_photo', label: 'Tricycle Photo', hint: 'Clear photo showing the body/plate number', icon: 'camera-outline' },
];

export default function DriverApply() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { refresh } = useAuth();
  const [status, setStatus] = useState<string>('loading');
  const [rejection, setRejection] = useState<string | null>(null);
  const [tricycle, setTricycle] = useState('');
  const [docs, setDocs] = useState<Record<DocKey, string | null>>({ id_card: null, orcr: null, tricycle_photo: null });
  const [uploading, setUploading] = useState<DocKey | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .driverApplication()
      .then((a: any) => {
        setStatus(a.driver_status || 'none');
        setRejection(a.rejection_reason || null);
        if (a.tricycle_no) setTricycle(a.tricycle_no);
        if (a.driver_docs) setDocs({ ...docs, ...a.driver_docs });
      })
      .catch(() => setStatus('none'));
  }, []);

  const pick = async (key: DocKey) => {
    const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    let granted = perm.granted;
    if (!granted && perm.canAskAgain) {
      const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
      granted = req.granted;
    }
    if (!granted) {
      toast('Photo access is needed to upload documents', 'error');
      Linking.openSettings().catch(() => {});
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: false,
    });
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    setUploading(key);
    try {
      const path = await uploadImage(asset.uri, asset.fileName || `${key}.jpg`, asset.mimeType || 'image/jpeg');
      setDocs((prev) => ({ ...prev, [key]: path }));
      toast('Uploaded', 'success');
    } catch (e: any) {
      toast(e.message || 'Upload failed', 'error');
    } finally {
      setUploading(null);
    }
  };

  const submit = async () => {
    if (!tricycle.trim()) return toast('Enter your tricycle number', 'error');
    if (!docs.id_card || !docs.orcr || !docs.tricycle_photo) {
      return toast('Please upload all 3 documents', 'error');
    }
    setSubmitting(true);
    try {
      await api.applyDriver({
        tricycle_no: tricycle.trim(),
        id_card: docs.id_card,
        orcr: docs.orcr,
        tricycle_photo: docs.tricycle_photo,
      });
      await refresh();
      setStatus('pending');
      toast('Application submitted for review!', 'success');
    } catch (e: any) {
      toast(e.message || 'Could not submit', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') return <Loading />;

  if (status === 'pending') {
    return (
      <View style={styles.container}>
        <AppHeader title="Driver Application" back />
        <StatusView
          icon="hourglass-outline"
          color={COLORS.warning}
          title="Under Review"
          message="Naisumite na ang iyong application. Our admin is reviewing your documents. You'll be able to go online once approved."
          onHome={() => router.replace('/(customer)')}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title="Become a Driver" subtitle="Upload documents for approval" back />
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 200 }}
        bottomOffset={120}
        showsVerticalScrollIndicator={false}
      >
        {status === 'rejected' && rejection ? (
          <View style={styles.rejectBox}>
            <Ionicons name="close-circle" size={20} color={COLORS.error} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rejectTitle}>Application rejected</Text>
              <Text style={styles.rejectText}>{rejection}</Text>
              <Text style={styles.rejectText}>Please re-upload and submit again.</Text>
            </View>
          </View>
        ) : null}

        <Input
          testID="apply-tricycle-input"
          label="Tricycle number"
          icon="bicycle-outline"
          placeholder="e.g. TRK-101"
          value={tricycle}
          onChangeText={setTricycle}
        />

        <Text style={styles.section}>Required documents</Text>
        {DOCS.map((d) => (
          <Pressable
            key={d.key}
            testID={`doc-${d.key}`}
            onPress={() => pick(d.key)}
            style={styles.docRow}
          >
            {docs[d.key] ? (
              <AuthImage path={docs[d.key]} style={styles.docThumb} />
            ) : (
              <View style={styles.docIcon}>
                <Ionicons name={d.icon} size={24} color={COLORS.brandPrimary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.docLabel}>{d.label}</Text>
              <Text style={styles.docHint}>{d.hint}</Text>
            </View>
            {uploading === d.key ? (
              <Ionicons name="cloud-upload-outline" size={22} color={COLORS.muted} />
            ) : docs[d.key] ? (
              <View style={styles.doneBadge}>
                <Ionicons name="checkmark" size={16} color="#fff" />
              </View>
            ) : (
              <Ionicons name="add-circle-outline" size={26} color={COLORS.brandPrimary} />
            )}
          </Pressable>
        ))}

        <View style={styles.info}>
          <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.info} />
          <Text style={styles.infoText}>
            Your documents are only reviewed by the admin for driver approval. Approval usually takes a short while.
          </Text>
        </View>
      </KeyboardAwareScrollView>

      <KeyboardStickyView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
          <Button testID="submit-application-button" title="Submit Application" icon="send" onPress={submit} loading={submitting} />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

function StatusView({ icon, color, title, message, onHome }: any) {
  return (
    <View style={styles.statusWrap}>
      <View style={[styles.statusIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={44} color={color} />
      </View>
      <Text style={styles.statusTitle}>{title}</Text>
      <Text style={styles.statusMsg}>{message}</Text>
      <Button title="Back to Home" variant="outline" onPress={onHome} style={{ marginTop: SPACING.xl, alignSelf: 'stretch' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  section: { fontSize: FONT.lg, color: COLORS.onSurface, fontWeight: WEIGHT.medium, marginTop: SPACING.md, marginBottom: SPACING.md },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 72,
  },
  docIcon: { width: 52, height: 52, borderRadius: RADIUS.md, backgroundColor: COLORS.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  docThumb: { width: 52, height: 52, borderRadius: RADIUS.md },
  docLabel: { fontSize: FONT.base, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  docHint: { fontSize: FONT.sm, color: COLORS.muted, marginTop: 2 },
  doneBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center' },
  info: { flexDirection: 'row', gap: SPACING.sm, backgroundColor: COLORS.surfaceTertiary, padding: SPACING.md, borderRadius: RADIUS.md, marginTop: SPACING.sm },
  infoText: { flex: 1, color: COLORS.onSurfaceTertiary, fontSize: FONT.base, lineHeight: 20 },
  rejectBox: { flexDirection: 'row', gap: SPACING.sm, backgroundColor: '#FBE7E4', padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.lg },
  rejectTitle: { fontSize: FONT.base, color: COLORS.error, fontWeight: WEIGHT.medium },
  rejectText: { fontSize: FONT.base, color: COLORS.onSurface, marginTop: 2 },
  footer: { backgroundColor: COLORS.surfaceSecondary, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border, ...SHADOW.card },
  statusWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING['2xl'] },
  statusIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg },
  statusTitle: { fontSize: FONT.xl, color: COLORS.onSurface, fontWeight: WEIGHT.medium },
  statusMsg: { fontSize: FONT.base, color: COLORS.muted, textAlign: 'center', marginTop: SPACING.sm, lineHeight: 22 },
});
