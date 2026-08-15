"""
detect_preview.py

Runs the exact bundled model (assets/models/person-detection.tflite) against
either a laptop webcam or a static image, using a faithful Python port of the
app's own decode/tracking logic, and draws the same overlay design the React
Native app uses (box, offset %, bearing, centred color).

WHY THIS EXISTS: the real app can only be tested by building via CI (~20 min)
and sideloading through AltStore — slow enough that iterating on detection
correctness or overlay layout that way is impractical. This script runs the
identical model file on the developer's own machine, in under a second per
frame, so decode/UI bugs can be found and fixed BEFORE spending a build+
sideload round. It cannot test anything iOS/VisionCamera-specific (frame
orientation, the GPU resizer, CoreML delegate) — only the parts of the
pipeline that are pure model + math + drawing.

KEEP IN SYNC WITH (this is a deliberate, documented duplication, not a fork):
  - src/tracking/decodeDetections.ts       -> decode_detections()
  - src/tracking/selectPrimaryAthlete.ts   -> select_primary_athlete()
  - src/tracking/computeTrackingReadout.ts -> compute_tracking_readout()
  - src/screens/TrackingOverlay.tsx        -> draw_overlay()
If any of those TS files change their thresholds/constants/math, update the
matching function here too, and vice versa.

Usage:
  python detect_preview.py --capture out.png
      Grab one webcam frame, run detection, save the annotated result.

  python detect_preview.py --image path/to/photo.jpg --capture out.png
      Same, but on a static image instead of the webcam (useful for a
      reproducible test case, or when nobody is in front of the webcam).

  python detect_preview.py --live
      Open a live window with the overlay running in real time — for the
      developer to eyeball themselves. Press 'q' to quit.

  python detect_preview.py --live --send-ble
      Same, but ALSO connects to the robot's micro:bit over BLE and sends
      real gimbal-correction packets computed from what the webcam sees —
      a full CV -> correction -> BLE -> firmware sandbox on the laptop, no
      phone/AltStore round trip needed. Point the webcam at yourself and
      watch the micro:bit's LED matrix (gimbal-led-simulator firmware)
      react in real time. Added 2026-08-15 specifically so BLE/pipeline
      issues can be narrowed down without a slow phone reinstall each time.

  python detect_preview.py --session near --duration 15 --output-dir sessions
      Run for 15 seconds, saving one annotated snapshot per second plus a
      per-frame CSV log (confidence, offset, bearing, centred) under
      sessions/near/. No live window — for unattended/scripted test runs
      where the log matters more than watching it happen.
"""

import argparse
import asyncio
import csv
import math
import queue
import struct
import sys
import threading
import time
from pathlib import Path

import cv2
import numpy as np
from ai_edge_litert.interpreter import Interpreter

REPO_ROOT = Path(__file__).resolve().parents[4]
MODEL_PATH = REPO_ROOT / "assets" / "models" / "person-detection.tflite"
MODEL_INPUT_SIZE = 300

# --- src/tracking/decodeDetections.ts port -----------------------------------

MAX_DETECTIONS = 10
PERSON_CLASS_ID = 0
DEFAULT_MIN_SCORE = 0.5


def decode_detections(boxes, classes, scores, min_score=DEFAULT_MIN_SCORE, person_class_id=PERSON_CLASS_ID, is_mirrored=False):
    """boxes: flat list/array of 4*MAX_DETECTIONS floats, [ymin,xmin,ymax,xmax] per slot."""
    result = []
    for i in range(MAX_DETECTIONS):
        class_id = classes[i]
        score = scores[i]
        if round(class_id) != person_class_id:
            continue
        if not (score >= min_score):
            continue

        ymin, xmin, ymax, xmax = boxes[i * 4 : i * 4 + 4]
        width = xmax - xmin
        height = ymax - ymin
        if not (width > 0) or not (height > 0):
            continue

        x = 1 - xmin - width if is_mirrored else xmin
        result.append({"x": float(x), "y": float(ymin), "width": float(width), "height": float(height), "confidence": float(score)})
    return result


# --- src/tracking/selectPrimaryAthlete.ts port -------------------------------

MIN_CONFIDENCE = 0.4


def select_primary_athlete(boxes):
    best = None
    best_area = -1.0
    for box in boxes:
        if box["confidence"] < MIN_CONFIDENCE:
            continue
        area = box["width"] * box["height"]
        if area > best_area:
            best_area = area
            best = box
    return best


