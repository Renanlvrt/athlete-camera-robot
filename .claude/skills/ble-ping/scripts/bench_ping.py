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
# RX is what we WRITE to; TX is what the micro:bit NOTIFIES us on.
UART_RX_CHAR = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"
UART_TX_CHAR = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"

SCAN_TIMEOUT_S = 15.0
REPLY_TIMEOUT_S = 3.0


async def find_device(name):
    print("Scanning for '{}' ({:.0f}s)...".format(name, SCAN_TIMEOUT_S))
    device = await BleakScanner.find_device_by_name(name, timeout=SCAN_TIMEOUT_S)
    if device is None:
        print("\nNOT FOUND.")
        print("  - Is the micro:bit powered and showing 'B' on its display?")
        print("  - Is it still connected to MakeCode/Mu over USB serial? Unplug it.")
        print("  - Does the flashed runtime actually include BLE? (v1 boards often can't.)")
        return None
    print("Found: {} [{}]".format(device.name, device.address))
    return device


async def ping_once(client, replies, index):
    """Send one PING, wait for the echo, return round-trip ms (or None)."""
    payload = "PING{}".format(index)
    replies.clear()
    started = time.perf_counter()

    await client.write_gatt_char(UART_RX_CHAR, payload.encode(), response=False)

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
    parser.add_argument("--name", default="athlete-robot", help="BLE advertised name")
    parser.add_argument("--count", type=int, default=20, help="number of pings")
    args = parser.parse_args()

    try:
        sys.exit(asyncio.run(run(args.name, args.count)))
    except KeyboardInterrupt:
        sys.exit(130)


if __name__ == "__main__":
    main()
