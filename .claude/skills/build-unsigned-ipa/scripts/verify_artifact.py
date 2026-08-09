#!/usr/bin/env python3
"""
Download the `unsigned-app-ipa` artifact from a completed CI run and sanity-check it.

Verified 2026-08-09: the checks below (valid zip, Payload/*.app present, an executable
inside it, a parseable Info.plist) are exactly what was checked by hand against runs
31288776388 and 31289641191 — see docs/VERIFICATION_REPORT.md.

Usage:
    python verify_artifact.py --run-id RUN_ID [--repo OWNER/NAME]
                               [--artifact-name NAME] [--out-dir DIR]

Exit code 0 if every check passes. Non-zero, with the specific failing check named,
otherwise.
"""

from __future__ import annotations

import argparse
import plistlib
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

DEFAULT_REPO = "Renanlvrt/athlete-camera-robot"
DEFAULT_ARTIFACT_NAME = "unsigned-app-ipa"


def download_artifact(repo: str, run_id: int, artifact_name: str, out_dir: Path) -> Path:
    result = subprocess.run(
        [
            "gh", "run", "download", str(run_id),
            "--repo", repo,
            "--name", artifact_name,
            "--dir", str(out_dir),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"gh run download failed:\n{result.stderr.strip()}")

    ipa_files = list(out_dir.glob("*.ipa"))
    if not ipa_files:
        raise RuntimeError(f"No .ipa file found in {out_dir} after download.")
    return ipa_files[0]


def check_nonempty(ipa_path: Path) -> None:
    size = ipa_path.stat().st_size
    if size == 0:
        raise ValueError(f"{ipa_path} is zero bytes.")
    print(f"  size: {size / 1_000_000:.1f} MB")


def check_app_bundle(ipa_path: Path) -> tuple[str, zipfile.ZipFile]:
    zf = zipfile.ZipFile(ipa_path)
    bad_entry = zf.testzip()
    if bad_entry is not None:
        raise ValueError(f"Corrupt zip entry: {bad_entry}")

    app_dirs = {
        name.split("/")[1]
        for name in zf.namelist()
        if name.startswith("Payload/") and name.split("/")[1].endswith(".app")
    }
    if not app_dirs:
        raise ValueError("No Payload/*.app/ directory found in the archive.")
    app_name = app_dirs.pop()
    print(f"  app bundle: Payload/{app_name}")
    return app_name, zf


def check_executable(zf: zipfile.ZipFile, app_name: str) -> None:
    executable_name = app_name.removesuffix(".app")
    expected = f"Payload/{app_name}/{executable_name}"
    if expected not in zf.namelist():
        raise ValueError(f"Expected executable {expected} not found in archive.")
    size = zf.getinfo(expected).file_size
    if size == 0:
        raise ValueError(f"{expected} is zero bytes.")
    print(f"  executable: {expected} ({size / 1_000_000:.1f} MB)")


def check_info_plist(zf: zipfile.ZipFile, app_name: str) -> None:
    plist_path = f"Payload/{app_name}/Info.plist"
    if plist_path not in zf.namelist():
        raise ValueError(f"{plist_path} not found in archive.")
    raw = zf.read(plist_path)
    try:
        parsed = plistlib.loads(raw)
    except Exception as exc:
        raise ValueError(f"{plist_path} did not parse as a plist: {exc}") from exc
    bundle_id = parsed.get("CFBundleIdentifier", "<missing>")
    print(f"  Info.plist parses OK, CFBundleIdentifier={bundle_id}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id", type=int, required=True)
    parser.add_argument("--repo", default=DEFAULT_REPO)
    parser.add_argument("--artifact-name", default=DEFAULT_ARTIFACT_NAME)
    parser.add_argument("--out-dir", type=Path, default=None)
    args = parser.parse_args()

    out_dir = args.out_dir or Path(tempfile.mkdtemp(prefix="unsigned-ipa-"))
    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        print(f"Downloading {args.artifact_name} from run {args.run_id} into {out_dir} ...")
        ipa_path = download_artifact(args.repo, args.run_id, args.artifact_name, out_dir)

        print(f"Checking {ipa_path} ...")
        check_nonempty(ipa_path)
        app_name, zf = check_app_bundle(ipa_path)
        check_executable(zf, app_name)
        check_info_plist(zf, app_name)
    except (RuntimeError, ValueError) as exc:
        print(f"FAILED: {exc}", file=sys.stderr)
        return 1

    print(f"PASS: {ipa_path} looks like a valid unsigned .ipa.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
