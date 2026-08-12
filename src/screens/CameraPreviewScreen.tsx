import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { Camera, type CameraDevice, type CameraFrameOutput } from 'react-native-vision-camera';

import type { DetectionStatus } from '../hooks/useAthleteDetection';
import type { PersonBox } from '../tracking/types';
import { TrackingOverlay } from './TrackingOverlay';

interface CameraPreviewScreenProps {
  readonly device: CameraDevice;
  readonly frameOutput: CameraFrameOutput;
  readonly boxes: readonly PersonBox[];
  readonly frameAspectRatio: number | undefined;
  readonly detectionStatus: DetectionStatus;
}

/**
 * CameraPreviewScreen
 *
 * Single responsibility: render the full-screen live camera preview plus the
 * Stage 4 tracking overlay (bounding box, distance/bearing readout, centred
 * indicator) for an already-resolved `CameraDevice`. All detection logic
 * (`src/hooks/useAthleteDetection.ts`) and all tracking decisions
 * (`src/tracking/`) happen upstream — this screen only takes their output as
 * props and draws it, per `src/screens/index.md`.
 */
export function CameraPreviewScreen({
  device,
  frameOutput,
  boxes,
  frameAspectRatio,
  detectionStatus,
}: CameraPreviewScreenProps) {
  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        outputs={[frameOutput]}
      />
      <TrackingOverlay boxes={boxes} frameAspectRatio={frameAspectRatio} status={detectionStatus} />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
