import { useCameraSetup } from './hooks/useCameraSetup';
import { useAthleteDetection } from './hooks/useAthleteDetection';
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
 * useAthleteDetection() is called unconditionally (Rules of Hooks) even
 * though its output is only rendered in the 'ready' branch — model loading
 * and frame-output setup don't depend on the camera device being resolved.
 *
 * This is Stage 4 of the implementation plan (live preview + person
 * detection + tracking overlay). See docs/PRD.md §4 for the full roadmap and
 * docs/VERIFICATION_REPORT.md for what has been tested so far.
 */
export default function App() {
  const setup = useCameraSetup();
  const detection = useAthleteDetection();

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
        />
      );
  }
}
