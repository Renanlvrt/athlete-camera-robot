"""
Gimbal servo sweep — the robot half of the `servo-bounds-test` skill.

Steps a servo outward from centre in SMALL increments, on a button press, so a
human can stop the instant the 3D-printed mechanism starts to bind. This is
deliberately manual: an automatic full-range sweep would drive the servo into a
hard stop before anyone could react, stall it, and cook the gears.

Controls:
    A    step outward (alternating +/- from centre, widening)
    B    return to centre NOW (panic button)
    A+B  switch axis (roll <-> pitch)

Display shows the current angle in degrees.

READ SKILL.md FIRST — especially the safety section. Robot on a stand, phone
removed from the gimbal, battery disconnect within reach.

UNITS
-----
This script talks to the PCA9685 registers DIRECTLY and computes 12-bit pulse
counts itself (see set_angle). It therefore sidesteps the centiseconds-vs-
milliseconds footgun described in research/hardware/pca9685-servo-control.md
entirely — that trap belongs to the MakeCode/MicroPython *extensions* that wrap
the chip, not to raw register writes.

Mentioned here because it cuts both ways: if you later swap this for an
extension-based implementation, the units question comes back and 0/90/180 deg
will likely need to be 100/150/200, not 1.0/1.5/2.0.
"""

from microbit import display, button_a, button_b, sleep, i2c


# --- PCA9685 registers -----------------------------------------------------
PCA9685_ADDR = 0x40
MODE1 = 0x00
PRESCALE = 0xFE
LED0_ON_L = 0x06

# Channel assignment. All three servos on the PCA9685 — one code path, one
# timing model, one power rail (see research/hardware/pca9685-servo-control.md).
CHANNEL_ROLL = 0
CHANNEL_PITCH = 1

CENTRE_DEG = 90
STEP_DEG = 5          # small on purpose — you must be able to stop in time
MAX_DEG = 180
MIN_DEG = 0


def _write8(reg, value):
    i2c.write(PCA9685_ADDR, bytes([reg, value]))


def _read8(reg):
    i2c.write(PCA9685_ADDR, bytes([reg]), repeat=True)
    return i2c.read(PCA9685_ADDR, 1)[0]


def pca_init(freq_hz=50):
    """Initialise the PCA9685 at 50 Hz.

    The chip powers on near 200 Hz, which makes analog hobby servos buzz,
    jitter, or sit unresponsive. Forgetting this one-liner is a very common
    "the servos are broken" false alarm.
    """
    _write8(MODE1, 0x00)
    sleep(10)

    # prescale = round(25MHz / (4096 * freq)) - 1
    prescale = int(round(25000000.0 / (4096 * freq_hz)) - 1)

    old_mode = _read8(MODE1)
    _write8(MODE1, (old_mode & 0x7F) | 0x10)   # sleep, required to set prescale
    _write8(PRESCALE, prescale)
    _write8(MODE1, old_mode)
    sleep(10)
    _write8(MODE1, old_mode | 0xA0)            # restart + auto-increment


def set_angle(channel, degrees):
    """Command one servo to an absolute angle."""
    degrees = max(MIN_DEG, min(MAX_DEG, degrees))

    # Map 0-180 deg onto the conventional 1.0-2.0 ms pulse, expressed as a
    # 12-bit count at 50 Hz (period = 20 ms, so 4096 counts = 20 ms).
    pulse_ms = 1.0 + (degrees / 180.0)
    count = int(pulse_ms * 4096 / 20.0)

    base = LED0_ON_L + 4 * channel
    i2c.write(PCA9685_ADDR, bytes([
        base,
        0x00, 0x00,                        # ON  = 0
        count & 0xFF, (count >> 8) & 0xFF  # OFF = count
    ]))


def main():
    pca_init(50)

    channels = [("R", CHANNEL_ROLL), ("P", CHANNEL_PITCH)]
    axis = 0
    angle = CENTRE_DEG
    outward = 1  # alternates so we widen symmetrically around centre
    magnitude = 0

    set_angle(channels[axis][1], angle)
    display.scroll(channels[axis][0])

    while True:
        a, b = button_a.was_pressed(), button_b.was_pressed()

        if a and b:
            # Switch axis — always recentre the one we're leaving first.
            set_angle(channels[axis][1], CENTRE_DEG)
            axis = (axis + 1) % len(channels)
            angle = CENTRE_DEG
            magnitude = 0
            outward = 1
            set_angle(channels[axis][1], angle)
            display.scroll(channels[axis][0])

        elif b:
            # Panic / recentre.
            angle = CENTRE_DEG
            magnitude = 0
            outward = 1
            set_angle(channels[axis][1], angle)
            display.scroll("C")

        elif a:
            # Widen alternately: +5, -5, +10, -10, +15, ...
            if outward > 0:
                magnitude += STEP_DEG
            angle = CENTRE_DEG + outward * magnitude
            outward = -outward
            set_angle(channels[axis][1], angle)
            display.scroll(str(angle))

        sleep(50)


main()
