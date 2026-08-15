/**
 * micro:bit BLE echo responder — the robot half of the `ble-ping` skill.
 *
 * REWRITTEN 2026-08-15 FROM MICROPYTHON TO MAKECODE. `import bluetooth` in
 * standard MicroPython for micro:bit has NO working UART class — confirmed
 * against the official micro:bit MicroPython docs (only BLE firmware-update
 * features are implemented, nothing usable from user code). This MakeCode
 * version is the one that actually passed a real 20/20-ping test — see
 * `research/hardware/microbit-ble-link.md`'s 2026-08-15 entry.
 *
 * Echoes back whatever raw bytes it receives, byte-for-byte, no prefix, no
 * text assumptions. Uses `bluetooth.uartReadBuffer()` polled directly rather
 * than MakeCode's usual delimiter-triggered `onUartDataReceived` pattern —
 * confirmed this handles arbitrary binary payloads correctly (including a
 * payload of all-0x0A bytes, which would break delimiter-based framing
 * entirely), matching what the production `gimbal-control-firmware` skill
 * needs for its binary packet. `bench_ping.py` sends text (`PING1\n` etc)
 * for readability, but this firmware doesn't care — it echoes anything.
 *
 * Display key:
 *     B  = advertising, waiting for a connection
 *     C  = connected
 *     (diamond icon)  = a chunk was echoed
 *
 * NO PAIRING REQUIRED: see `pxt.json`'s `yotta.config.microbit-dal.bluetooth`
 * block (`open: 1, pairing_mode: 0, whitelist: 0`). Without this, the
 * micro:bit compiles and runs fine but never advertises for an open scan —
 * confirmed the hard way. Do not remove it "to clean up the config."
 *
 * BUILD: from this folder, `npx pxt target microbit && npx pxt install &&
 * npx pxt build`, then copy `built/binary.hex` onto the MICROBIT drive.
 */

bluetooth.startUartService()

bluetooth.onBluetoothConnected(function () {
    basic.showString("C")
})

bluetooth.onBluetoothDisconnected(function () {
    basic.showString("B")
})

basic.showString("B")

basic.forever(function () {
    let data = bluetooth.uartReadBuffer()
    if (data.length > 0) {
        bluetooth.uartWriteBuffer(data)
        basic.showIcon(IconNames.SmallDiamond)
    }
})
