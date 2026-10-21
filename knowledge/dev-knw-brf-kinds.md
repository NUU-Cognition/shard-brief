---
description: "The four kinds of a Brief (fleet, status, architecture, explainer): the purpose, the sections with their blocks, the stats, and the limits of each"
---

# Knowledge: The Kinds of a Brief

Each Brief has one kind. The kind sets the sections, the stats of the hero, and the limits. Every kind has the same hero (rule 1 of [[dev-knw-brf-principles]]) and the same evidence section at the end; the renderer adds both. `collect` writes a starter `brief.json` with the sections of the kind; each section starts with a TODO callout that says what goes there.

| Kind | Sections | Words | Health |
|------|----------|-------|--------|
| `fleet` | 5 to 7 | about 3,000 | `landed`, `at-risk`, or `blocked` |
| `status` | 5 to 7 | about 2,500 | `landed`, `at-risk`, or `blocked` |
| `architecture` | 3 to 5 | about 2,000 | `info` |
| `explainer` | 3 to 5 | about 2,500 | `info` |

A section has an `id`, a `title`, an optional `summary` (one or two sentences, shown under the title), and its `blocks`. The block types are in [[dev-knw-brf-blocks]].

## fleet

The morning after a fleet. The reader was asleep while the fleet ran. The reader wants to know: did it land, what must I decide, what changed, what failed, and can I trust it.

**Hero.** Eyebrow: the handle, the Task, the time window. Lede: the outcome in at most 3 sentences ("10 of 12 production steps are live with proof. Docs is deferred. One step waits for you."), with `ledeEvidence`. Health from the outcome: never `info`. Stats: 4 to 6 of these: production steps live, lanes landed, commits, sessions, the length of the night, failed runs, open items.

| Order | Section (id) | Blocks | Required |
|-------|--------------|--------|----------|
| 1 | The fleet at a glance (`board`) | `board`: one row for each lane, its health, one cell for each stage (for example Build, Review, QA, Prod), and a note. | Yes |
| 2 | What changed (`changed`) | `changes` (a changelog in groups, with the diffstat). Then `compare` or `gallery` for each visible change, at most 6 images. | Yes |
| 3 | What failed (`failed`) | `failures` (symptom, cause with its basis, what was tried, the state now). Then `retro` (went well, went wrong, got lucky). | Yes |
| 4 | The night (`night`) | `timeline` with `"derived": "timeline"`; add `marks` for the moments that matter (freeze, publish, rollback). A `text` or `claims` block for what the timeline shows (where the agents waited, the critical path). | Yes |
| 5 | The lanes (`lanes`) | `cards`: one for each lane, with a status, 2 or 3 claims, one screenshot, links to the lane report, and the details in `details`. | Yes |
| 6 | Open items (`open`) | `table` or `claims`: what is not done, who owns it, the next step. | When there are open items |
| 7 | Check it yourself (`verify`) | `commands`: the commands that show the proof (smoke tests, `flint orbh fleet show`, the health URLs). Use only commands that work after the fleet: not a tool in `/tmp`. | Optional |

The starter of collect has all 7 sections. Remove `open` or `verify` when it has nothing to say. In "The night", shade the holds and the freezes with `bands`, and cite the facts of each mark.

The stages of the board come from the charter of the fleet. Use the words of the fleet (for example `Build`, `Review`, `QA`, `Prod`). A cell is a status: `done`, `partial`, `failed`, `skipped`, `na`, `running`, `review`, `deferred`.

## status

Where a program or a product stands against its vision. The reader decides what comes next.

**Hero.** Eyebrow: the program, the date. Lede: the stage now and the main gap. Stats: the parts done of all parts, the claims that pass, the open risks, the days since the last release.

| Order | Section (id) | Blocks |
|-------|--------------|--------|
| 1 | Health by area (`areas`) | `board` or `cards`: one for each area, with a status and the reason. |
| 2 | The vision against what is built (`vision`) | `table`: what the vision says, what is built, the gap, with evidence in each row. |
| 3 | Proof (`proof`) | `gallery` of screenshots that show the state now (at most 12). |
| 4 | Gaps and risks (`gaps`) | `claims` or `failures`. |
| 5 | Next steps (`next`) | `steps` or `claims`, in order. |

## architecture

How a system is built. The reader must be able to follow one request through the system after one read.

**Hero.** Eyebrow: the system, the repository, the commit. Lede: the system in one sentence, then the one idea that makes it work. Health: `info`. Stats: the number of parts, the number of repositories or packages, the main numbers of size.

| Order | Section (id) | Blocks |
|-------|--------------|--------|
| 1 | The map (`map`) | `diagram` with at most 9 nodes and 2 to 4 `paths` that the reader steps through. |
| 2 | The parts (`parts`) | `cards`: one for each node of the map, with what it owns and where its code is (a link). |
| 3 | How a request moves (`flows`) | `steps`, or a second `diagram` for the most important flow. |
| 4 | What this Brief did not check (`unchecked`) | `claims` (mostly `inferred`): what is not checked live. |

When the system has more than 9 parts, group them. Make a second Brief for a part that needs its own map.

## explainer

One concept or one mechanism. The reader must be able to use it or debug it after one read.

**Hero.** Eyebrow: the area, the concept. Lede: what it is and why it exists. Health: `info`. Stats: the numbers that define it (states, steps, limits).

| Order | Section (id) | Blocks |
|-------|--------------|--------|
| 1 | The idea (`idea`) | `text` and one `diagram`. |
| 2 | Step by step (`steps`) | `steps`, with `code` where it helps. |
| 3 | Try it (`try`) | `commands` or `code`. |
| 4 | Pitfalls (`pitfalls`) | `failures` or `claims`. |

## Kinds that come later

`guide` (a long interactive guide with a table of contents and exercises, like "Flint Modules - Interactive Guide") and `explorer` (a page that explores a large data set, like "orb-crosstalk") are not in v0.1. A `digest` (the work of a week, for Proposals 006 and 007) is a later kind of `fleet`.

## The old pages

These pages in `Media/` show each kind. Read the head of one to see the idea, not to copy its code.

| Kind | Page |
|------|------|
| `fleet` | `Steel Polish Overnight.html` (Task 1260), `NUU Day Fleet Status.html` (Task 1259), `NUU Network 0.1 - What Was Built.html` (Task 1272) |
| `status` | `Where Steel Stands.html` (Task 1126) |
| `architecture` | `The Architecture of the NUU Network.html` (Notepad 226), `The Architecture of Steel.html` (Notepad 218) |
| `explainer` | `plate-state-sync-explainer.html` (Task 488), `tinderbox-server-lifecycle-explainer.html` (Task 472) |
