/**
 * Gimbal control firmware — the production program the micro:bit runs while
 * filming. NOT a test script like `ble-ping`'s echo or `servo-bounds-test`'s
 * sweep — this is what actually drives the robot.
 *
 * REWRITTEN 2026-08-15 FROM MICROPYTHON TO MAKECODE. The original MicroPython
 * version (`import bluetooth; bluetooth.UART(...)`) was confirmed BROKEN —
 * standard MicroPython for micro:bit has no working Bluetooth UART class at
 * all (checked against microbit-micropython's own official docs: only BLE
 * firmware-update features are implemented, nothing usable from user code).
 * MakeCode's Bluetooth extension is the real, working option — proven via a
 * real 20/20-ping round trip against actual hardware, see
 * `.claude/skills/ble-ping/scripts/bench_ping.py` and
 * `research/hardware/microbit-ble-link.md`.
 *
 * TWO REAL BUGS FOUND WHILE PROVING THAT OUT, BOTH RELEVANT HERE:
 *
 * 1. MakeCode's Bluetooth defaults to requiring pairing — a micro:bit
 *    running the default config never advertises for an open scan at all.
 *    Fixed via `pxt.json`'s `yotta.config.microbit-dal.bluetooth` block
 *    (`open: 1, pairing_mode: 0, whitelist: 0`) — this is the CLI/text
 *    equivalent of the MakeCode web editor's Project Settings toggle
 *    "No pairing required: anyone can connect via Bluetooth". Do not remove
 *    it; without it this firmware will run but be undiscoverable.
 *
 * 2. The gimbal packet is BINARY (4 bytes, not text), so the usual MakeCode
 *    pattern of `bluetooth.onUartDataReceived(delimiter, ...)` +
 *    `uartReadUntil(delimiter)` is UNSAFE here — a delimiter byte value
 *    (e.g. newline, 10) can legitimately appear as part of the binary
 *    payload (any delta of exactly ±1.0°, ±25.6°, etc.), which would corrupt
 *    delimiter-based framing. Confirmed empirically: a raw 4-byte payload of
 *    all-0x0A bytes echoed correctly using the approach below, and would NOT
 *    have survived delimiter framing. This firmware instead POLLS
 *    `bluetooth.uartReadBuffer()` directly in the main loop and accumulates
 *    bytes itself — full binary transparency, no delimiter involved at all.
 *
 * WIRE FORMAT — must match `src/ble/encodeGimbalPacket.ts` EXACTLY:
 *     [roll_hi, roll_lo, pitch_hi, pitch_lo]
 *     Two big-endian SIGNED 16-bit integers (two's complement), each a DELTA
 *     in tenths of a degree. Signed because the phone computes deltas, not
 *     absolute angles — this micro:bit adds each delta to its own running
 *     position and clamps to the safe range below. See
 *     `research/hardware/microbit-ble-link.md`'s correction note for why
 *     signed (an earlier draft wrongly proposed unsigned absolute angles).
 *
 * CHARACTERISTIC UUIDS ARE SWAPPED FROM THE "STANDARD" NORDIC UART
 * DESCRIPTION — confirmed via a real GATT dump: MakeCode's `6e400002` is
 * `indicate` (the outbound/TX direction) and `6e400003` is `write` (the
 * inbound/RX direction the phone writes to). `src/ble/useBleConnection.ts`
 * is written against this confirmed layout — nothing to configure here,
 * `bluetooth.startUartService()` sets up both characteristics automatically,
 * this note exists purely so the next person doesn't "fix" a mismatch that
 * isn't a bug.
 *
 * ⚠️ SAFE RANGE BELOW IS A PLACEHOLDER, NOT A MEASUREMENT ⚠️
 * ROLL_SAFE_MIN/MAX and PITCH_SAFE_MIN/MAX are a conservative ±30° guess
 * around centre — NOT the output of `servo-bounds-test`. Run that skill
 * FIRST and replace these four constants with its real measured values
 * before trusting this on the mounted gimbal unattended. Per `CLAUDE.md`
 * §5.2, no agent may mark this as hardware-verified — a human must run
 * `servo-bounds-test`, report the real numbers, and update this file.
 *
 * PREREQUISITES (do not skip):
 *     1. `.claude/skills/ble-ping/` — BLE link proven alive (done, see above).
 *     2. `.claude/skills/servo-bounds-test/` — real safe range measured,
 *        the four constants below updated to match.
 *
 * DISCONNECT BEHAVIOUR: on BLE disconnect, servos simply HOLD their last
 * commanded position (no auto-recentre). Deliberate MVP choice — see the
 * MicroPython predecessor's identical reasoning, still true here.
 *
 * BUILD: from this folder, `npx pxt target microbit && npx pxt install &&
 * npx pxt build` (first run downloads the toolchain, ~1 min; later runs are
 * fast). Copy `built/binary.hex` onto the micro:bit's MICROBIT drive to
 * flash. No browser/web editor needed — the CLI toolchain is complete and
 * produces identical output to the web compiler once this file's `pxt.json`
 * config is correct (that config is exactly what was missing before).
 */

