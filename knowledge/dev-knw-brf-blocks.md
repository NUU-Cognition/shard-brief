---
description: "The spec of a Brief (brief/0.1): the top fields, the facts, the inline text, and each of the 18 block types with an example"
---

# Knowledge: The Spec and Its Blocks

The agent writes `brief.json`. The script `render` makes the page from it. The full schema is the asset `ast-brf-schema.json` of the shard; `render` and `check` validate against it. This file gives the meaning and an example of each part.

## The rules of the format

- **Paths** are relative to the Flint root: `Media/Fleets/nuu-apps-1016/QA/x.png`, `Mesh/Notes/nuu-apps-1016/QA - Lane Report.md`. The renderer makes them relative to the page.
- **Inline text** accepts `**bold**`, `` `code` ``, and `[label](path or URL)`. Nothing else: the renderer escapes all other characters. A blank line in a `text` block starts a new paragraph.
- **Evidence** is a list of fact ids: `"evidence": ["fleet:outcome", "commit:ac48d3644"]`. The page shows each as a small number that opens the fact.
- **Basis**: `"observed"` or `"inferred"` (see [[dev-knw-brf-principles]]).
- **Statuses** (cards, tables, the cells of the board): `done`, `landed`, `pass`, `fixed` (earth, green); `partial`, `at-risk`, `open`, `mitigated` (sun, amber); `failed`, `blocked`, `fail` (fire, red); `running`, `info` (water, blue); `review` (storm, violet); `deferred` (air); `skipped`, `na`, `accepted` (moon, grey). The schema refuses any other word.
- **Screenshots cite themselves.** The renderer adds a fact for each image of a `gallery`, a `compare`, or a card, and the figure cites it. Cite other facts only for what the caption claims.
- **Where a screenshot was taken**: `env` on an image (`dev`, `staging`, `prod`, `local`) shows a tag. Set it when a reader could think that a dev screenshot shows production.
- **Tones** (stats, groups, nodes): `earth`, `sun`, `fire`, `water`, `air`, `moon`, `storm`, `ocean`.

## The top fields

```json
{
  "schema": "brief/0.1",
  "id": "2026-10-16-nuu-apps-network-fleet",
  "kind": "fleet",
  "title": "NUU Apps Network Fleet",
  "date": "2026-10-16",
  "tz": "+11:00",
  "eyebrow": ["nuu-apps-1016", "Task 1274", "Fri 16 Oct 00:07 – 08:48"],
  "lede": "10 of 12 production steps are live with proof. …",
  "ledeEvidence": ["fleet:outcome"],
  "health": { "state": "at-risk", "label": "…", "evidence": ["fleet:outcome"] },
  "asOf": { "at": "2026-10-15T21:48:50Z", "commits": ["067be327"], "commands": ["flint orbh fleet show nuu-apps-1016"] },
  "stats": [ { "value": "10 / 12", "label": "production steps live", "tone": "earth", "evidence": ["fleet:outcome"] } ],
  "decisions": [ { "id": "docs", "title": "…", "why": "…", "options": ["Do it today", "Wait"], "recommend": "Do it today", "evidence": ["…"] } ],
  "sections": [ { "id": "board", "title": "The fleet at a glance", "summary": "…", "blocks": [ … ] } ],
  "related": [ { "label": "The fleet report", "href": "Mesh/Notes/nuu-apps-1016/Report - NUU Apps Network Fleet 2026-10-16.md" } ],
  "scope": { "fleet": "nuu-apps-1016", "task": "Task 1274" },
  "facts": [ … ]
}
```

| Field | Rule |
|-------|------|
| `id` | `<date>-<slug>`. The browser keeps the answers to the decisions under it. Do not change it after the person answered. |
| `title` | At most 90 characters. The file name of the page comes from the date and the title. |
| `lede` | At most 3 sentences and 600 characters. `ledeEvidence` cites the facts of its numbers; the chips show after the lede. |
| `stats` | 1 to 6; use 4 to 6. Each one cites a fact. |
| `decisions` | 0 to 7. Leave the list out, or empty, when nothing waits for the person. `recommend` must be one of the `options`, word for word. |
| `sections` | 1 to 10. |

## Facts

`collect` writes the facts of the records into `facts.json`. The agent adds more in `brief.json#facts`:

```json
{ "id": "rel:s2b-deferred", "text": "The Release Plan: S2b Docs stopped before any upload; the manager deferred it.",
  "source": { "type": "mesh", "path": "Mesh/Notes/nuu-apps-1016/Release Plan - 2026-10-16.md", "quote": "S2b Docs was stopped before any upload" } }
```