# --- src/tracking/computeTrackingReadout.ts port -----------------------------

FRAME_CENTRE = 0.5
CENTER_BUFFER = 0.08


def compute_tracking_readout(athlete, buffer=CENTER_BUFFER):
    box_centre_x = athlete["x"] + athlete["width"] / 2
    box_centre_y = athlete["y"] + athlete["height"] / 2

    offset_x = box_centre_x - FRAME_CENTRE
    offset_y = box_centre_y - FRAME_CENTRE
    distance = math.hypot(offset_x, offset_y)

    # atan2(x, -y): 0 = up, rotating toward +x (right) as angle increases.
    angle_degrees = math.degrees(math.atan2(offset_x, -offset_y)) % 360

    return {
        "offset_x": offset_x,
        "offset_y": offset_y,
        "distance": distance,
        "angle_degrees": angle_degrees,
        "is_centered": distance <= buffer,
    }


# --- src/tracking/computeGimbalCorrection.ts port ----------------------------
# --- src/ble/encodeGimbalPacket.ts port ---------------------------------------
# KEEP IN SYNC WITH those two files, same rule as everything else above.

GIMBAL_GAIN = 30
GIMBAL_DEADBAND = 0.05
GIMBAL_MAX_STEP = 5


def _correct_axis(offset, gain=GIMBAL_GAIN, deadband=GIMBAL_DEADBAND, max_step=GIMBAL_MAX_STEP):
    """Deadband first (tiny jitter -> exactly zero), then gain, then a step clamp — same order as computeGimbalCorrection.ts."""
    if abs(offset) < deadband:
        return 0.0
    return max(-max_step, min(max_step, offset * gain))


def compute_gimbal_correction(athlete):
    """Deltas, not absolute angles — see computeGimbalCorrection.ts's own doc comment.
    Sign convention: athlete right of centre -> positive roll_delta (pan toward them);
    athlete ABOVE centre -> positive pitch_delta (tilt up) — note screen y grows
    downward while pitch grows upward, hence the inversion below."""
    centre_x = athlete["x"] + athlete["width"] / 2
    centre_y = athlete["y"] + athlete["height"] / 2
    offset_x = centre_x - FRAME_CENTRE
    offset_y = FRAME_CENTRE - centre_y
    return {"roll_delta": _correct_axis(offset_x), "pitch_delta": _correct_axis(offset_y)}


def encode_gimbal_packet(roll_delta, pitch_delta):
    """[roll_hi, roll_lo, pitch_hi, pitch_lo] — two big-endian signed int16, tenths of a
    degree. Matches encodeGimbalPacket.ts exactly: NaN/Infinity -> 0, round, clamp to
    what an int16 can hold."""

    def to_clamped_tenths(degrees):
        if not math.isfinite(degrees):
            return 0
        tenths = round(degrees * 10)
        return max(-32768, min(32767, tenths))

    return struct.pack(">hh", to_clamped_tenths(roll_delta), to_clamped_tenths(pitch_delta))


# --- BLE sending (background thread — see src/ble/useBleConnection.ts for the ---
# --- React Native equivalent this mirrors) ------------------------------------
#
# Runs its own asyncio loop on a daemon thread so the main webcam loop (cv2's
# blocking VideoCapture.read()) never has to become async. `send()` is called
# from the main thread; it drops any stale queued packet in favour of the
# newest one, matching useGimbalControl.ts's "always send the current state,
# never a backlog" behaviour.
#
# Scan/connect logic mirrors src/ble/useBleConnection.ts exactly (broad scan,
# match by service UUID OR advertised name starting with "BBC micro:bit") —
# confirmed working from this exact match logic in a standalone diagnostic,
# 2026-08-15 (found in 0.25s, connected in 1.88s, wrote successfully). If this
# script also fails to connect, the problem is upstream of react-native-ble-plx
# entirely (the robot or the radio environment); if only the phone fails, the
# problem is specific to the RN/iOS code path.
UART_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
UART_RX_CHAR = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"  # write here — see research/hardware/microbit-ble-link.md


