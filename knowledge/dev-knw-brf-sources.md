---
description: "Where the facts of a Brief come from: what collect reads for each kind, the format of facts.json and its derived data, the fact ids, and the commands to read more"
---

# Knowledge: The Sources of a Brief

`flint shard brf collect` reads the sources and writes `facts.json` into the work folder `.flint/briefs/<YYYY-MM-DD>-<slug>/`. This file says what it reads, what it writes, and where to look for more.

## What collect reads

| Source | `fleet` | Other kinds |
|--------|---------|-------------|
| The fleet record | `flint orbh fleet show <handle> --json`: the charter, the status, the outcome, the report, the Task | — |
| The timeline | `flint orbh timeline fleet:<handle> --json`: the sessions, the runs, the messages, the session keys `phase`, `progress`, and `blockers` | — |
| Commits | Each repository with `Orbh-Fleet: <handle>` in a commit: this Flint, each `--repo`, and each repository in `../Repos/` (not with `--no-auto-repos`). A commit in two worktrees counts one time. | Each `--repo`, from `--since` to `--until` (default: the last 7 days), with `--grep` when given |
| Mesh notes | The charter Task, the report, each note in `Mesh/Notes/<handle>/`, each note with the handle in `orbh-fleet`, and each `--note` | Each `--note` |
| Media | `Media/Fleets/<handle>/` and each `--media` | Each `--media` |

## The fact ids of collect

| Id | Text | Source |
|----|------|--------|
| `fleet:charter`, `fleet:status`, `fleet:outcome`, `fleet:window`, `fleet:sessions`, `fleet:messages` | The fleet record and the totals | `orbh` |
| `fleet:report`, `fleet:task` | The paths of the report and the charter Task | `mesh` |
| `lane:<KEY>` | One lane: its sessions, runs, failed runs, and the time with at least one agent at work | `orbh` |
| `session:<id8>` | One session: its title, lane, runs, work time, messages, last progress, last blockers | `orbh` |
| `run:<id8>` | One failed run, with the start of its result | `orbh` |
| `git:total`, `git:<repo>` | The commits, the file changes, and the lines added and removed | `command` |
| `git:lane:<KEY>` | The commits that name the lane in the subject ("lane GARDEN") | `command` |
| `commit:<sha8>` | One commit: the repository, the time, the subject. The sha has 8 characters, as the notes write it. | `git` |
| `note:<slug>` | One note: its title, the reason why collect took it (the report, the charter Task, the fleet folder, `orbh-fleet`, or `--note`), its words, and its headings | `mesh` |
| `media:<folder>` | One folder of media: the images, videos, and other files | `media` |

A note that a session of the fleet edited (its `orbh-fleet` has the handle) can be outside the work of the fleet, for example a source that got one line. Read its reason before you cite it.

A lane is a session of depth 1 that has a lane word in its title (`ADDR`, `QA`, `GARDEN`). Its helpers and reviewers belong to it. A session of depth 1 with no lane word belongs to the root. A commit that names `GARDEN-H1` counts for `GARDEN`.

The line counts are the sum over the commits. A file that two commits change counts two times. Say "file changes" and not "files".

## The derived data

`facts.json#derived` holds data that is not a fact but that a block uses:

| Key | What | Used by |
|-----|------|---------|
| `tz` | The time zone of the machine that collected (`+11:00`) | All times on the page |
| `timeline` | `start`, `end`, `lanes` (key, name, sub, busyMs, spans with start, end, row, status, label), and `marks` (Declared, Closed) | `{ "type": "timeline", "derived": "timeline" }` |
| `lanes` | Each lane with its sessions and busy time | The agent, for the board |
| `git` | Each repository with its commits and totals | The agent, for the diffstat |
| `notes` | Each note with its path, the reason, its words, and its headings | The agent, to choose what to read |
| `media` | Each media folder with its counts and the paths of its images (up to 2,000) | The agent, to choose screenshots |
| `git` | Each repository with its commits, the newest last | The agent, for `asOf` |

## Read more than collect gives

The notes are the main source of the meaning: collect gives their headings, and the agent reads them. For a fleet, read in this order: the report, the Release Plan or the publish notes, the lane reports, the QA report, then the charter Task. Quote each sentence that a claim depends on (a fact with `source.quote`).

| To find | Command |
|---------|---------|
| The result of one session | `flint orbh result <session-id>` |
| The state of one session | `flint orbh inspect <session-id>` |
| The events of the fleet in Markdown | `flint orbh timeline fleet:<handle> --markdown` |
| The updates of a fleet | `flint orbh fleet updates <handle>` |
| A commit | `git -C <repo> show --stat <sha>` |
| The screenshots of a lane | `ls "Media/Fleets/<handle>/<LANE>/"` |

## The work folder

| File | Written by | Kept |
|------|------------|------|
| `facts.json` | collect | Until the next collect. The page holds a copy. |
| `brief.json` | collect (the starter), then the agent | The page holds a copy. |
| `check.json`, `shots/` | check | Until the next check. |

The work folder is under `.flint/`, so it is on this machine only. The page holds the spec and the facts. To change a Brief on another machine, extract them first: `flint shard brf render --from "<page>" --extract` writes `brief.json` and `facts.json` into `.flint/briefs/<id>/`.
