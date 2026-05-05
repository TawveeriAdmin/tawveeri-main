import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X, Camera } from 'lucide-react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { typography, spacing, radii, MIN_TOUCH_TARGET } from '@/src/lib/theme/typography';
import { Button } from '@/src/components/ui';

interface BarcodeScannerProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (data: string) => void;
  locale: string;
}

export function BarcodeScanner({ visible, onClose, onScanned, locale }: BarcodeScannerProps) {
  const { colors } = useTheme();
  const rtl = useRTL();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    onScanned(data);
    onClose();
    // Reset for next open
    setTimeout(() => setScanned(false), 1000);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background }]}>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={locale === 'ar' ? 'إغلاق' : 'Close'}>
            <X size={24} color={colors.label} />
          </Pressable>
          <Text style={[typography.headline, { color: colors.label, flex: 1, textAlign: 'center' }]}>
            {locale === 'ar' ? 'مسح الباركود' : 'Scan Barcode'}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {!permission?.granted ? (
          <View style={styles.permissionContainer}>
            <Camera size={48} color={colors.tertiaryLabel} strokeWidth={1.2} />
            <Text style={[typography.body, { color: colors.secondaryLabel, textAlign: 'center', marginTop: spacing.md }]}>
              {locale === 'ar'
                ? 'يحتاج التطبيق إلى إذن الكاميرا لمسح الباركود'
                : 'Camera permission is needed to scan barcodes'}
            </Text>
            <Button
              title={locale === 'ar' ? 'السماح بالكاميرا' : 'Allow Camera'}
              onPress={requestPermission}
              style={{ marginTop: spacing.lg }}
            />
          </View>
        ) : (
          <View style={styles.cameraContainer}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'],
              }}
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            />
            {/* Scan overlay */}
            <View style={styles.overlay}>
              <View style={[styles.scanFrame, { borderColor: colors.primary }]} />
              <Text style={[typography.subheadline, { color: '#fff', marginTop: spacing.lg, textAlign: 'center' }]}>
                {locale === 'ar'
                  ? 'وجه الكاميرا نحو الباركود'
                  : 'Point your camera at a barcode'}
              </Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderRadius: radii.lg,
  },
});