class BleSender:
    def __init__(self):
        self._queue: "queue.Queue[bytes]" = queue.Queue()
        self._stop = threading.Event()
        self.connected = threading.Event()
        self._thread = threading.Thread(target=self._run_loop, daemon=True)

    def start(self):
        self._thread.start()

    def send(self, roll_delta, pitch_delta):
        packet = encode_gimbal_packet(roll_delta, pitch_delta)
        try:
            while True:
                self._queue.get_nowait()
        except queue.Empty:
            pass
        self._queue.put_nowait(packet)

    def stop(self):
        self._stop.set()
        self._thread.join(timeout=5)

    def _run_loop(self):
        asyncio.run(self._main())

    async def _main(self):
        from bleak import BleakClient, BleakScanner

        def matches(device, adv):
            uuids = [u.lower() for u in (adv.service_uuids or [])]
            has_service = UART_SERVICE.lower() in uuids
            name = device.name or adv.local_name or ""
            has_name = name.startswith("BBC micro:bit")
            return has_service or has_name

        print("[ble] scanning for the robot's micro:bit (15s)...")
        device = await BleakScanner.find_device_by_filter(matches, timeout=15.0)
        if device is None:
            print("[ble] NOT FOUND — is it powered and showing 'B'? BLE sending disabled for this run.")
            return

        print(f"[ble] found {device.name} [{device.address}], connecting...")
        try:
            async with BleakClient(device) as client:
                print("[ble] connected — sending live gimbal corrections")
                self.connected.set()
                while not self._stop.is_set():
                    try:
                        packet = self._queue.get(timeout=0.1)
                    except queue.Empty:
                        continue
                    try:
                        await client.write_gatt_char(UART_RX_CHAR, packet, response=False)
                    except Exception as exc:  # noqa: BLE001 — report and keep the loop alive
                        print(f"[ble] write failed: {exc}")
        except Exception as exc:  # noqa: BLE001 — report and exit the BLE thread cleanly
            print(f"[ble] connection failed: {exc}")
        finally:
            self.connected.clear()
            print("[ble] disconnected")


COMPASS_LABELS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]


def compass_label(angle_degrees):
    return COMPASS_LABELS[round(angle_degrees / 45) % 8]


# --- src/screens/TrackingOverlay.tsx port ------------------------------------

COLOR_TRACKING_BGR = (0, 204, 255)  # colors.tracking '#ffcc00', BGR for cv2
COLOR_LOCKED_BGR = (89, 199, 52)  # colors.locked '#34c759', BGR for cv2
COLOR_TEXT_BGR = (255, 255, 255)


def draw_dashed_line(frame_bgr, pt1, pt2, color, dash_len=10, gap_len=8, thickness=2):
    """cv2 has no built-in dashed line — step along the segment in dash+gap
    increments, drawing a short solid segment for each dash."""
    x1, y1 = pt1
    x2, y2 = pt2
    total_len = math.hypot(x2 - x1, y2 - y1)
    if total_len < 1:
        return
    dx = (x2 - x1) / total_len
    dy = (y2 - y1) / total_len
    step = dash_len + gap_len
    distance = 0.0
    while distance < total_len:
        seg_start = distance
        seg_end = min(distance + dash_len, total_len)
        cv2.line(
            frame_bgr,
            (int(x1 + dx * seg_start), int(y1 + dy * seg_start)),
            (int(x1 + dx * seg_end), int(y1 + dy * seg_end)),
            color,
            thickness,
        )
        distance += step