| Source type | Fields | Check |
|-------------|--------|-------|
| `mesh` | `path`, `quote` | The path exists; the quote is in the file (spaces and quote marks do not count). Always quote a note. |
| `media` | `path` | The path exists. |
| `file` | `path`, `quote` (optional) | The same as `mesh`. |
| `git` | `repo`, `ref` (the short sha) | None. Prefer the `commit:` facts of collect. |
| `orbh` | `ref` (the command) | None. Prefer the facts of collect. |
| `command` | `ref` (the command) | None. The reader can run it. |
| `url` | `ref` | None. |

The id of a fact: letters, digits, and `: . _ / -`. Use a prefix that says what it is: `rel:`, `qa:`, `report:`.

**The quote.** The check ignores the case, the runs of spaces and line breaks, and the kind of quote marks (`"` and `“”`, `'` and `‘’`). Copy everything else exactly as it is in the file, also `**`, backticks, and `|`. Quote one sentence or a part of one.

**What the number check reads.** For each place that cites facts, the check finds each number of its text in the `text`, the `value`, the `source.quote`, or the `source.ref` of those facts. Put the number into the `text` of a fact that you add, in the same form as the claim (`2.5 hours` and `2.5 h` both hold `2.5`).

## The limits

| Field | Limit |
|-------|-------|
| `title` | 90 characters |
| `lede` | 600 characters, 3 sentences |
| a stat `label` | 80 characters |
| a decision `title` / `why` / an option / `recommend` | 140 / 700 / 80 / 80 characters |
| a claim | 600 characters |
| a card `title` / `sub` / `text` | 80 / 120 / 900 characters |
| a `text` block | 2,000 characters |
| a section `title` / `summary` | 60 / 500 characters |
| a board stage / lane / note | 24 / 40 / 400 characters |
| a failure `symptom` / `cause` / `tried` | 500 characters each |
| a diagram node `label` / `note` | 28 / 40 characters; at most 9 nodes, 6 paths, 8 steps in a path |
| a timeline mark `label` | 40 characters; at most 6 bands |
| a gallery | 12 images |
| a fact `text` / `quote` | 1,200 / 600 characters |

## The blocks

### text

Prose. Use it for the one paragraph that a list cannot say.

```json
{ "type": "text", "title": "Optional", "text": "First paragraph.\n\nSecond paragraph.", "basis": "inferred", "evidence": ["lane:QA"] }
```

### claims

A list of claims. The main block of a Brief.

```json
{ "type": "claims", "items": [ { "text": "Each app resolves its objects by address.", "basis": "observed", "evidence": ["qa:accept"] } ] }
```

### callout

One message that must stand out. `tone`: `info`, `ok`, `warn`, `risk`.

```json
{ "type": "callout", "tone": "risk", "title": "S4 waits for the operator", "text": "…", "evidence": ["…"] }
```

### stats

A row of numbers inside a section (the hero has its own).

```json
{ "type": "stats", "items": [ { "value": 147, "label": "commits in main", "evidence": ["git:main"] } ] }
```

### board

The fleet at a glance: one row for each lane, one cell for each stage.

```json
{ "type": "board", "stages": ["Build", "Review", "QA", "Prod"],
  "rows": [ { "lane": "GARDEN", "sub": "Carbon and the meshes", "health": "landed",
              "cells": { "Build": "done", "Review": "done", "QA": "pass", "Prod": "done" },
              "note": "Carbon is live (S2d).", "evidence": ["lane:GARDEN"] } ] }
```

### table

A table. A cell is a string, a number, or `{ "text", "status", "evidence" }`.

```json
{ "type": "table", "columns": ["Step", "App", "State"], "rows": [ ["S2a", "Citations", { "text": "Live", "status": "done", "evidence": ["…"] }] ], "caption": "…" }
```

### cards

A grid of cards. Use it for the lanes, the parts of a system, the areas of a program. `columns`: 2 to 5 (the default is 3). A card can have a `status` (with `statusLabel` to change its word), a `text`, `claims`, one `image`, `links`, and `details` (blocks in a part that opens; `detailsLabel` names it).

```json
{ "type": "cards", "columns": 3, "items": [ {
  "title": "QA", "sub": "Manual tests and edge cases", "status": "done",
  "claims": [ { "text": "…", "basis": "observed", "evidence": ["lane:QA"] } ],
  "image": { "src": "Media/Fleets/nuu-apps-1016/QA/x.png", "alt": "…" },
  "links": [ { "label": "Lane report", "href": "Mesh/Notes/nuu-apps-1016/QA - Lane Report.md" } ],
  "details": [ { "type": "claims", "items": [ … ] } ] } ] }
```

