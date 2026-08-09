import { useCameraSetup } from './hooks/useCameraSetup';
import { PermissionRequiredScreen } from './screens/PermissionRequiredScreen';
import { NoCameraDeviceScreen } from './screens/NoCameraDeviceScreen';
import { CameraPreviewScreen } from './screens/CameraPreviewScreen';

/**
 * App
 *
 * Single responsibility: composition root. It asks useCameraSetup for the
 * current status and renders exactly one screen for that status. It must
 * never contain camera logic, styling, or permission logic itself — those
 * live in src/hooks/ and src/screens/ respectively.
 *
 * This is Milestone 1 / Stage 3 of the implementation plan (live camera
 * preview only). See docs/PRD.md for the full roadmap and
 * docs/VERIFICATION_REPORT.md for what has been tested so far.
 */
export default function App() {
  const setup = useCameraSetup();

  switch (setup.status) {
    case 'requesting-permission':
      return <PermissionRequiredScreen />;
    case 'no-device-found':
      return <NoCameraDeviceScreen />;
    case 'ready':
      return <CameraPreviewScreen device={setup.device} />;
  }
}
