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
import type { RecordingStatus, SaveStatus } from '../hooks/useVideoRecording';
import type { BleConnectionState } from '../ble/useBleConnection';
import type { PersonBox } from '../tracking/types';
import { CameraControls } from './CameraControls';
import { TrackingOverlay } from './TrackingOverlay';
import { BleStatusBadge } from './BleStatusBadge';

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
  readonly saveStatus: SaveStatus;
  readonly onStartRecording: () => void;
  readonly onStopRecording: () => void;
  readonly bleState: BleConnectionState;
  readonly onRetryBle: () => void;
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
  saveStatus,
  onStartRecording,
  onStopRecording,
  bleState,
  onRetryBle,
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
      <BleStatusBadge state={bleState} onRetry={onRetryBle} />
      <CameraControls
        facing={facing}
        onToggleFacing={onToggleFacing}
        recordingStatus={recordingStatus}
        saveStatus={saveStatus}
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
