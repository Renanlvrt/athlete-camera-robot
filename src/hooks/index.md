# src/hooks/ — index

React hooks that own state and side effects. **No JSX/rendering lives
here** — that's `src/screens/`. Every hook exports exactly one thing and
does exactly one job (see `CLAUDE.md` §3).

## Contents

| Name | Type | Responsibility (one line) | Status |
|---|---|---|---|
| `useCameraSetup.ts` | file | Requests camera permission and resolves the back camera device; exposes one discriminated-union status (`requesting-permission` \| `no-device-found` \| `ready`). Does not render anything. | ✅ verified — `tsc --noEmit` passes; behavior matches `docs/PRD.md` §3.1 Milestone 1 scope |

## Depends on
`react`, `react-native-vision-camera` (`useCameraDevice`, `useCameraPermission`, `CameraDevice` type).

## Depended on by
`src/App.tsx` calls `useCameraSetup()` to decide which screen to render.

## Rule for growing this folder
One hook per concern. When BLE pairing/control is implemented, it gets its
own `useBleConnection.ts` (or its own `src/ble/hooks/` if it grows past a
couple of files) — do not add unrelated state to `useCameraSetup.ts`.
