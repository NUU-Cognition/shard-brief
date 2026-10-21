---
required-reading:
  - "[[dev-knw-brf-principles]]"
  - "[[dev-knw-brf-kinds]]"
  - "[[dev-knw-brf-blocks]]"
orbh-sessions:
  - "[[b196755f-5e21-43d7-94f0-4c43c6e0d2a6]]"
---

# Brief

A **Brief** is one HTML page that explains technical work to a person. A person opens it as a raw file in a browser. It is designed to explain: the first screen gives the answer, the decisions that wait for the person come next, and each claim links to the fact that proves it.

## Where a Brief lives

| What | Where |
|------|-------|
| The page | `Media/Briefs/(Brief) <YYYY-MM-DD> <Title>.html`. One file. It loads no script from the network. |
| The work folder | `.flint/briefs/<YYYY-MM-DD>-<slug>/`: `facts.json`, `brief.json`, `check.json`, and `shots/`. It is on this machine only. |
| The data of the page | Inside the page (`<script id="brief-source">`): the spec and the facts. `flint shard brf render --from "<page>"` makes the page again from it. |
| The link | The Task, Report, or Notepad that the Brief explains links to the page. A Brief has no Mesh type. |

Images are not copied into `Media/Briefs/`. The page links to the evidence where it is (`Media/Fleets/<handle>/…`, `Media/Task NNNN/…`). New screenshots for a Brief go into the evidence folder of the work.

## The four steps

```
collect  →  write  →  render  →  check
script      agent      script      script + a fresh agent
facts.json  brief.json the page    check.json, screenshots, and a visual verdict
```

1. **Collect** ([[dev-sk-brf-collect]]). `flint shard brf collect` reads the records, the commits, the notes, and the media, and writes `facts.json`. Each fact has an id and a source. No LLM runs in this step. It also writes a starter `brief.json` with the sections of the kind.
2. **Write** ([[dev-sk-brf-write]]). The agent reads the facts and the notes, and fills `brief.json`: the typed spec of the page. Each claim cites fact ids and is `observed` or `inferred`. The agent can add facts, and each one quotes its source.
3. **Render** ([[dev-sk-brf-render]]). `flint shard brf render` validates the spec and writes the page: full width, in the NUU Cognition styles, light and dark.
4. **Check** ([[dev-sk-brf-check]]). `flint shard brf check` checks the schema, the facts, the grounding of each number, each quote, each path, the limits, and the privacy, and renders the page in headless Chrome at 1280 px and 390 px with no network. Then a fresh agent inspects the screenshots. At most 2 rounds of repair.

The workflow [[dev-wkfl-brf-brief]] runs the four steps with the person. In a headless session, for example at the close of a fleet, it runs them with no person: follow its `> [!headless]` callouts.

## The kinds

| Kind | It explains | Example |
|------|-------------|---------|
| `fleet` | What a fleet did: the outcome, the decisions, the lanes, what changed, what failed, and the night | The morning after an overnight fleet |
| `status` | Where a program or product stands against its vision | "Where Steel Stands" |
| `architecture` | How a system is built: one map, its parts, and paths through it | "The Architecture of the NUU Network" |
| `explainer` | One concept or mechanism, step by step | "Plate State Sync" |

The sections of each kind are in [[dev-knw-brf-kinds]]. The blocks that a section can hold are in [[dev-knw-brf-blocks]].

## When to make a Brief

- **A person asks for one**, in any words: "an interactive html that explains …", "a page of where we are", "explain what the fleet did". Run [[dev-wkfl-brf-brief]].
- **A fleet closes.** The root of a fleet makes a `fleet` Brief after it writes the text report and before `flint orbh fleet close`. It runs [[dev-wkfl-brf-brief]] with its `> [!headless]` callouts (no checkpoint), also in an interactive session, and puts the path of the Brief in the report.

## Scripts

| Script | Command | Output |
|--------|---------|--------|
| collect | `flint shard brf collect --kind fleet --fleet <handle>` · `flint shard brf collect --kind status --title "<Title>" --repo <path> --note <path> --media <dir>` | `facts.json` and a starter `brief.json` in the work folder; JSON on stdout |
| render | `flint shard brf render "<work>/brief.json"` · `flint shard brf render --from "<page>"` | The page in `Media/Briefs/`; JSON on stdout |
| check | `flint shard brf check "<page>" [--no-browser]` | `check.json` and `shots/` in the work folder; JSON on stdout; exit 1 on an error |

The scripts need Node.js 22 or later. The browser checks need Google Chrome (or `BRIEF_CHROME`). When Chrome cannot start (for example in a sandbox), check gives a warning and runs the other checks.

## Rules

- Never write the HTML by hand. Change `brief.json` and render again.
- Never write a number that is not in a fact. Never mark a claim `observed` without a fact.
- Give the person the decisions, not a wall of text. A Brief that is long is a Brief that is not finished.
- Write the text of a Brief in the writing standard of the Flint (in this Flint: ASD-STE100 Simplified Technical English).
- Do not publish a Brief to a web service. The person reads it as a file in `Media/Briefs/`.

# Headless

A headless or subagent Orbh session has no person at the terminal. It loads this init with `flint shard start brf`, as an interactive session does. The four steps, the kinds, the scripts, and the rules above do not change. Follow the `> [!headless]` callouts of [[dev-wkfl-brf-brief]].

## What is different in a headless session

- No person reviews the Brief before it is committed. The check is the review: run the script and the visual inspection by a fresh subagent, with at most 2 rounds of repair, and write each error that stays into the result.
- Report the progress with the session keys (see Orbh Interface Keys).
- A Brief never blocks the work that it explains. When collect or render fails, set `blockers`, write the reason in the report, and let the caller go on.
- Decisions in the Brief are questions for the person, with a recommendation. Do not act on them.

## Orbh Interface Keys

Report the progress with `flint orbh session set <key> <value>`.

| Key | Value |
|-----|-------|
| `phase` | One value of Phase Values |
| `progress` | The path of the page (at the end: the path, the strip of claims, and the errors or no error) |
| `blockers` | The reason when collect or render fails, for example `brief: collect failed: <reason>` |

### Phase Values

| Phase | Stage of [[dev-wkfl-brf-brief]] |
|-------|------|
| `brief-collect` | Stage 2: Collect |
| `brief-write` | Stage 3: Write |
| `brief-check` | Stage 4: Render and Check |
| `brief-link` | Stage 6: Register |

## Result Delivery

When a session was started only to make the Brief, end it with `flint orbh session return --finish "<result>"`, with the path of the page and the result of the check in the result. When the root of a fleet makes the Brief at the close-out, it does not return the session: it closes the fleet (below).

## At the close of a fleet

The root of a fleet makes a `fleet` Brief between the report and the close:

1. Write the report of the fleet into the Mesh (step 3 of the close-out).
2. Run [[dev-wkfl-brf-brief]] with the kind `fleet` and the handle.
3. Add the link of the Brief to the report, and commit.
4. Close the fleet: `flint orbh fleet close "<outcome>" --report "<report path>"`.
