---
description: "Make a Brief with the person: agree the kind and the scope, collect the facts, write the spec, render and check the page, and review it with the person. In a headless session (for example at the close of a fleet): collect, write, render, check with a fresh agent, link, and commit, with progress in the Orbh session keys"
orbh-sessions:
  - "[[b196755f-5e21-43d7-94f0-4c43c6e0d2a6]]"
---

> [!important] THIS FILE IS AN INSTRUCTION. WHEN REFERENCED IT IS MEANT TO BE TAKEN AS AN ACTION.

Run `flint shard start brf` if you haven't already.

# Workflow: Brief

Make one Brief: an explanatory HTML page in `Media/Briefs/` that the person opens as a file.

> [!headless]
> In a headless or subagent Orbh session, make one Brief with no person in the loop. Do the same stages with no checkpoint, and follow the `> [!headless]` callout in each stage. Report the progress with the session keys (the section `# Headless` of [[dev-init-brf]]). At the close of a fleet, the root of the fleet follows these callouts too, also in an interactive session.

# Input

- What to explain, in the words of the person ("explain what the fleet did", "a page of where Steel stands", "how the network is built")
- (Optional) The kind, the scope (a fleet handle, a Task, repositories, notes), and the reader

> [!headless]
> - The kind and the scope from the caller. At the close of a fleet: `fleet` and the handle of the fleet.
> - (Optional) The title, extra repositories, notes, and media folders

# Actions

## Stage 1: Scope

- Choose the kind ([[dev-knw-brf-kinds]]): `fleet` for the result of a fleet, `status` for where a program stands, `architecture` for how a system is built, `explainer` for one concept.
- Find the scope: the fleet handle (`flint orbh fleet list`), the Task, the repositories and the time window, the Mesh notes, the media folders.
- Name the Brief: a title of at most 90 characters, in the words of the person.
- When the request is clear, state the kind, the scope, and the title in one line and go on. When it is not clear (two kinds fit, or the scope is unknown), ask the person one question.
- Once the kind, the scope, and the title are known, progress to the next stage.

> [!headless]
> A headless session does not do this stage: no person is there to ask. The caller gives the kind and the scope (see `# Input`). Go to Stage 2.

## Stage 2: Collect

- Run [[dev-sk-brf-collect]].
- Check the coverage (commits, notes, media). Run collect again with `--repo`, `--note`, or `--media` when a source is missing.
- Once `facts.json` covers the scope, progress to the next stage.

> [!headless]
> - `flint orbh session set phase brief-collect`
> - Run [[dev-sk-brf-collect]]. For a fleet: `flint shard brf collect --kind fleet --fleet <handle>`, plus `--media` for each evidence folder of the fleet outside `Media/Fleets/<handle>/`.
> - When collect fails, set `flint orbh session set blockers "brief: collect failed: <reason>"` and stop the Brief. The fleet close goes on without it.
> - Once `facts.json` exists, progress to the next stage.

## Stage 3: Write

- Run [[dev-sk-brf-write]]. Read the sources, add the quoted facts, choose the screenshots, and fill the hero, the decisions, and the sections of the kind.
- Once `brief.json` has no TODO and `render` accepts it, progress to the next stage.

> [!headless]
> - `flint orbh session set phase brief-write`
> - Read the report of the fleet first: the Brief explains the report, and it must not disagree with it. When a fact disagrees with the report, say so in a claim with both facts.

## Stage 4: Render and Check

- Run [[dev-sk-brf-render]].
- Run [[dev-sk-brf-check]]: the script, then the visual inspection by a fresh agent. At most 2 rounds of repair.
- Once the check has no error, progress to the next stage.

> [!headless]
> - `flint orbh session set phase brief-check`
> - The visual inspection is by a fresh subagent. At most 2 rounds of repair.
> - When an error stays after 2 rounds, keep the page, and write each open error in the result and in the report of the fleet.
> - Once the check has no error (or 2 rounds are done), progress to the next stage. Then go to Stage 6.

## Stage 5: Review with the Person

- Give the person:
  - the path of the page (`Media/Briefs/(Brief) <date> <Title>.html`) and the command to open it (`open "<path>"`),
  - the bottom line and the number of decisions,
  - the strip "N claims · N observed · N inferred" and the warnings that stay,
  - what the visual inspection found, or that the browser checks did not run.
- The person reads the page. When they answer the decisions with "Copy the answers", act on the answers or record them where they belong (the Task, the Notepad).
- When the person asks for a change, change `brief.json`, render, and check again.
- Once the person accepts the Brief, progress to the next stage.

> [!headless]
> A headless session does not do this stage: no person reviews the Brief before it is committed. The check of Stage 4 is the review. Go to Stage 6.

## Stage 6: Register

- Link the page from the artifact that it explains: the Task log, the fleet report, or the turn of the Notepad. Use a relative Markdown link or the path in code.
- Commit the page and the linked notes with your own paths only:
  ```bash
  git add "Media/Briefs/(Brief) <date> <Title>.html" "<the linked note>"
  git commit -m "Brief: <Title> (<kind>)" -- "Media/Briefs/(Brief) <date> <Title>.html" "<the linked note>"
  ```
- Do not commit the work folder (`.flint/` is not in git). The page holds the spec and the facts.

> [!headless]
> - `flint orbh session set phase brief-link`
> - Add a line to the report of the fleet: `The Brief: [<Title>](<relative path to the page>)`.
> - Commit the page and the report with your own paths only, with the trailers of the fleet (`Orbh-Fleet: <handle>`, `Orbh-Session: <id>`).
> - `flint orbh session set progress "Brief: Media/Briefs/(Brief) <date> <Title>.html · <N> claims, <N> observed, <N> inferred · <errors or no error>"`
> - Return the path of the page to the caller:
>   - When the root of a fleet runs this workflow itself at the close-out, do not return the session. The root then runs `flint orbh fleet close "<outcome>" --report "<report path>"` as before.
>   - When a session was started only to make the Brief, end it with `flint orbh session return --finish "<result>"`, with the path of the page and the result of the check in the result.

# Output

- The page in `Media/Briefs/`, checked and accepted by the person
- A link to it from the Task, the report, or the Notepad
- A commit with the page

> [!headless]
> - The page in `Media/Briefs/`, checked, linked from the report, and committed
> - The path of the page and the result of the check in the session keys and in the return of the session
