import { useCameraSetup } from './hooks/useCameraSetup';
import { useAthleteDetection } from './hooks/useAthleteDetection';
import { useVideoRecording } from './hooks/useVideoRecording';
import { PermissionRequiredScreen } from './screens/PermissionRequiredScreen';
import { NoCameraDeviceScreen } from './screens/NoCameraDeviceScreen';
import { CameraPreviewScreen } from './screens/CameraPreviewScreen';

/**
 * App
 *
 * Single responsibility: composition root. It asks useCameraSetup for the
 * current status and useAthleteDetection for the current frame's
 * detections, and renders exactly one screen for that status. It must never
 * contain camera logic, styling, or permission/detection logic itself —
 * those live in src/hooks/ and src/screens/ respectively.
 *
 * useAthleteDetection() and useVideoRecording() are called unconditionally
 * (Rules of Hooks) even though their output is only rendered in the 'ready'
 * branch — model loading, frame-output, and video-output setup don't depend
 * on the camera device being resolved.
 *
 * This is Stage 4 of the implementation plan (live preview + person
 * detection + tracking overlay). See docs/PRD.md §4 for the full roadmap and
 * docs/VERIFICATION_REPORT.md for what has been tested so far.
 */
export default function App() {
  const setup = useCameraSetup();
  // Prefer the RESOLVED device's own reported position (ground truth) once
  // known; fall back to the requested facing before that — see
  // useAthleteDetection.ts's doc comment for why this replaced Frame.isMirrored.
  const cameraPosition = setup.status === 'ready' ? setup.device.position : setup.facing;
  const detection = useAthleteDetection(cameraPosition);
  const recording = useVideoRecording();

  switch (setup.status) {
    case 'requesting-permission':
      return <PermissionRequiredScreen />;
    case 'no-device-found':
      return <NoCameraDeviceScreen />;
    case 'ready':
      return (
        <CameraPreviewScreen
          device={setup.device}
          frameOutput={detection.frameOutput}
          boxes={detection.boxes}
          frameAspectRatio={detection.frameAspectRatio}
          detectionStatus={detection.status}
          facing={setup.facing}
          onToggleFacing={setup.toggleFacing}
          videoOutput={recording.videoOutput}
          recordingStatus={recording.status}
          onStartRecording={recording.startRecording}
          onStopRecording={recording.stopRecording}
        />
      );
  }
}
