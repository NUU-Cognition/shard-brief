---
description: "Collect the facts of a Brief with the script collect: facts.json and a starter brief.json in the work folder, with no LLM"
---

> [!important] THIS FILE IS AN INSTRUCTION. WHEN REFERENCED IT IS MEANT TO BE TAKEN AS AN ACTION.

Run `flint shard start brf` if you haven't already.

# Skill: Collect

Collect the facts of one Brief from the records, the commits, the notes, and the media. Each fact keeps its source.

# Input

- The kind: `fleet`, `status`, `architecture`, or `explainer`
- For `fleet`: the handle of the fleet
- For the other kinds: the title, and the repositories, the notes, and the media folders that the Brief covers
- (Optional) A time window (`--since`, `--until`) and a grep for the commits

# Actions

1. **Run collect.**
   - A fleet:
     ```bash
     flint shard brf collect --kind fleet --fleet <handle>
     ```
     Add `--repo <path>` for a repository outside `../Repos/`, and `--media <dir>` for evidence outside `Media/Fleets/<handle>/` (for example `--media "Media/Task 1274"`).
   - Another kind:
     ```bash
     flint shard brf collect --kind <kind> --title "<Title>" --repo <path> --since <YYYY-MM-DD> --note "<Mesh path>" --media "<Media path>"
     ```
2. **Read the result.** The JSON on stdout gives the work folder, the number of facts, the repositories with their commits, the notes, and the media folders. When `ok` is false, fix the cause (`reason`) and run it again.
3. **Check the coverage.** Compare the counts with what you know of the work:
   - A fleet with 0 commits: the commits have no `Orbh-Fleet:` trailer, or the repository is not in `../Repos/`. Add `--repo`.
   - A note that is missing: add `--note`.
   - Media that is missing: add `--media`.
   Run collect again after a change. It keeps an existing `brief.json`; delete it first only when you want a new starter.
4. **Look at the facts.** Read `facts.json`: the `fleet:`, `lane:`, and `git:` facts, and `derived.notes` and `derived.media`. They tell you what to read next ([[dev-knw-brf-sources]]).

# Output

- `.flint/briefs/<YYYY-MM-DD>-<slug>/facts.json`: the facts and the derived data
- `.flint/briefs/<YYYY-MM-DD>-<slug>/brief.json`: a starter spec with the sections of the kind and a TODO in each place to fill
