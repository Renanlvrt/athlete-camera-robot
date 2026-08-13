import { useCallback, useRef, useState } from 'react';
import {
  CommonResolutions,
  useVideoOutput,
  type CameraVideoOutput,
  type Recorder,
} from 'react-native-vision-camera';

/**
 * useVideoRecording
 *
 * Single responsibility: own the video-recording native concern (creating a
 * `Recorder`, starting/stopping it, tracking its result) so
 * `src/screens/CameraControls.tsx` can stay a pure renderer, same split as
 * `useAthleteDetection.ts` / `TrackingOverlay.tsx`.
 *
 * WRITTEN AGAINST THE REAL v5 API — checked against
 * `node_modules/react-native-vision-camera/lib/hooks/useVideoOutput.d.ts` and
 * `.../specs/outputs/{CameraVideoOutput,Recorder}.nitro.d.ts` directly, not
 * memory or a tutorial (`CLAUDE.md` §4.1). `videoOutput` records the
 * CAMERA's own output — a separate native pipeline from the RN view tree —
 * so the saved file never contains `TrackingOverlay`'s box/readout, only the
 * raw frame, even though the overlay stays visible live on screen while
 * recording. This is not something this hook has to implement; it's just how
 * `<Camera outputs={[frameOutput, videoOutput]}>` works.
 *
 * SCOPE, DELIBERATELY NARROW FOR THIS ROUND: no audio (`enableAudio: false`,
 * the default — avoids needing a microphone permission/Info.plist entry,
 * which would be its own native-config change needing device verification).
 * Recordings are saved wherever VisionCamera's default temporary-file
 * location is (`RecorderSettings.filePath` left unset) — NOT the Photos
 * library. Saving to Photos needs `expo-media-library` (a new native
 * dependency + a new permission), deliberately deferred so this feature
 * doesn't compound multiple unverified native changes into one round — see
 * `docs/VERIFICATION_REPORT.md`.
 *
 * UNVERIFIED ON DEVICE: recording is exactly the kind of feature that
 * fundamentally cannot be proven by `.claude/skills/webcam-detection-preview/`
 * or any other laptop-only test — it needs the real Camera session, the real
 * video encoder, real disk I/O. Treat `status`/`error` here as implemented,
 * not proven, until it's actually run on the iPhone.
 */

export type RecordingStatus = 'idle' | 'starting' | 'recording' | 'stopping' | 'error';

export interface VideoRecordingResult {
  /** Pass this alongside the frame output: `<Camera outputs={[frameOutput, videoOutput]} />`. */
  readonly videoOutput: CameraVideoOutput;
  readonly status: RecordingStatus;
  readonly error?: Error;
  /** Filesystem path of the most recently finished recording, if any. */
  readonly lastRecordingPath: string | undefined;
  readonly startRecording: () => void;
  readonly stopRecording: () => void;
}

export function useVideoRecording(): VideoRecordingResult {
  const videoOutput = useVideoOutput({
    targetResolution: CommonResolutions.FHD_16_9,
    enableAudio: false,
  });

  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [error, setError] = useState<Error | undefined>(undefined);
  const [lastRecordingPath, setLastRecordingPath] = useState<string | undefined>(undefined);
  const recorderRef = useRef<Recorder | undefined>(undefined);

  const startRecording = useCallback(() => {
    if (status === 'recording' || status === 'starting') return;
    setStatus('starting');
    setError(undefined);

    videoOutput
      .createRecorder({})
      .then(async (recorder) => {
        recorderRef.current = recorder;
        await recorder.startRecording(
          (filePath) => {
            setStatus('idle');
            setLastRecordingPath(filePath);
            recorderRef.current = undefined;
          },
          (recordingError) => {
            setStatus('error');
            setError(recordingError);
            recorderRef.current = undefined;
          },
        );
        setStatus('recording');
      })
      .catch((startError: Error) => {
        setStatus('error');
        setError(startError);
      });
  }, [status, videoOutput]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder == null) return;
    setStatus('stopping');
    recorder.stopRecording().catch((stopError: Error) => {
      setStatus('error');
      setError(stopError);
    });
  }, []);

  return { videoOutput, status, error, lastRecordingPath, startRecording, stopRecording };
}
