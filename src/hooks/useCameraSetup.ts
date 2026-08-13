import { useCallback, useEffect, useState } from 'react';
import {
  useCameraDevice,
  useCameraPermission,
  type CameraDevice,
} from 'react-native-vision-camera';

/** Which physical camera to use. Deliberately narrower than VisionCamera's own
 * `TargetCameraPosition` (which also allows `'external'`) — this app only ever
 * offers a front/back toggle. */
export type CameraFacing = 'front' | 'back';

interface CameraSetupBase {
  /** Which camera is currently selected. */
  readonly facing: CameraFacing;
  /** Flips between front and back. Always available, regardless of `status` —
   * including from `'no-device-found'`, so a device lacking (say) a front
   * camera never leaves the user stuck with no way back to `'back'`. */
  readonly toggleFacing: () => void;
}

/**
 * The three mutually-exclusive states the camera setup screen can be in.
 * Modeled as a discriminated union (not separate booleans + an optional
 * field) so TypeScript can narrow `device` to a defined value in the
 * 'ready' branch without any non-null assertions at the call site.
 */
export type CameraSetupResult =
  | (CameraSetupBase & { status: 'requesting-permission' })
  | (CameraSetupBase & { status: 'no-device-found' })
  | (CameraSetupBase & { status: 'ready'; device: CameraDevice });

/**
 * useCameraSetup
 *
 * Single responsibility: determine whether the app is allowed to use the
 * camera AND whether a usable device exists for the currently-selected
 * facing, then expose one combined status enum plus the facing toggle.
 *
 * This hook does NOT render anything and does NOT know about UI — see
 * src/screens/ for the three screens that each render one `status` value.
 */
export function useCameraSetup(): CameraSetupResult {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [facing, setFacing] = useState<CameraFacing>('back');
  const device = useCameraDevice(facing);

  const toggleFacing = useCallback(() => {
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  }, []);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  if (!hasPermission) {
    return { status: 'requesting-permission', facing, toggleFacing };
  }

  if (device == null) {
    return { status: 'no-device-found', facing, toggleFacing };
  }

  return { status: 'ready', device, facing, toggleFacing };
}