// --- PCA9685 registers, direct writes (sidesteps the centiseconds-vs-
// milliseconds unit trap that MicroPython/MakeCode PCA9685 *extensions*
// have — see research/hardware/pca9685-servo-control.md) ---
const PCA9685_ADDR = 0x40
const MODE1 = 0x00
const PRESCALE = 0xFE
const LED0_ON_L = 0x06

const CHANNEL_ROLL = 0
const CHANNEL_PITCH = 1

const CENTRE_DEG = 90

// ⚠️ PLACEHOLDER — replace with servo-bounds-test's measured values.
let ROLL_SAFE_MIN = 60
let ROLL_SAFE_MAX = 120
let PITCH_SAFE_MIN = 60
let PITCH_SAFE_MAX = 120

const PACKET_LENGTH = 4

function pcaWrite8(reg: number, value: number): void {
    pins.i2cWriteBuffer(PCA9685_ADDR, Buffer.fromArray([reg, value]))
}

function pcaRead8(reg: number): number {
    pins.i2cWriteBuffer(PCA9685_ADDR, Buffer.fromArray([reg]), true)
    return pins.i2cReadBuffer(PCA9685_ADDR, 1).getUint8(0)
}

/** Initialise the PCA9685 at 50 Hz — see servo-bounds-test's script for why 50Hz matters. */
function pcaInit(freqHz: number): void {
    pcaWrite8(MODE1, 0x00)
    basic.pause(10)

    let prescale = Math.round(25000000 / (4096 * freqHz)) - 1

    let oldMode = pcaRead8(MODE1)
    pcaWrite8(MODE1, (oldMode & 0x7F) | 0x10) // sleep, required to set prescale
    pcaWrite8(PRESCALE, prescale)
    pcaWrite8(MODE1, oldMode)
    basic.pause(10)
    pcaWrite8(MODE1, oldMode | 0xA0) // restart + auto-increment
}

/** Command one servo to an absolute angle, clamped to the servo's full 0-180 travel. */
function setAngle(channel: number, degrees: number): void {
    let clamped = Math.max(0, Math.min(180, degrees))
    let pulseMs = 1.0 + (clamped / 180.0)
    let count = Math.trunc(pulseMs * 4096 / 20.0)

    let base = LED0_ON_L + 4 * channel
    pins.i2cWriteBuffer(PCA9685_ADDR, Buffer.fromArray([
        base,
        0x00, 0x00,
        count & 0xFF, (count >> 8) & 0xFF,
    ]))
}

function clampNum(value: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, value))
}

let rollDeg = CENTRE_DEG
let pitchDeg = CENTRE_DEG
let rxBuffer = Buffer.create(0)

bluetooth.startUartService()

bluetooth.onBluetoothConnected(function () {
    basic.showString("C")
})

bluetooth.onBluetoothDisconnected(function () {
    basic.showString("B")
})

pcaInit(50)
setAngle(CHANNEL_ROLL, rollDeg)
setAngle(CHANNEL_PITCH, pitchDeg)
basic.showString("B")

basic.forever(function () {
    let chunk = bluetooth.uartReadBuffer()
    if (chunk.length > 0) {
        rxBuffer = Buffer.concat([rxBuffer, chunk])
    }

    // A BLE write can arrive split or coalesced across multiple polls —
    // accumulate and only ever consume whole 4-byte packets.
    while (rxBuffer.length >= PACKET_LENGTH) {
        let rollDelta = rxBuffer.getNumber(NumberFormat.Int16BE, 0) / 10
        let pitchDelta = rxBuffer.getNumber(NumberFormat.Int16BE, 2) / 10
        rxBuffer = rxBuffer.slice(PACKET_LENGTH)

        rollDeg = clampNum(rollDeg + rollDelta, ROLL_SAFE_MIN, ROLL_SAFE_MAX)
        pitchDeg = clampNum(pitchDeg + pitchDelta, PITCH_SAFE_MIN, PITCH_SAFE_MAX)

        setAngle(CHANNEL_ROLL, rollDeg)
        setAngle(CHANNEL_PITCH, pitchDeg)
        basic.showIcon(IconNames.SmallDiamond)
    }
})
