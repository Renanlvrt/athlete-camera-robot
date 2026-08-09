"""
micro:bit BLE echo responder — the robot half of the `ble-ping` skill.

Flash this onto the BBC micro:bit with the online Python Editor or Mu.
It advertises over the Nordic UART service and echoes back anything it
receives, prefixed with "ACK:".

Display key:
    B  = advertising, waiting for a connection
    C  = connected
    .  = a message was echoed
    !  = error

NOTE: pairing is disabled to keep bench testing frictionless. That is fine for
a desk test and NOT fine for anything beyond it — see SKILL.md.

NOTE: MicroPython's `bluetooth` support on micro:bit is limited compared to
MakeCode's. If this proves awkward on the actual board, the MakeCode Bluetooth
UART blocks are the documented fallback; record which one worked in
testing/REAL_HARDWARE_TEST_LOG.md so the next person doesn't retry the dead end.
"""

from microbit import display, sleep

# Deliberately NOT importing `radio`: research/hardware/microbit-ble-link.md
# records that MakeCode's Bluetooth and radio extensions conflict, and that the
# BLE stack already eats a large share of the micro:bit's limited flash. Whether
# BLE is available is answered by the `bluetooth` import below, not by `radio`.
try:
    import bluetooth
except ImportError:  # pragma: no cover - depends on the flashed runtime
    bluetooth = None


DEVICE_NAME = "athlete-robot"
ACK_PREFIX = "ACK:"


def _show(char):
    """Single-character status on the LED matrix. Cheap, glanceable debugging."""
    display.show(char)


def main():
    if bluetooth is None:
        # The flashed MicroPython build has no BLE. This is a real and common
        # outcome on micro:bit v1 — surface it loudly rather than hanging.
        _show("!")
        while True:
            sleep(1000)

    uart = bluetooth.UART(name=DEVICE_NAME, pairing=False)
    _show("B")

    while True:
        if not uart.is_connected():
            _show("B")
            sleep(100)
            continue

        _show("C")
        data = uart.read()
        if not data:
            sleep(20)
            continue

        try:
            message = data.decode("utf-8").strip()
        except UnicodeError:
            # Binary payload (the 4-byte gimbal packet, later). Echo the raw
            # length so the sender can at least confirm delivery.
            uart.write("{}<{} bytes>".format(ACK_PREFIX, len(data)))
            _show(".")
            continue

        uart.write(ACK_PREFIX + message)
        _show(".")


main()
