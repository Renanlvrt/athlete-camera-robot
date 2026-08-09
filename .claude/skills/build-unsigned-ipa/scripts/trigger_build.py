#!/usr/bin/env python3
"""
Dispatch the "Build unsigned iOS app (for sideloading)" GitHub Actions workflow
and poll until it completes.

Verified 2026-08-09 against .github/workflows/build-ios-unsigned.yml, which has run
green twice (see docs/VERIFICATION_REPORT.md, "CI workflow ran green, first attempt,
twice"). This script mirrors the interface used to trigger and watch those runs by
hand: `gh workflow run` to dispatch, then `gh run list` / `gh run view` to find and
poll the new run.

Usage:
    python trigger_build.py [--repo OWNER/NAME] [--workflow FILE] [--branch BRANCH]
                             [--poll-seconds N] [--timeout-minutes N]

Exit code 0 on a successful run (prints the run ID and URL). Non-zero on dispatch
failure, timeout, or a completed-but-failed run (prints the run ID so
verify_artifact.py or `gh run view --log-failed` can be used to inspect it).
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timezone

DEFAULT_REPO = "Renanlvrt/athlete-camera-robot"
DEFAULT_WORKFLOW = "build-ios-unsigned.yml"
DEFAULT_BRANCH = "main"
DEFAULT_POLL_SECONDS = 30
DEFAULT_TIMEOUT_MINUTES = 45  # matches the workflow's own timeout-minutes


def run_gh(args: list[str]) -> str:
    result = subprocess.run(
        ["gh", *args], capture_output=True, text=True, check=False
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"gh {' '.join(args)} failed (exit {result.returncode}):\n{result.stderr.strip()}"
        )
    return result.stdout


def check_gh_authenticated() -> None:
    result = subprocess.run(
        ["gh", "auth", "status"], capture_output=True, text=True, check=False
    )
    if result.returncode != 0:
        raise RuntimeError(
            "gh is not authenticated. Run `gh auth login` once, then retry.\n"
            f"{result.stderr.strip()}"
        )


def dispatch_workflow(repo: str, workflow: str, branch: str) -> datetime:
    dispatched_at = datetime.now(timezone.utc)
    run_gh(["workflow", "run", workflow, "--repo", repo, "--ref", branch])
    return dispatched_at


def find_new_run_id(repo: str, workflow: str, dispatched_at: datetime) -> int:
    """Poll gh run list until a workflow_dispatch run newer than dispatched_at appears.

    `gh workflow run` does not return a run ID directly, so the new run has to be
    located by timestamp — this is the documented gh CLI approach.
    """
    for _ in range(10):
        output = run_gh(
            [
                "run", "list",
                "--repo", repo,
                "--workflow", workflow,
                "--event", "workflow_dispatch",
                "--limit", "5",
                "--json", "databaseId,createdAt",
            ]
        )
        for run in json.loads(output):
            created_at = datetime.fromisoformat(run["createdAt"].replace("Z", "+00:00"))
            if created_at >= dispatched_at:
                return run["databaseId"]
        time.sleep(3)
    raise RuntimeError(
        "Could not find the dispatched run after 30s of polling gh run list. "
        "Check `gh run list` manually - the dispatch may have been delayed."
    )


def poll_until_complete(repo: str, run_id: int, poll_seconds: int, timeout_minutes: int) -> str:
    deadline = time.monotonic() + timeout_minutes * 60
    while time.monotonic() < deadline:
        output = run_gh(
            ["run", "view", str(run_id), "--repo", repo, "--json", "status,conclusion"]
        )
        state = json.loads(output)
        if state["status"] == "completed":
            return state["conclusion"]
        time.sleep(poll_seconds)
    raise TimeoutError(f"Run {run_id} did not complete within {timeout_minutes} minutes.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=DEFAULT_REPO)
    parser.add_argument("--workflow", default=DEFAULT_WORKFLOW)
    parser.add_argument("--branch", default=DEFAULT_BRANCH)
    parser.add_argument("--poll-seconds", type=int, default=DEFAULT_POLL_SECONDS)
    parser.add_argument("--timeout-minutes", type=int, default=DEFAULT_TIMEOUT_MINUTES)
    args = parser.parse_args()

    try:
        check_gh_authenticated()
        print(f"Dispatching {args.workflow} on {args.repo}@{args.branch} ...")
        dispatched_at = dispatch_workflow(args.repo, args.workflow, args.branch)

        run_id = find_new_run_id(args.repo, args.workflow, dispatched_at)
        run_url = f"https://github.com/{args.repo}/actions/runs/{run_id}"
        print(f"Run {run_id} started: {run_url}")

        conclusion = poll_until_complete(
            args.repo, run_id, args.poll_seconds, args.timeout_minutes
        )
    except (RuntimeError, TimeoutError) as exc:
        print(f"FAILED: {exc}", file=sys.stderr)
        return 1

    if conclusion == "success":
        print(f"SUCCESS: run {run_id} - {run_url}")
        return 0

    print(
        f"FAILED: run {run_id} concluded '{conclusion}'. "
        f"Inspect with: gh run view {run_id} --repo {args.repo} --log-failed",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
