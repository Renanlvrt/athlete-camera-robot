# src/theme/ — index

Shared style tokens so screens don't each hard-code hex values.

## Contents

| Name | Type | Responsibility (one line) | Status |
|---|---|---|---|
| `colors.ts` | file | The one source of truth for color values (`background`, `text`) | ✅ verified |

## Depends on
Nothing.

## Depended on by
`src/screens/PermissionRequiredScreen.tsx`, `src/screens/NoCameraDeviceScreen.tsx`.

## Rule for growing this folder
Add `spacing.ts` / `typography.ts` here, same pattern, if/when more than one
screen needs shared values of that kind. Don't let a screen introduce a new
raw hex/px value that isn't already here without adding it here first.