### changes

What changed, as a changelog. The label of a group sets its colour: `Added` (earth), `Changed` (water), `Fixed` (sun), `Removed` (fire), `Security` (storm); `tone` sets another.

```json
{ "type": "changes", "diffstat": { "files": 842, "insertions": 24070, "deletions": 9558, "label": "main, 147 commits", "evidence": ["git:main"] },
  "groups": [ { "label": "Added", "items": [ { "text": "One address for each object …", "evidence": ["git:lane:ADDR"] } ] } ] }
```

### failures

What failed. The cause has a basis. `state`: `fixed`, `mitigated` (the symptom is gone, but the cause stays), `open`, `deferred`, `accepted`.

```json
{ "type": "failures", "items": [ { "title": "Docs upload", "symptom": "…", "cause": "…", "basis": "inferred", "tried": "…", "state": "deferred", "evidence": ["…"] } ] }
```

### retro

Went well, went wrong, got lucky. Each item is a string or a claim.

```json
{ "type": "retro", "well": [ { "text": "…", "basis": "observed", "evidence": ["…"] } ], "wrong": [ "…" ], "lucky": [ "…" ] }
```

### timeline

Swimlanes of time. For a fleet use the derived data of collect: one lane for each lane of the fleet, one thin row for each session, a mark at the declare and the close. Add marks; rename or hide lanes.

```json
{ "type": "timeline", "derived": "timeline", "note": "…",
  "marks": [ { "at": "2026-10-15T17:20:00Z", "label": "Freeze" } ],
  "laneNames": { "REL": "Release" }, "hide": ["root"] }
```

Without `derived`, give `lanes` (`name`, `sub`, `spans` with `start`, `end`, `status`, `row`) and `marks`. When you give `marks`, they replace the derived marks: repeat Declared and Closed if you want them.

A mark and a band can cite facts. `bands` shade a range of time across all lanes (a hold, a freeze, an outage). The marks and the bands of the spec are also listed under the timeline, each with its time and its evidence.

```json
{ "type": "timeline", "derived": "timeline",
  "marks": [ { "at": "2026-10-15T17:20:00Z", "label": "Package freeze", "evidence": ["task:freeze"] } ],
  "bands": [ { "start": "2026-10-15T18:18:00Z", "end": "2026-10-15T20:52:00Z", "label": "Publish on hold", "tone": "sun", "evidence": ["report:hold"] } ] }
```

### diagram

At most 9 nodes, laid out from left to right by the edges. A back edge curves under the nodes. `paths` (at most 6) let the reader step through the nodes; each step can have a note.

```json
{ "type": "diagram", "title": "One address, one resolver",
  "nodes": [ { "id": "app", "label": "An app", "note": "Ops, Orbs, Docs, …" }, { "id": "res", "label": "The resolver", "tone": "water" } ],
  "edges": [ { "from": "app", "to": "res", "label": "nuu://…" } ],
  "paths": [ { "name": "Open a link", "steps": ["app", "res"], "notes": ["The app gets an address.", "The resolver finds the origin."] } ] }
```

### gallery

Screenshots, at most 12. The caption says what to see. `tall: true` shows the whole image (for a phone screen).

```json
{ "type": "gallery", "items": [ { "src": "Media/Fleets/nuu-apps-1016/QA/x.png", "caption": "…", "env": "dev" } ] }
```

### compare

Before and after.

```json
{ "type": "compare", "before": { "src": "…", "caption": "…", "env": "dev" }, "after": { "src": "…", "caption": "…", "env": "dev" }, "evidence": ["…"] }
```

### steps

Numbered steps, each with a title, a text, and optional code.

```json
{ "type": "steps", "items": [ { "title": "Collect", "text": "…", "code": "flint shard brf collect …" } ] }
```

### commands

Commands with a copy button.

```json
{ "type": "commands", "items": [ { "label": "Show the fleet record", "cmd": "flint orbh fleet show nuu-apps-1016" } ] }
```

### code

A block of code or output.

```json
{ "type": "code", "lang": "text", "text": "…" }
```

### details

A part that the reader opens: level 2 and level 3 detail. It holds other blocks.

```json
{ "type": "details", "title": "All 12 production steps", "open": false, "blocks": [ { "type": "table", … } ] }
```
