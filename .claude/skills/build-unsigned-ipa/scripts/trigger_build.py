#!/usr/bin/env python3
"""
Dispatch the "Build unsigned iOS app (for Sideloadly)" GitHub Actions workflow
and poll until it completes.

STATUS: stub — not yet implemented. Flesh this out once
.github/workflows/build-ios-unsigned.yml has been run successfully at least once
by hand (see docs/VERIFICATION_REPORT.md), so this script mirrors a workflow
that's known to actually work rather than guessing at its interface.

Planned shape:
  - shell out to `gh workflow run <workflow-file> --repo <owner>/<repo>`
  - poll `gh run list` / `gh run watch` for completion
  - exit non-zero with the failure log on failure, print the run URL on success
"""

raise NotImplementedError(
    "trigger_build.py is a scaffold — see SKILL.md 'Status' section before using."
)
