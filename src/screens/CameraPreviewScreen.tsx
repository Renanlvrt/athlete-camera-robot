import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import {
  Camera,
  type CameraDevice,
  type CameraFrameOutput,
  type CameraPosition,
  type CameraVideoOutput,
} from 'react-native-vision-camera';

import type { CameraFacing } from '../hooks/useCameraSetup';
import type { DetectionStatus } from '../hooks/useAthleteDetection';
import type { RecordingStatus, SaveStatus } from '../hooks/useVideoRecording';
import type { BleConnectionState } from '../ble/useBleConnection';
import type { PersonBox, PrimaryAthleteResult } from '../tracking/types';
import type { BufferOrientation } from '../tracking/decodeDetections';
import { CameraControls } from './CameraControls';
import { TrackingOverlay } from './TrackingOverlay';
import { BleStatusBadge } from './BleStatusBadge';
import { DebugReadout } from './DebugReadout';

interface CameraPreviewScreenProps {
  readonly device: CameraDevice;
  readonly frameOutput: CameraFrameOutput;
  readonly primary: PrimaryAthleteResult;
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
  /** Resolved camera position, for `DebugReadout` — see that component's own doc comment (TEMPORARY). */
  readonly cameraPosition: CameraPosition;
  /** Raw `Frame.orientation`, for `DebugReadout` — see that component's own doc comment (TEMPORARY). */
  readonly rawOrientation: BufferOrientation | undefined;
  /** Count of every detection this frame, before selection — for `DebugReadout` (TEMPORARY). */
  readonly boxCount: number;
  /** Uncorrected detections, for `TrackingOverlay`'s raw-vs-corrected diagnostic box (TEMPORARY). */
  readonly rawUncorrectedBoxes: readonly PersonBox[];
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
  primary,
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
  cameraPosition,
  rawOrientation,
  boxCount,
  rawUncorrectedBoxes,
}: CameraPreviewScreenProps) {
  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        outputs={[frameOutput, videoOutput]}
      />
      <TrackingOverlay
        primary={primary}
        frameAspectRatio={frameAspectRatio}
        status={detectionStatus}
        rawUncorrectedBoxes={rawUncorrectedBoxes}
      />
      <BleStatusBadge state={bleState} onRetry={onRetryBle} />
      <DebugReadout
        cameraPosition={cameraPosition}
        rawOrientation={rawOrientation}
        isMirrored={cameraPosition === 'front'}
        boxCount={boxCount}
        frameAspectRatio={frameAspectRatio}
      />
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
