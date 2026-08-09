# Real Hardware Test Log

Append-only. **Newest entry at the top.** Every physical test of the robot, the phone, or the
link between them goes here — including the ones that failed.

An agent may only add an entry describing something a human reported. **An agent must never
write an entry for a test it did not receive a human report for.** If you are an agent and are
tempted to fill this in from what the code "should" do, stop: that is the exact failure this
file exists to prevent.

## Entry template

```markdown
## YYYY-MM-DD — <short title>

- **Ran:** <which skill / procedure, e.g. `.claude/skills/ble-ping/`>
- **Hardware present:** <micro:bit rev, moto:bit, PCA9685?, battery, iPhone 16, assembled or bench>
- **Result:** ✅ worked / ⚠️ partly / ❌ failed
- **What happened:** <what was actually observed — not what was expected>
- **Numbers:** <measured values: ms, volts, fps, degrees. "didn't measure" is a valid answer>
- **Surprises:** <anything unexpected, however small>
- **Follow-up:** <what this changes; which file/index needs updating>
```

---

## No entries yet

Nothing in this project has been tested on physical hardware. As of 2026-08-09 the state is:

| Subsystem | Status | Blocked by |
|---|---|---|
| iOS build pipeline | Never run | Repo not yet pushed to GitHub |
| App on the iPhone | Never installed | No successful build yet |
| Camera preview on device | Never seen | No install yet |
| Frame processor / CV | Not implemented | Missing worklets packages (`research/computer-vision/frame-processor-stack-v5.md`) |
| BLE phone↔micro:bit | Never attempted | `react-native-ble-plx` not installed |
| Servo control | Never attempted | PCA9685 not yet purchased (`docs/PRD.md` §8) |
| Closed-loop tracking | Never attempted | All of the above |

**First entry should be the first successful CI build + AltStore install.** That single test
unblocks everything below it in the table.
