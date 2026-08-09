import { useEffect } from 'react';
import {
  useCameraDevice,
  useCameraPermission,
  type CameraDevice,
} from 'react-native-vision-camera';

/**
 * The three mutually-exclusive states the camera setup screen can be in.
 * Modeled as a discriminated union (not separate booleans + an optional
 * field) so TypeScript can narrow `device` to a defined value in the
 * 'ready' branch without any non-null assertions at the call site.
 */
export type CameraSetupResult =
  | { status: 'requesting-permission' }
  | { status: 'no-device-found' }
  | { status: 'ready'; device: CameraDevice };

/**
 * useCameraSetup
 *
 * Single responsibility: determine whether the app is allowed to use the
 * camera AND whether a usable back-facing camera device exists, then expose
 * one combined status enum.
 *
 * This hook does NOT render anything and does NOT know about UI — see
 * src/screens/ for the three screens that each render one `status` value.
 */
export function useCameraSetup(): CameraSetupResult {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  if (!hasPermission) {
    return { status: 'requesting-permission' };
  }

  if (device == null) {
    return { status: 'no-device-found' };
  }

  return { status: 'ready', device };
}
