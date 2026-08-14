"""
Gimbal control firmware — the production program the micro:bit runs while
filming. NOT a test script like `ble-ping`'s echo or `servo-bounds-test`'s
sweep — this is what actually drives the robot.

Receives the 4-byte gimbal packet over BLE (Nordic UART service, same stack
proven by `ble-ping`'s echo responder) and drives the roll/pitch servos on
the PCA9685 accordingly.

WIRE FORMAT — must match `src/ble/encodeGimbalPacket.ts` EXACTLY:
    [roll_hi, roll_lo, pitch_hi, pitch_lo]
    Two big-endian SIGNED 16-bit integers (two's complement), each a DELTA
    in tenths of a degree. NOT absolute angles — this micro:bit adds each
    delta to its own running position and clamps to the safe range below.
    See research/hardware/microbit-ble-link.md's 2026-08-14 correction note
    for why (an earlier draft wrongly proposed unsigned absolute angles).

⚠️ SAFE RANGE BELOW IS A PLACEHOLDER, NOT A MEASUREMENT ⚠️
ROLL_SAFE_MIN/MAX and PITCH_SAFE_MIN/MAX are a conservative ±30° guess
around centre — NOT the output of `servo-bounds-test`. Run that skill FIRST
and replace these four constants with its real measured values before
trusting this script to drive the actual mounted gimbal unattended. Per
`CLAUDE.md` §5.2, no agent may mark this as hardware-verified — a human must
run `servo-bounds-test`, report the real numbers, and update this file.

PREREQUISITES (do not skip):
    1. `.claude/skills/ble-ping/`      — BLE link proven alive.
    2. `.claude/skills/servo-bounds-test/` — real safe range measured,
       ROLL_SAFE_MIN/MAX and PITCH_SAFE_MIN/MAX below updated to match.
Running this firmware before both of those pass means driving servos with
an unmeasured "safe" range on a live BLE link that was never proven stable
— exactly the two things those skills exist to de-risk first.

DISCONNECT BEHAVIOUR: on BLE disconnect, servos simply HOLD their last
commanded position (no auto-recentre). This is a deliberate MVP choice, not
an oversight — auto-recentre-on-timeout is a reasonable future safety
addition but is not something the user has asked for, and adding it now
would be building an untested behaviour on top of an already-untested
firmware. Revisit only if a real field test shows holding position is unsafe.
"""

from microbit import display, sleep, i2c

try:
    import bluetooth
except ImportError:  # pragma: no cover - depends on the flashed runtime
    bluetooth = None


# --- Identity, must match what ble-ping's phone test already connected to ---
DEVICE_NAME = "athlete-robot"

# --- PCA9685 registers, direct writes (sidesteps the centiseconds-vs-
# milliseconds unit trap that MicroPython/MakeCode PCA9685 *extensions*
# have — see research/hardware/pca9685-servo-control.md) ---
PCA9685_ADDR = 0x40
MODE1 = 0x00
PRESCALE = 0xFE
LED0_ON_L = 0x06

CHANNEL_ROLL = 0
CHANNEL_PITCH = 1

CENTRE_DEG = 90

# ⚠️ PLACEHOLDER — replace with servo-bounds-test's measured values.
ROLL_SAFE_MIN = 60
ROLL_SAFE_MAX = 120
PITCH_SAFE_MIN = 60
PITCH_SAFE_MAX = 120

PACKET_LENGTH = 4


def _write8(reg, value):
    i2c.write(PCA9685_ADDR, bytes([reg, value]))


def _read8(reg):
    i2c.write(PCA9685_ADDR, bytes([reg]), repeat=True)
    return i2c.read(PCA9685_ADDR, 1)[0]


def pca_init(freq_hz=50):
    """Initialise the PCA9685 at 50 Hz — see servo-bounds-test's script for why 50Hz matters."""
    _write8(MODE1, 0x00)
    sleep(10)

    prescale = int(round(25000000.0 / (4096 * freq_hz)) - 1)

    old_mode = _read8(MODE1)
    _write8(MODE1, (old_mode & 0x7F) | 0x10)
    _write8(PRESCALE, prescale)
    _write8(MODE1, old_mode)
    sleep(10)
    _write8(MODE1, old_mode | 0xA0)


def set_angle(channel, degrees):
    """Command one servo to an absolute angle, clamped to the servo's full 0-180 travel."""
    degrees = max(0, min(180, degrees))
    pulse_ms = 1.0 + (degrees / 180.0)
    count = int(pulse_ms * 4096 / 20.0)

    base = LED0_ON_L + 4 * channel
    i2c.write(PCA9685_ADDR, bytes([
        base,
        0x00, 0x00,
        count & 0xFF, (count >> 8) & 0xFF,
    ]))


def _decode_int16_be(hi, lo):
    """Two bytes, big-endian, two's complement -> signed Python int."""
    value = (hi << 8) | lo
    if value >= 0x8000:
        value -= 0x10000
    return value


def _clamp(value, lo, hi):
    return max(lo, min(hi, value))


def main():
    if bluetooth is None:
        display.show("!")
        while True:
            sleep(1000)

    pca_init(50)

    roll_deg = CENTRE_DEG
    pitch_deg = CENTRE_DEG
    set_angle(CHANNEL_ROLL, roll_deg)
    set_angle(CHANNEL_PITCH, pitch_deg)

    uart = bluetooth.UART(name=DEVICE_NAME, pairing=False)
    buffer = bytearray()
    display.show("B")

    while True:
        if not uart.is_connected():
            display.show("B")
            sleep(100)
            continue

        display.show("C")
        chunk = uart.read()
        if not chunk:
            sleep(10)
            continue

        buffer.extend(chunk)

        # A BLE notification/write can arrive split or coalesced across
        # multiple reads — buffer and only ever consume whole 4-byte packets.
        while len(buffer) >= PACKET_LENGTH:
            packet = buffer[:PACKET_LENGTH]
            del buffer[:PACKET_LENGTH]

            roll_delta = _decode_int16_be(packet[0], packet[1]) / 10.0
            pitch_delta = _decode_int16_be(packet[2], packet[3]) / 10.0

            roll_deg = _clamp(roll_deg + roll_delta, ROLL_SAFE_MIN, ROLL_SAFE_MAX)
            pitch_deg = _clamp(pitch_deg + pitch_delta, PITCH_SAFE_MIN, PITCH_SAFE_MAX)

            set_angle(CHANNEL_ROLL, roll_deg)
            set_angle(CHANNEL_PITCH, pitch_deg)
            display.show(".")


main()
