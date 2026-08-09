import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { Camera, type CameraDevice } from 'react-native-vision-camera';

interface CameraPreviewScreenProps {
  device: CameraDevice;
}

/**
 * CameraPreviewScreen
 *
 * Single responsibility: render a full-screen live preview for a known,
 * already-permitted, already-resolved camera device.
 *
 * STAGE 4 (person detection / bounding-box overlay) is NOT implemented
 * here yet. That requires a native frame-processor plugin — see
 * docs/PRD.md §4 and the root index.md roadmap before adding it.
 */
export function CameraPreviewScreen({ device }: CameraPreviewScreenProps) {
  return (
    <View style={styles.container}>
      <Camera style={StyleSheet.absoluteFill} device={device} isActive={true} />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
