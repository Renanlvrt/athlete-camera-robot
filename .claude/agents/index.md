# .claude/agents/ — index

Subagent definitions for this project. Each file defines a scoped worker with its own context
window, its own tool allowlist, and a narrow job. Claude Code auto-discovers every `.md` file
here with valid frontmatter.

## Subagents vs. Skills — they are not the same thing

This repo has two systems that both look like "reusable instructions." Keep them straight:

| | **Skill** (`.claude/skills/`) | **Subagent** (`.claude/agents/`) |
|---|---|---|
| Answers | *How* do I perform this task correctly, the same way every time? | *Who* should do this work, with what tools and what context? |
| Loads into | The current conversation | A **separate** context window |
| Good for | A procedure with steps and scripts — build the ipa, sweep the servos | A chunk of work that would flood the main context — a research sweep, a review pass |
| Analogy | A checklist you follow | A colleague you hand something to |

They compose: a subagent typically *invokes* a skill. `hardware-tester` runs the procedure
defined in `.claude/skills/servo-bounds-test/` — the skill owns the steps, the agent owns the
delegation and the write-up.

**When to use neither:** a one-off question, or a change to a single file. Delegation costs a
cold start; a subagent re-derives context the main conversation already has. Reach for one when
the work is genuinely separable and bulky, not to look organized.

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| `researcher.md` | file | Investigate a domain question, write a sourced finding into `research/`, update the log | ⚠️ needs verification (never invoked yet) |
| `hardware-tester.md` | file | Turn a request into a runnable physical procedure, collect the human's report, log it | ⚠️ needs verification (never invoked yet) |
| `ux-reviewer.md` | file | Review screens against the mockups and the outdoor/glanceable constraints | ⚠️ needs verification (never invoked yet) |

## Depends on
`research/` and `testing/` (where two of them write), `.claude/skills/` (procedures they invoke),
`design/mockups/` (what `ux-reviewer` compares against).

## Depended on by
Nothing imports these — Claude Code loads them directly.
