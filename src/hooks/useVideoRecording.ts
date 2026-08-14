import { useCallback, useRef, useState } from 'react';
import {
  CommonResolutions,
  useVideoOutput,
  type CameraVideoOutput,
  type Recorder,
} from 'react-native-vision-camera';
import { Asset, requestPermissionsAsync } from 'expo-media-library';

/**
 * useVideoRecording
 *
 * Single responsibility: own the video-recording native concern (creating a
 * `Recorder`, starting/stopping it, tracking its result, and copying the
 * finished file into the Photos library) so
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
 *
 * PHOTOS LIBRARY SAVE (added 2026-08-14): VisionCamera's `Recorder` always
 * writes to a temp file first (`RecorderSettings.filePath` left unset) —
 * that part is unchanged. `saveRecordingToLibrary` then copies it into
 * Photos via `expo-media-library`'s CURRENT API. **Scar avoided by checking
 * `node_modules` directly (CLAUDE.md §4.1):** every tutorial for this
 * package describes `MediaLibrary.saveToLibraryAsync(uri)` — in the
 * installed version (57.0.3, expo-media-library's "Next" rewrite), that
 * function is re-exported only for backwards compatibility and **throws at
 * runtime** (see `node_modules/expo-media-library/build/legacyWarnings.d.ts`,
 * every export there is `@deprecated ... This method will throw in
 * runtime.`). The real, current call is the static `Asset.create(filePath)`.
 * Permission is requested `writeOnly: true` — this app only ever adds to the
 * library, never reads it, so it doesn't need full photo-library access.
 *
 * A failed Photos save does NOT lose the recording: `lastRecordingPath`
 * still points at the temp file regardless of `saveStatus`, since the
 * temp-file write and the Photos copy are two independent steps that can
 * fail independently — no silent failure (`CLAUDE.md` §3.5).
 *
 * UNVERIFIED ON DEVICE: recording (and now the Photos save) is exactly the
 * kind of feature that fundamentally cannot be proven by
 * `.claude/skills/webcam-detection-preview/` or any other laptop-only test —
 * it needs the real Camera session, the real video encoder, real disk I/O,
 * and a real Photos-library permission prompt. Treat every status here as
 * implemented, not proven, until it's actually run on the iPhone.
 */

export type RecordingStatus = 'idle' | 'starting' | 'recording' | 'stopping' | 'error';
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface VideoRecordingResult {
  /** Pass this alongside the frame output: `<Camera outputs={[frameOutput, videoOutput]} />`. */
  readonly videoOutput: CameraVideoOutput;
  readonly status: RecordingStatus;
  readonly error?: Error;
  /** Filesystem path of the most recently finished recording, if any — set even if the Photos save later fails. */
  readonly lastRecordingPath: string | undefined;
  /** Status of copying `lastRecordingPath` into the Photos library. */
  readonly saveStatus: SaveStatus;
  readonly saveError?: Error;
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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<Error | undefined>(undefined);
  const recorderRef = useRef<Recorder | undefined>(undefined);

  const saveRecordingToLibrary = useCallback(async (filePath: string) => {
    setSaveStatus('saving');
    setSaveError(undefined);
    try {
      const permission = await requestPermissionsAsync(true);
      if (!permission.granted) {
        throw new Error(`Photos library permission not granted (status: ${permission.status})`);
      }
      await Asset.create(filePath);
      setSaveStatus('saved');
    } catch (thrown) {
      setSaveStatus('error');
      setSaveError(thrown instanceof Error ? thrown : new Error(String(thrown)));
    }
  }, []);

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
            void saveRecordingToLibrary(filePath);
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
  }, [status, videoOutput, saveRecordingToLibrary]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder == null) return;
    setStatus('stopping');
    recorder.stopRecording().catch((stopError: Error) => {
      setStatus('error');
      setError(stopError);
    });
  }, []);

  return {
    videoOutput,
    status,
    error,
    lastRecordingPath,
    saveStatus,
    saveError,
    startRecording,
    stopRecording,
  };
}
