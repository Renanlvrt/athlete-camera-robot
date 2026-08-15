/**
 * Gimbal LED simulator — visualizes the real gimbal-correction packets on
 * the 5x5 LED matrix instead of driving servos. No PCA9685, no I2C, no
 * motors — this firmware never touches anything but the display, by
 * design, so it's safe to run with nothing but the micro:bit itself
 * connected. Written 2026-08-15 specifically so the full pipeline (CV
 * detection -> selectPrimaryAthlete -> computeGimbalCorrection -> BLE ->
 * firmware) can be validated end to end before any servo is ever wired in.
 *
 * WIRE FORMAT — identical to `.claude/skills/gimbal-control-firmware/`,
 * matching `src/ble/encodeGimbalPacket.ts` exactly: `[roll_hi, roll_lo,
 * pitch_hi, pitch_lo]`, two big-endian signed int16 deltas (tenths of a
 * degree). The app doesn't know or care whether this firmware or the real
 * servo-driving one is running — same packets either way. Uses the same
 * no-pairing config and raw-buffer-polling receive approach as
 * `gimbal-control-firmware` and `ble-ping`, both hardware-confirmed working
 * — see `research/hardware/microbit-ble-link.md`.
 *
 * THREE DISPLAY STATES, mapped from what a received packet means:
 *
 * 1. NO PACKET for `NO_DETECTION_TIMEOUT_MS` -> "X" icon. There is no
 *    "nobody detected" packet — `useGimbalControl.ts` simply sends nothing
 *    at all when `selectPrimaryAthlete` returns `'no-athletes'` (see that
 *    hook's own source). So "no athlete" has to be inferred from an
 *    absence of packets, not a packet value — this is a watchdog timeout,
 *    not a decode of anything received.
 * 2. Packet received with BOTH deltas exactly 0 -> filled-square icon
 *    ("centered"). This isn't a guess — `computeGimbalCorrection.ts`'s
 *    deadband makes a correction exactly (0,0) precisely when the athlete
 *    is within the centred buffer, and the hook still sends that (0,0)
 *    packet (it only skips sending when there's NO locked athlete at all,
 *    not when the correction happens to be zero). A (0,0) packet is a
 *    reliable, real "centred" signal.
 * 3. Packet received with a nonzero delta -> arrow pointing from the
 *    athlete's position TOWARD frame centre. Per `computeGimbalCorrection.ts`'s
 *    documented sign convention, a positive rollDelta means the athlete is
 *    to the RIGHT of centre (the servo would pan right to CHASE them) —
 *    the opposite of what this arrow shows. The arrow here deliberately
 *    shows the OPPOSITE (point toward centre, not the chase direction) —
 *    this is what was actually asked for ("box is bottom left -> arrow
 *    shows top right": centre IS top-right of a bottom-left athlete).
 *    Implemented as a straight sign negation of the received deltas, nothing
 *    fancier — see `arrowFor()` below.
 *
 * NOT USING `basic.showIcon`/`basic.showArrow`: both pause execution for
 * their `interval` (default 600ms) before returning — fine for a one-shot
 * animation, wrong for a live display that must react to the NEXT packet
 * immediately. Using `images.createImage(literal).plotImage(0)` instead —
 * `plotImage` sets the display buffer directly with no built-in delay, so
 * the polling loop below is never blocked waiting on a previous frame's
 * animation. (`basic.plotLeds()` looked like the more obvious choice but
 * the MakeCode compiler requires its argument to be an inline string
 * literal at the call site, not a variable — confirmed by trying it first
 * and getting `TS9214: Only image literals supported here`; images built
 * once via `createImage` and stored as `Image` objects don't have that
 * restriction, since the literal-only rule only applies to the `createImage`
 * call itself.) The 8 arrow bitmaps are copied from MakeCode's own built-in
 * `ArrowNames` images (`node_modules/pxt-microbit`'s `core/icons.ts`) for
 * visual consistency.
 */

