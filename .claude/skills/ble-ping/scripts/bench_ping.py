"""
Bench-side BLE ping: Windows laptop -> micro:bit.

Proves the link works with the phone, the app, and the CI pipeline all removed
from the picture. If this fails, nothing downstream can work, and you have
saved yourself a ~20 minute build round finding that out.

Usage:
    pip install bleak
    python bench_ping.py [--name athlete-robot] [--count 20]

Exits non-zero if the device is not found or no echo comes back, so it can be
used as a gate in a larger script.
"""

import argparse
import asyncio
import statistics
import sys
import time

try:
    from bleak import BleakClient, BleakScanner
except ImportError:
    sys.exit("bleak is not installed. Run: pip install bleak")


# Nordic UART Service — what micro:bit's BLE UART exposes.
#
# CONFIRMED AGAINST THE REAL DEVICE, 2026-08-15 (GATT dump via bleak against a
# MakeCode-flashed micro:bit): MakeCode's implementation puts WRITE on
# 6e400003 and INDICATE on 6e400002 — the REVERSE of the "standard" Nordic
# UART convention (RX=6e400002 write / TX=6e400003 notify) this file and
# src/ble/useBleConnection.ts originally assumed. Real properties observed:
#   6e400002: ['indicate']                     <- subscribe here (their TX)
#   6e400003: ['write', 'write-without-response'] <- write here (their RX)
# Whether this is MakeCode-specific or a genuine micro:bit-firmware-wide
# convention is unconfirmed — re-verify with a fresh GATT dump
# (see the snippet in this file's history / SKILL.md) if the firmware
# implementation ever changes.
UART_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
UART_RX_CHAR = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"  # we WRITE here
UART_TX_CHAR = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"  # we SUBSCRIBE here

SCAN_TIMEOUT_S = 15.0
REPLY_TIMEOUT_S = 3.0


async def find_device(name):
    """
    Scans by the Nordic UART SERVICE UUID, falling back to matching on the
    advertised name — this matches src/ble/useBleConnection.ts, which does
    the same double check (see that file's "DEVICE SELECTION" doc comment
    for why UUID alone isn't trusted). `name` is unused for matching:
    MakeCode's bluetooth.startUartService() does NOT let you set a custom
    advertised name from user code, so it's always "BBC micro:bit [xxxxx]"
    — the hardcoded prefix check below is what actually matches, not the
    `--name` argument. That argument is kept only in case a future firmware
    can set a custom name.
    """
    print("Scanning for the Nordic UART service ({:.0f}s)...".format(SCAN_TIMEOUT_S))

    def _matches(device, adv_data):
        uuids = [u.lower() for u in (adv_data.service_uuids or [])]
        if UART_SERVICE.lower() in uuids:
            return True
        # Fallback: the service UUID sometimes only appears in a separate
        # scan-response packet that isn't merged into every AdvertisementData
        # bleak hands to this filter (observed directly on Windows/winrt,
        # 2026-08-15) — the device's advertised name is a reliable second
        # signal. MakeCode's default micro:bit BLE name is "BBC micro:bit
        # [xxxxx]"; this covers that without needing an exact match.
        name = device.name or adv_data.local_name or ""
        return name.startswith("BBC micro:bit")

    device = await BleakScanner.find_device_by_filter(_matches, timeout=SCAN_TIMEOUT_S)
    if device is None:
        print("\nNOT FOUND.")
        print("  - Is the micro:bit powered and showing 'B' on its display?")
        print("  - Is it still connected to MakeCode/Mu over USB serial? Unplug it.")
        print("  - Does the flashed runtime actually include BLE? (v1 boards often can't;")
        print("    plain MicroPython's 'import bluetooth' has NO working UART class at all")
        print("    even on v2 — see research/hardware/microbit-ble-link.md. This must be")
        print("    the MakeCode-built firmware, not the old MicroPython echo script.)")
        return None
    print("Found: {} [{}]".format(device.name, device.address))
    return device


async def ping_once(client, replies, index):
    """Send one PING, wait for the echo, return round-trip ms (or None)."""
    payload = "PING{}".format(index)
    replies.clear()
    started = time.perf_counter()

    # Trailing newline is cosmetic, not required: the firmware
    # (.claude/skills/ble-ping/scripts/main.ts) polls the raw UART buffer
    # directly rather than triggering on a delimiter, so it echoes back
    # exactly whatever bytes it receives — the newline just makes captured
    # traffic easier to eyeball if you ever sniff it. on_notify() strips
    # whitespace off the reply before the comparison below either way.
    await client.write_gatt_char(UART_RX_CHAR, (payload + "\n").encode(), response=False)

    waited = 0.0
    while waited < REPLY_TIMEOUT_S:
        if replies:
            elapsed_ms = (time.perf_counter() - started) * 1000.0
            got = replies[0]
            if payload not in got:
                print("  #{:<3} MISMATCH: sent {!r}, got {!r}".format(index, payload, got))
            return elapsed_ms
        await asyncio.sleep(0.005)
        waited += 0.005

    print("  #{:<3} TIMEOUT (no echo in {:.0f}s)".format(index, REPLY_TIMEOUT_S))
    return None


async def run(name, count):
    device = await find_device(name)
    if device is None:
        return 1

    replies = []

    def on_notify(_sender, data):
        try:
            replies.append(data.decode("utf-8").strip())
        except UnicodeError:
            replies.append("<{} raw bytes>".format(len(data)))

    print("Connecting...")
    async with BleakClient(device) as client:
        await client.start_notify(UART_TX_CHAR, on_notify)
        print("Connected. Sending {} pings.\n".format(count))

        latencies = []
        for i in range(1, count + 1):
            ms = await ping_once(client, replies, i)
            if ms is not None:
                latencies.append(ms)
                print("  #{:<3} {:.1f} ms".format(i, ms))
            await asyncio.sleep(0.1)

        await client.stop_notify(UART_TX_CHAR)

    print("\n--- Summary ---")
    print("Sent:     {}".format(count))
    print("Echoed:   {}".format(len(latencies)))
    print("Lost:     {}".format(count - len(latencies)))

    if not latencies:
        print("\nRESULT: FAILED — connected, but nothing echoed back.")
        print("The link is up; the micro:bit program is the problem. That is a useful")
        print("half-result: report it as such.")
        return 1

    print("Latency:  min {:.1f} / median {:.1f} / max {:.1f} ms".format(
        min(latencies), statistics.median(latencies), max(latencies)))

    if max(latencies) > 200:
        print("\nNOTE: max latency above 200 ms. Record this — it constrains how fast")
        print("the tracking loop can usefully send gimbal commands.")

    print("\nRESULT: PASS")
    print("Copy these numbers into testing/REAL_HARDWARE_TEST_LOG.md.")
    return 0


def main():
    parser = argparse.ArgumentParser(description="BLE ping a micro:bit from Windows.")
    parser.add_argument(
        "--name",
        default="athlete-robot",
        help="unused for matching (MakeCode always advertises as 'BBC micro:bit [xxxxx]'); "
        "kept for forward-compat with a future custom-named firmware",
    )
    parser.add_argument("--count", type=int, default=20, help="number of pings")
    args = parser.parse_args()

    try:
        sys.exit(asyncio.run(run(args.name, args.count)))
    except KeyboardInterrupt:
        sys.exit(130)


if __name__ == "__main__":
    main()
