import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import {
  Camera,
  type CameraDevice,
  type CameraFrameOutput,
  type CameraVideoOutput,
} from 'react-native-vision-camera';

import type { CameraFacing } from '../hooks/useCameraSetup';
import type { DetectionStatus } from '../hooks/useAthleteDetection';
import type { RecordingStatus } from '../hooks/useVideoRecording';
import type { PersonBox } from '../tracking/types';
import { CameraControls } from './CameraControls';
import { TrackingOverlay } from './TrackingOverlay';

interface CameraPreviewScreenProps {
  readonly device: CameraDevice;
  readonly frameOutput: CameraFrameOutput;
  readonly boxes: readonly PersonBox[];
  readonly frameAspectRatio: number | undefined;
  readonly detectionStatus: DetectionStatus;
  readonly facing: CameraFacing;
  readonly onToggleFacing: () => void;
  readonly videoOutput: CameraVideoOutput;
  readonly recordingStatus: RecordingStatus;
  readonly onStartRecording: () => void;
  readonly onStopRecording: () => void;
}

/**
 * CameraPreviewScreen
 *
 * Single responsibility: render the full-screen live camera preview plus the
 * Stage 4 tracking overlay (bounding box, distance/bearing readout, centred
 * indicator), the front/back toggle, and the record button, for an
 * already-resolved `CameraDevice`. All detection logic
 * (`src/hooks/useAthleteDetection.ts`) and all tracking decisions
 * (`src/tracking/`) happen upstream — this screen only takes their output as
 * props and draws it, per `src/screens/index.md`. `videoOutput` records the
 * camera's raw feed directly (see `src/hooks/useVideoRecording.ts`) — the
 * overlay drawn here is never in the saved file, only on screen.
 */
export function CameraPreviewScreen({
  device,
  frameOutput,
  boxes,
  frameAspectRatio,
  detectionStatus,
  facing,
  onToggleFacing,
  videoOutput,
  recordingStatus,
  onStartRecording,
  onStopRecording,
}: CameraPreviewScreenProps) {
  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        outputs={[frameOutput, videoOutput]}
      />
      <TrackingOverlay boxes={boxes} frameAspectRatio={frameAspectRatio} status={detectionStatus} />
      <CameraControls
        facing={facing}
        onToggleFacing={onToggleFacing}
        recordingStatus={recordingStatus}
        onStartRecording={onStartRecording}
        onStopRecording={onStopRecording}
      />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