bluetooth.startUartService()

const PACKET_LENGTH = 4
const NO_DETECTION_TIMEOUT_MS = 1500

const ARROW_N = images.createImage(`
    . . # . .
    . # # # .
    # . # . #
    . . # . .
    . . # . .`)
const ARROW_NE = images.createImage(`
    . . # # #
    . . . # #
    . . # . #
    . # . . .
    # . . . .`)
const ARROW_E = images.createImage(`
    . . # . .
    . . . # .
    # # # # #
    . . . # .
    . . # . .`)
const ARROW_SE = images.createImage(`
    # . . . .
    . # . . .
    . . # . #
    . . . # #
    . . # # #`)
const ARROW_S = images.createImage(`
    . . # . .
    . . # . .
    # . # . #
    . # # # .
    . . # . .`)
const ARROW_SW = images.createImage(`
    . . . . #
    . . . # .
    # . # . .
    # # . . .
    # # # . .`)
const ARROW_W = images.createImage(`
    . . # . .
    . # . . .
    # # # # #
    . # . . .
    . . # . .`)
const ARROW_NW = images.createImage(`
    # # # . .
    # # . . .
    # . # . .
    . . . # .
    . . . . #`)

// Deliberately NOT one of the arrow shapes above, so "centred" always reads
// as visually distinct at a glance.
const CENTERED = images.createImage(`
    . . . . .
    . # # # .
    . # # # .
    . # # # .
    . . . . .`)

// Deliberately NOT an arrow or the centred square — reads as "nothing to point at".
const NO_ATHLETE = images.createImage(`
    # . . . #
    . # . # .
    . . # . .
    . # . # .
    # . . . #`)

let lastPacketTime = input.runningTime()
let rxBuffer = Buffer.create(0)

/**
 * Arrow points from the athlete's position TOWARD frame centre — the
 * opposite of computeGimbalCorrection.ts's chase-direction convention.
 * See the file doc comment's state-3 explanation for why.
 */
function arrowFor(rollDelta: number, pitchDelta: number): Image {
    let pointRight = rollDelta < 0
    let pointLeft = rollDelta > 0
    let pointUp = pitchDelta < 0
    let pointDown = pitchDelta > 0

    if (pointUp && pointRight) return ARROW_NE
    if (pointUp && pointLeft) return ARROW_NW
    if (pointDown && pointRight) return ARROW_SE
    if (pointDown && pointLeft) return ARROW_SW
    if (pointUp) return ARROW_N
    if (pointDown) return ARROW_S
    if (pointRight) return ARROW_E
    if (pointLeft) return ARROW_W
    return CENTERED // unreachable in practice (0,0 is handled before this is called)
}

bluetooth.onBluetoothConnected(function () {
    NO_ATHLETE.plotImage(0)
})

bluetooth.onBluetoothDisconnected(function () {
    NO_ATHLETE.plotImage(0)
})

NO_ATHLETE.plotImage(0)

basic.forever(function () {
    let chunk = bluetooth.uartReadBuffer()
    if (chunk.length > 0) {
        rxBuffer = Buffer.concat([rxBuffer, chunk])
    }

    while (rxBuffer.length >= PACKET_LENGTH) {
        let rollDelta = rxBuffer.getNumber(NumberFormat.Int16BE, 0) / 10
        let pitchDelta = rxBuffer.getNumber(NumberFormat.Int16BE, 2) / 10
        rxBuffer = rxBuffer.slice(PACKET_LENGTH)
        lastPacketTime = input.runningTime()

        if (rollDelta == 0 && pitchDelta == 0) {
            CENTERED.plotImage(0)
        } else {
            arrowFor(rollDelta, pitchDelta).plotImage(0)
        }
    }

    if (input.runningTime() - lastPacketTime > NO_DETECTION_TIMEOUT_MS) {
        NO_ATHLETE.plotImage(0)
    }
})
