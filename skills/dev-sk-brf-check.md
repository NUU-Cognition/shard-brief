---
description: "Check a Brief: the script check (schema, facts, grounding, quotes, paths, limits, privacy, and a headless render at 1280 and 390 px), then a visual inspection by a fresh agent, with at most 2 rounds of repair"
---

> [!important] THIS FILE IS AN INSTRUCTION. WHEN REFERENCED IT IS MEANT TO BE TAKEN AS AN ACTION.

Run `flint shard start brf` if you haven't already.

# Skill: Check

Make sure that a Brief is true, complete, and readable before a person reads it. A self-check in prose finds about one defect in three; this skill uses a script and a fresh pair of eyes.

# Input

- The path of the page in `Media/Briefs/`
- Its work folder (`.flint/briefs/<id>/`)

# Actions

1. **Run the script.**
   ```bash
   flint shard brf check "Media/Briefs/(Brief) <date> <Title>.html"
   ```
   It writes `check.json` and the screenshots `shots/first-1280.png`, `shots/full-1280.png`, `shots/first-1280-dark.png`, `shots/first-390.png`, and `shots/full-390.png` into the work folder.
2. **Fix each error.** An error stops the Brief. The common errors:

   | Error | Fix |
   |-------|-----|
   | `TODO placeholders` | Fill or remove each TODO in `brief.json`. |
   | `cites the fact "x", which does not exist` | Correct the id, or add the fact with its source. |
   | `the observed claim … cites no fact` | Cite the fact, or mark the claim `inferred`. |
   | `a fleet Brief needs a verdict` | Set the health to `landed`, `at-risk`, or `blocked`. |
   | `the recommendation … is not one of its options` | Copy the option word for word into `recommend`. |
   | `the quote is not in <path>` | Copy the words exactly from the note. |
   | `the image path … does not exist` | Correct the path (relative to the Flint root). |
   | `the lede has N sentences` | Say the bottom line in at most 3. |
   | `the page scrolls sideways` | A long word or path in a text: put it in `code`, or shorten it. Tell the owner of the shard when a block is the cause. |
   | `the page contains a secret value` / `a message of a transcript` | Remove it from the spec or the facts. |

3. **Read each warning.** A warning does not stop the Brief, but each one needs a decision:
   - `the number N is not in its facts`: the warning gives the place and the start of the text. Add the fact that states the number, cite it, or remove the number. The check already skips names with digits (`S2b`, `A17`, `v0.2`, a handle, a sha, `Task 1274`).
   - `the lede has numbers and no ledeEvidence`: cite the facts of the lede in `ledeEvidence`.
   - `the Brief has N words`: move detail into `details`, or cut it.
   - `the browser checks did not run: …`: the field `browser` of the output says why (no Chrome, Chrome did not start, `--no-browser`). The static checks still ran. Say so in the result, and ask the person to run the check on a machine where Chrome starts, or set `BRIEF_CHROME`. Without the screenshots, skip step 5 and say that the visual inspection did not run.
4. **Render and check again** until there is no error.
5. **The visual inspection.** Start a fresh agent (a subagent with no context of the work). Give it the five screenshots and the kind, and ask for a verdict on each point:
   - The first screen gives the answer: the title, the lede, the health, and the number of decisions are visible at 1280 px without a scroll.
   - Nothing overlaps, nothing is cut, and no text is too small to read; at 390 px nothing runs off the screen.
   - The dark mode is readable.
   - Each image shows what its caption says.
   - The page looks like one design (the NUU Cognition styles), not like a set of parts.
   - The most important problem, if any, in one sentence.
   Fix what the agent finds in `brief.json`, render, and check again. Do at most 2 rounds of repair. When a problem stays after 2 rounds, or when the cause is in the renderer, write it in the result.
6. **Report the result.** Give the path of the page, the strip "N claims · N observed · N inferred", the facts cited, the warnings that stay, and the verdict of the visual inspection.

# Output

- A page with no error in `check.json`
- The screenshots and the verdict of the visual inspection
- A list of what stays open, if anything
