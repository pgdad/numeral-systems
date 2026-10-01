---
description: Implement the next phase of the numeral-systems plan (or a given phase number)
argument-hint: "[phase number, optional]"
---

You are continuing the phased build in this repo. Follow `CLAUDE.md` exactly.

1. Read `CLAUDE.md`, `docs/plan/PROGRESS.md`, `docs/plan/PLAN.md` and `docs/plan/DECISIONS.md`.
2. Requested phase: "$ARGUMENTS". If it's empty, pick the next phase using the
   rules in CLAUDE.md § "Picking the phase".
3. Read that phase's file in `docs/plan/phases/` and, for lesson phases, the
   matching section of `docs/plan/CONTENT.md`.
4. Tell me in one or two sentences which phase you're doing, then implement it fully.
   Verify every acceptance criterion: run `tools/check.sh`, and look at the page in a
   browser if you can.
5. Finish with the "End of every session" steps in CLAUDE.md: tick the checkboxes,
   update PROGRESS.md with a handoff note, update DECISIONS.md if needed, and commit.
6. Give me a short summary: what's done, how to see it (which file to open, which
   lesson to click), and which phase comes next.
