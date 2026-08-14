import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import type { CameraFacing } from '../hooks/useCameraSetup';
import type { RecordingStatus, SaveStatus } from '../hooks/useVideoRecording';

interface CameraControlsProps {
  readonly facing: CameraFacing;
  readonly onToggleFacing: () => void;
  readonly recordingStatus: RecordingStatus;
  readonly saveStatus: SaveStatus;
  readonly onStartRecording: () => void;
  readonly onStopRecording: () => void;
}

const RECORD_LABEL: Record<RecordingStatus, string> = {
  idle: '',
  starting: 'STARTING…',
  recording: '● REC',
  stopping: 'STOPPING…',
  error: 'RECORDING FAILED',
};

/**
 * Only shown while `recordingStatus` is `'idle'` (see the render below) — so
 * this never fights with the record-state label above for the same slot.
 */
const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: '',
  saving: 'SAVING TO PHOTOS…',
  saved: 'SAVED TO PHOTOS',
  error: 'SAVE TO PHOTOS FAILED',
};

/**
 * CameraControls
 *
 * Single responsibility: the on-screen buttons for controlling the camera
 * itself — front/back toggle, and start/stop recording. Pure rendering over
 * props and callbacks, same as `TrackingOverlay` — per `src/screens/index.md`,
 * screens/their sibling components take data, they don't own state.
 *
 * The record button ignores taps during the transitional `'starting'`/
 * `'stopping'` states (the recorder is mid-async-operation — see
 * `src/hooks/useVideoRecording.ts`) rather than queuing a second call.
 */
export function CameraControls({
  facing,
  onToggleFacing,
  recordingStatus,
  saveStatus,
  onStartRecording,
  onStopRecording,
}: CameraControlsProps): React.ReactElement {
  const isRecording = recordingStatus === 'recording';
  const isBusy = recordingStatus === 'starting' || recordingStatus === 'stopping';
  // Only show the save label once recording itself is idle — while
  // starting/recording/stopping, that label owns this slot instead.
  const statusText =
    recordingStatus === 'idle' ? SAVE_LABEL[saveStatus] : RECORD_LABEL[recordingStatus];

  const handleRecordPress = (): void => {
    if (isBusy) return;
    if (isRecording) {
      onStopRecording();
    } else {
      onStartRecording();
    }
  };

  return (
    <>
      <Pressable style={styles.facingButton} onPress={onToggleFacing} hitSlop={12}>
        <Text style={styles.facingLabel}>{facing === 'back' ? 'BACK' : 'FRONT'}</Text>
      </Pressable>

      <View style={styles.recordWrap}>
        {statusText !== '' && <Text style={styles.recordStatusText}>{statusText}</Text>}
        <Pressable
          style={[styles.recordButtonOuter, isBusy && styles.recordButtonOuterBusy]}
          onPress={handleRecordPress}
          hitSlop={12}
        >
          <View style={isRecording ? styles.recordButtonInnerSquare : styles.recordButtonInnerCircle} />
        </Pressable>
      </View>
    </>
  );
}

const RECORD_RED = '#ff3b30';

const styles = StyleSheet.create({
  facingButton: {
    position: 'absolute',
    top: 60,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.overlayPanel,
  },
  facingLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  recordWrap: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  recordStatusText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 1,
  },
  recordButtonOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonOuterBusy: {
    opacity: 0.5,
  },
  recordButtonInnerCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: RECORD_RED,
  },
  recordButtonInnerSquare: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: RECORD_RED,
  },
});
