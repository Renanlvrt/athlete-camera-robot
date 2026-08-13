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

  python detect_preview.py --session near --duration 15 --output-dir sessions
      Run for 15 seconds, saving one annotated snapshot per second plus a
      per-frame CSV log (confidence, offset, bearing, centred) under
      sessions/near/. No live window — for unattended/scripted test runs
      where the log matters more than watching it happen.
"""

import argparse
import csv
import math
import sys
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


def decode_detections(boxes, classes, scores, min_score=DEFAULT_MIN_SCORE, person_class_id=PERSON_CLASS_ID):
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

        result.append({"x": float(xmin), "y": float(ymin), "width": float(width), "height": float(height), "confidence": float(score)})
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


COMPASS_LABELS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]


def compass_label(angle_degrees):
    return COMPASS_LABELS[round(angle_degrees / 45) % 8]


# --- src/screens/TrackingOverlay.tsx port ------------------------------------

COLOR_TRACKING_BGR = (0, 204, 255)  # colors.tracking '#ffcc00', BGR for cv2
COLOR_LOCKED_BGR = (89, 199, 52)  # colors.locked '#34c759', BGR for cv2
COLOR_TEXT_BGR = (255, 255, 255)


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


def run_detection(interpreter, frame_bgr):
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()

    resized = cv2.resize(frame_bgr, (MODEL_INPUT_SIZE, MODEL_INPUT_SIZE))  # 'stretch', matches scaleMode='stretch' in useAthleteDetection.ts
    rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    input_tensor = np.expand_dims(rgb, axis=0).astype(np.uint8)

    interpreter.set_tensor(input_details[0]["index"], input_tensor)
    interpreter.invoke()

    boxes = interpreter.get_tensor(output_details[0]["index"])[0].flatten()
    classes = interpreter.get_tensor(output_details[1]["index"])[0]
    scores = interpreter.get_tensor(output_details[2]["index"])[0]

    detections = decode_detections(boxes, classes, scores)
    athlete = select_primary_athlete(detections)
    readout = compute_tracking_readout(athlete) if athlete is not None else None
    return detections, athlete, readout


def run_session(interpreter, cap, name, duration, output_dir, snapshot_interval, label=None, show=False):
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

            detections, athlete, readout = run_detection(interpreter, frame)
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
    args = parser.parse_args()

    interpreter = load_interpreter()

    if args.image is not None:
        frame = cv2.imread(args.image)
        if frame is None:
            print(f"ERROR: could not read image at {args.image}", file=sys.stderr)
            return 1
        detections, athlete, readout = run_detection(interpreter, frame)
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
            print("Live preview running. Press 'q' in the window to quit.")
            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                _, athlete, readout = run_detection(interpreter, frame)
                annotated = draw_overlay(frame, athlete, readout)
                cv2.imshow("webcam-detection-preview", annotated)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break
            cv2.destroyAllWindows()
            return 0

        # Single-shot capture. Read a few frames first — the first frame or two
        # off a freshly opened webcam is often stale/black on Windows.
        frame = None
        for _ in range(5):
            ok, frame = cap.read()
            if not ok:
                print("ERROR: could not read from webcam", file=sys.stderr)
                return 1
        detections, athlete, readout = run_detection(interpreter, frame)
        annotated = draw_overlay(frame, athlete, readout)
        out_path = args.capture or "detection_preview.png"
        cv2.imwrite(out_path, annotated)
        print(f"detections={len(detections)} athlete={'yes' if athlete else 'no'} -> saved {out_path}")
        return 0
    finally:
        cap.release()


if __name__ == "__main__":
    raise SystemExit(main())