def draw_overlay(frame_bgr, athlete, readout):
    """Mutates and returns frame_bgr with the readout panel + box drawn on it.

    Draw order matters: the panel is drawn FIRST, the box (+ its confidence
    badge) LAST, so the box is always visible on top even when it happens to
    overlap the panel's screen region (a person close to the camera near the
    top-left, for example) — losing a glimpse of the numbers there is a
    smaller problem than a badge silently rendering invisible underneath a
    72%-opacity panel, which is what happened before this fix (see
    docs/VERIFICATION_REPORT.md, 2026-08-13 entry).
    """
    h, w = frame_bgr.shape[:2]
    color = COLOR_LOCKED_BGR if (readout and readout["is_centered"]) else COLOR_TRACKING_BGR

    panel_x, panel_y = 16, 16
    lines = []
    if readout is None:
        lines.append("No athlete detected")
    else:
        status_text = "CENTERED" if readout["is_centered"] else "TRACKING"
        lines.append(status_text)
        lines.append(f"offset: {round(readout['distance'] * 100)}%")
        lines.append(f"bearing: {round(readout['angle_degrees'])} deg {compass_label(readout['angle_degrees'])}")
        v_arrow = "up" if readout["offset_y"] < 0 else "down"
        h_arrow = "left" if readout["offset_x"] < 0 else "right"
        lines.append(
            f"{v_arrow} {round(abs(readout['offset_y']) * 100)}%   "
            f"{h_arrow} {round(abs(readout['offset_x']) * 100)}%"
        )

    panel_h = 30 * len(lines) + 20
    panel_w = 260
    overlay = frame_bgr.copy()
    cv2.rectangle(overlay, (panel_x, panel_y), (panel_x + panel_w, panel_y + panel_h), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.72, frame_bgr, 0.28, 0, frame_bgr)
    for i, line in enumerate(lines):
        text_color = color if i == 0 else COLOR_TEXT_BGR
        cv2.putText(
            frame_bgr,
            line,
            (panel_x + 12, panel_y + 32 + i * 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            text_color,
            2,
        )

    if athlete is not None:
        x1 = int(athlete["x"] * w)
        y1 = int(athlete["y"] * h)
        x2 = int((athlete["x"] + athlete["width"]) * w)
        y2 = int((athlete["y"] + athlete["height"]) * h)

        box_center = ((x1 + x2) / 2, (y1 + y2) / 2)
        screen_center = (w / 2, h / 2)
        draw_dashed_line(frame_bgr, box_center, screen_center, color)

        cv2.rectangle(frame_bgr, (x1, y1), (x2, y2), color, 2)

        # Badge INSIDE the box's top-left corner, clamped to stay on-canvas —
        # a box near/above the frame edge (a close, tall subject) must not
        # push the label off-screen or into negative coordinates.
        label = f"{round(athlete['confidence'] * 100)}%"
        badge_x = max(0, min(x1, w - 60))
        badge_y = max(18, min(y1 + 20, h - 6))
        cv2.putText(frame_bgr, label, (badge_x + 6, badge_y), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

    return frame_bgr


PHASE_LABEL_RED_BGR = (0, 0, 230)


def draw_phase_label(frame_bgr, label):
    """Draw a big, unmissable red banner across the bottom of the frame
    naming the current test phase (e.g. 'TEST 2: DISTANCE - MID'), separate
    from the tracking panel (top) so the two never collide."""
    if not label:
        return frame_bgr
    h, w = frame_bgr.shape[:2]
    band_h = 54
    cv2.rectangle(frame_bgr, (0, h - band_h), (w, h), (0, 0, 0), -1)
    font_scale, thickness = 0.9, 3
    text_w = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)[0][0]
    text_x = max(10, (w - text_w) // 2)
    cv2.putText(
        frame_bgr,
        label,
        (text_x, h - 16),
        cv2.FONT_HERSHEY_SIMPLEX,
        font_scale,
        PHASE_LABEL_RED_BGR,
        thickness,
    )
    return frame_bgr


# --- pipeline -----------------------------------------------------------------


def run_detection(interpreter, frame_bgr, is_mirrored=False):
    """Run detection on `frame_bgr`. If `is_mirrored`, the model is fed a
    horizontally-flipped copy of the frame (simulating a front/selfie camera's
    raw buffer) and the resulting boxes are un-mirrored back — callers should
    always draw the result on the ORIGINAL `frame_bgr`, never a flipped copy,
    same as the real app never shows the raw mirrored buffer to the user."""
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()

    model_input = cv2.flip(frame_bgr, 1) if is_mirrored else frame_bgr
    resized = cv2.resize(model_input, (MODEL_INPUT_SIZE, MODEL_INPUT_SIZE))  # 'stretch', matches scaleMode='stretch' in useAthleteDetection.ts
    rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    input_tensor = np.expand_dims(rgb, axis=0).astype(np.uint8)

    interpreter.set_tensor(input_details[0]["index"], input_tensor)
    interpreter.invoke()

    boxes = interpreter.get_tensor(output_details[0]["index"])[0].flatten()
    classes = interpreter.get_tensor(output_details[1]["index"])[0]
    scores = interpreter.get_tensor(output_details[2]["index"])[0]

    detections = decode_detections(boxes, classes, scores, is_mirrored=is_mirrored)
    athlete = select_primary_athlete(detections)
    readout = compute_tracking_readout(athlete) if athlete is not None else None
    return detections, athlete, readout


def run_session(interpreter, cap, name, duration, output_dir, snapshot_interval, label=None, show=False, mirrored=False):
    """Run for `duration` seconds, logging every frame to CSV and saving a
    snapshot every `snapshot_interval` seconds. If `show`, also opens a live
    window on the actual screen for the whole run (auto-closes at the end).
    Returns a summary dict."""
    session_dir = Path(output_dir) / name
    frames_dir = session_dir / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)
    csv_path = session_dir / "log.csv"

    rows = []
    last_snapshot_at = -999.0
    snapshot_count = 0
    start = time.monotonic()
    window_name = f"webcam-detection-preview: {name}"

    with open(csv_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            ["elapsed_s", "num_detections", "confidence", "offset_pct", "angle_degrees", "is_centered"]
        )
        while True:
            elapsed = time.monotonic() - start
            if elapsed >= duration:
                break
            ok, frame = cap.read()
            if not ok:
                continue

            detections, athlete, readout = run_detection(interpreter, frame, is_mirrored=mirrored)
            row = [
                round(elapsed, 2),
                len(detections),
                round(athlete["confidence"], 3) if athlete else "",
                round(readout["distance"] * 100, 1) if readout else "",
                round(readout["angle_degrees"], 1) if readout else "",
                readout["is_centered"] if readout else "",
            ]
            writer.writerow(row)
            rows.append(row)

            need_snapshot = elapsed - last_snapshot_at >= snapshot_interval
            if need_snapshot or show:
                annotated = draw_overlay(frame.copy(), athlete, readout)
                draw_phase_label(annotated, label)
                if need_snapshot:
                    last_snapshot_at = elapsed
                    snapshot_count += 1
                    cv2.imwrite(str(frames_dir / f"frame_{snapshot_count:03d}_t{elapsed:.1f}s.jpg"), annotated)
                if show:
                    cv2.imshow(window_name, annotated)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break

    if show:
        cv2.destroyWindow(window_name)

    with_athlete = [r for r in rows if r[2] != ""]
    summary = {
        "name": name,
        "total_frames": len(rows),
        "frames_with_athlete": len(with_athlete),
        "detection_rate": len(with_athlete) / len(rows) if rows else 0.0,
        "mean_confidence": (sum(r[2] for r in with_athlete) / len(with_athlete)) if with_athlete else None,
        "centered_fraction": (sum(1 for r in with_athlete if r[5]) / len(with_athlete)) if with_athlete else None,
        "snapshot_count": snapshot_count,
        "csv_path": str(csv_path),
        "frames_dir": str(frames_dir),
    }
    return summary


def load_interpreter():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model not found at {MODEL_PATH}")
    interpreter = Interpreter(model_path=str(MODEL_PATH))
    interpreter.allocate_tensors()
    return interpreter


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--image", type=str, default=None, help="Path to a static image instead of the webcam.")
    parser.add_argument("--capture", type=str, default=None, help="Save one annotated frame to this path and exit.")
    parser.add_argument("--live", action="store_true", help="Open a live window (press 'q' to quit).")
    parser.add_argument("--camera-index", type=int, default=0, help="Webcam device index, default 0.")
    parser.add_argument("--session", type=str, default=None, help="Run a named, timed logging session (see module docstring).")
    parser.add_argument("--duration", type=float, default=15.0, help="Session duration in seconds.")
    parser.add_argument("--output-dir", type=str, default=".", help="Base directory for --session output.")
    parser.add_argument("--snapshot-interval", type=float, default=1.0, help="Seconds between saved snapshots in --session mode.")
    parser.add_argument("--label", type=str, default=None, help="Big red banner text drawn on every frame in --session mode (e.g. a test phase name).")
    parser.add_argument("--show", action="store_true", help="In --session mode, also open a live window on-screen for the run.")
    parser.add_argument(
        "--mirror",
        action="store_true",
        help="Simulate a front/selfie camera: flips the frame before feeding the model, "
        "then un-mirrors the resulting box so it's drawn correctly on the original, "
        "unflipped frame — exercises the same isMirrored path as useAthleteDetection.ts "
        "without needing the phone's actual front camera.",
    )
    parser.add_argument(
        "--send-ble",
        action="store_true",
        help="Only with --live. Connect to the robot's micro:bit over BLE and send real "
        "gimbal-correction packets computed from what the webcam sees, at ~15Hz — a full "
        "laptop-only sandbox for the CV -> correction -> BLE -> firmware pipeline. "
        "Requires `pip install bleak` (see .claude/skills/ble-ping/).",
    )
    args = parser.parse_args()

    interpreter = load_interpreter()

    if args.image is not None:
        frame = cv2.imread(args.image)
        if frame is None:
            print(f"ERROR: could not read image at {args.image}", file=sys.stderr)
            return 1
        detections, athlete, readout = run_detection(interpreter, frame, is_mirrored=args.mirror)
        annotated = draw_overlay(frame, athlete, readout)
        out_path = args.capture or "detection_preview.png"
        cv2.imwrite(out_path, annotated)
        print(f"detections={len(detections)} athlete={'yes' if athlete else 'no'} -> saved {out_path}")
        return 0

    cap = cv2.VideoCapture(args.camera_index)
    if not cap.isOpened():
        print("ERROR: could not open webcam", file=sys.stderr)
        return 1

    try:
        if args.session is not None:
            summary = run_session(
                interpreter,
                cap,
                args.session,
                args.duration,
                args.output_dir,
                args.snapshot_interval,
                label=args.label,
                show=args.show,
                mirrored=args.mirror,
            )
            print(
                f"session={summary['name']} frames={summary['total_frames']} "
                f"with_athlete={summary['frames_with_athlete']} "
                f"detection_rate={summary['detection_rate']:.0%} "
                f"mean_confidence={summary['mean_confidence']} "
                f"centered_fraction={summary['centered_fraction']} "
                f"snapshots={summary['snapshot_count']} -> {summary['frames_dir']}"
            )
            return 0

        if args.live:
            ble_sender = None
            last_sent_at = 0.0
            SEND_INTERVAL_S = 1.0 / 15.0  # matches useGimbalControl.ts's ~15Hz

            if args.send_ble:
                ble_sender = BleSender()
                ble_sender.start()

            print("Live preview running. Press 'q' in the window to quit.")
            try:
                while True:
                    ok, frame = cap.read()
                    if not ok:
                        break
                    _, athlete, readout = run_detection(interpreter, frame, is_mirrored=args.mirror)
                    annotated = draw_overlay(frame, athlete, readout)

                    if ble_sender is not None:
                        ble_connected = ble_sender.connected.is_set()
                        ble_label = "BLE: CONNECTED" if ble_connected else "BLE: CONNECTING..."
                        cv2.putText(
                            annotated, ble_label, (16, annotated.shape[0] - 16),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6,
                            (89, 199, 52) if ble_connected else (0, 204, 255), 2,
                        )
                        # Same rule as useGimbalControl.ts: only send when there's a
                        # locked athlete, rate-limited — no athlete means no packet
                        # at all, letting the firmware's own watchdog show its
                        # "no athlete" state rather than this script deciding that.
                        now = time.monotonic()
                        if athlete is not None and ble_connected and now - last_sent_at >= SEND_INTERVAL_S:
                            correction = compute_gimbal_correction(athlete)
                            ble_sender.send(correction["roll_delta"], correction["pitch_delta"])
                            last_sent_at = now

                    cv2.imshow("webcam-detection-preview", annotated)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break
            finally:
                cv2.destroyAllWindows()
                if ble_sender is not None:
                    ble_sender.stop()
            return 0

        # Single-shot capture. Read a few frames first — the first frame or two
        # off a freshly opened webcam is often stale/black on Windows.
        frame = None
        for _ in range(5):
            ok, frame = cap.read()
            if not ok:
                print("ERROR: could not read from webcam", file=sys.stderr)
                return 1
        detections, athlete, readout = run_detection(interpreter, frame, is_mirrored=args.mirror)
        annotated = draw_overlay(frame, athlete, readout)
        out_path = args.capture or "detection_preview.png"
        cv2.imwrite(out_path, annotated)
        print(f"detections={len(detections)} athlete={'yes' if athlete else 'no'} -> saved {out_path}")
        return 0
    finally:
        cap.release()


if __name__ == "__main__":
    raise SystemExit(main())
