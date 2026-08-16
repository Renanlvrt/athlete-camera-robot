# research/hardware/ — index

Findings about the robot side: the BLE link from phone to micro:bit (including the exact
app-side `react-native-ble-plx` API to build against), driving servos through the moto:bit and
PCA9685, and the power/brownout risk that sits under all of it.

Not responsible for: mechanical/3D-printed design (already built, see `docs/PRD.md` §2.1), or
the app-side BLE code itself — that's now `src/ble/` (built 2026-08-14); this folder researches
and documents the facts that code is built against and measures what research alone can't answer.

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| `microbit-ble-link.md` | file | GATT options, library choice, command packet format, and (2026-08-15) the real hardware-confirmed facts: MicroPython BLE doesn't work at all, MakeCode's no-pairing config and reversed RX/TX UUIDs, binary-safe receive approach, measured latency | ✅ verified (bench BLE mechanism) — real 20/20-ping pass; end-to-end app+servo path still open |
| `ble-plx-app-side-implementation.md` | file | The exact `react-native-ble-plx` methods/lifecycle `src/ble/useBleConnection.ts` is built against, read directly from `node_modules`, plus the base64-encoding and permission-flow traps avoided at hardware time | ✅ verified (as research — every API claim confirmed against the real `.d.ts`; the connection lifecycle itself is still untested, no hardware BLE contact yet) |
| `pca9685-servo-control.md` | file | I2C servo driving from micro:bit, the centiseconds footgun, channel assignment matching the firmware, and (2026-08-14) exact wiring guidance for the user's actual USB power bank | ⚠️ needs verification — board now owned/wired (`docs/PRD.md` §8), still not run |
| `power-brownout-risk.md` | file | **Open question** — not resolvable by research, must be measured | ⚠️ open question |
| `power-bank-auto-shutoff.md` | file | Why the micro:bit's USB power bank cuts out after a few seconds (real report, 2026-08-16) — confirmed root cause and fix via official micro:bit docs | ✅ verified — root cause and fix confirmed against official docs + community sources; fix not yet physically applied/reported |
| `ios-ble-connect-hang.md` | file | Why `manager.connectToDevice()` hangs forever with no error on the real iPhone (real report, 2026-08-16) — iOS applies no default connect timeout (confirmed via library docs + Apple docs), plus a hardware-testable stale-bonding hypothesis | ✅ verified (as research — mechanism confirmed against primary sources); root cause on THIS device not confirmed, needs `hardware-tester` |
| `ios-ble-pairing-mismatch.md` | file | Companion angle on the same 2026-08-16 hang: whether `pairing_mode: 0` actually stops iOS CoreBluetooth from attempting pairing/bonding (it does, for a NEW bond — confirmed via CODAL's own security config source), and whether a stale iOS bonding cache from this device's earlier MicroPython-era firmware is the more likely cause of a connect that never resolves or rejects | medium — general iOS bonding-cache mechanism confirmed high-confidence via Apple/Nordic/micro:bit sources; whether it's THIS bug needs the physical phone, routed to `hardware-tester` (check iOS Settings > Bluetooth for a stale entry, try "Forget This Device") |
| `react-native-ble-plx-ios-connect-api.md` | file | Ground-truth audit (2026-08-16) of `connectToDevice`'s real signature/`ConnectionOptions` from `node_modules`, plus the upstream `MultiPlatformBleAdapter` Swift source confirming iOS DOES honor a supplied `timeout` but has no default of its own — the missing `timeout` option in `src/ble/useBleConnection.ts`'s call is a plausible, low-risk-to-fix explanation for the connect-hang | ✅ verified (as research — API surface read directly from installed package + upstream source); NOT hardware-confirmed that adding `timeout` fixes the real device, routed to `hardware-tester` |

## Depends on
Nothing outside this folder.

## Depended on by
`docs/PRD.md` §2 and §7, `.claude/skills/ble-ping/`, `.claude/skills/servo-bounds-test/`,
`.claude/skills/gimbal-control-firmware/`, and `src/ble/`.
