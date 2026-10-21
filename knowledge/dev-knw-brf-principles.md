---
description: "The twelve rules of a Brief: the first screen is the answer, decisions first, every claim cites a fact, observed or inferred, the limits, and privacy"
---

# Knowledge: The Principles of a Brief

The rules that make a Brief explain and not only report. They come from the research of Notepad 233 (about 350 sources: visual-explainer, archify, the METR and Anthropic studies of agent work, the digests of Linear and Swarmia, the SRE retro) and from the 12 pages that agents made by hand in `Media/` before this shard.

## The twelve rules

| # | Rule | Why | What enforces it |
|---|------|-----|------------------|
| 1 | **The first screen is the answer.** The title, a lede of at most 3 sentences, one health label, 3 to 6 stats, and the number of decisions. | A person reads the first screen and often stops there. | The hero of the renderer; check: the title and the health are on the first screen; the lede has at most 3 sentences. |
| 2 | **Decisions come directly after the hero, one time only.** Each one has options and a recommendation; the page adds a note field for the person. "Copy the answers" gives the agent the reply. | Of the old pages, one put the decisions first, one in section 5, and one in section 25. One page showed them two times. | The renderer puts `decisions` after the hero. |
| 3 | **Every claim cites a fact.** A claim is `observed` (a record, a commit, a file, a screenshot shows it) or `inferred` (the agent concluded it). | Readers trust a citation even when it is random (Ding et al.); the citation must be real. Agents attribute steps badly (Zhang et al.: 14%). | Check: an observed claim with no fact is an error; the strip "N claims · N observed · N inferred". |
| 4 | **No number without a fact.** Each number in a claim, a stat, the lede, or a health label is in the facts that it cites. A name with digits (`S2b`, `A17`, `nuu-net01-1015`, `v0.2`, a sha, `Task 1274`) is not a number. | A summary of a long night changes numbers. | Check: the grounding of each number. |
| 5 | **Scripts collect the facts; the agent explains them.** A fact that the agent adds quotes its source word for word. | The data must not depend on the memory of a model. | collect writes `facts.json`; check finds each quote in its file. |
| 6 | **Three levels.** Level 1: the hero, the decisions, the board. Level 2: the sections. Level 3: the details that open and the evidence. | A person goes deeper only where it matters to them. | The `details` block; the evidence section. |
| 7 | **Show, then tell.** A screenshot before and after for a change of a UI; a timeline for a night; a board for many lanes; a diagram only when it is clearer than a paragraph (at most 9 nodes). | Text about a UI is weak evidence; a diagram with 20 nodes explains nothing. | The block types; the schema limits a diagram to 9 nodes. |
| 8 | **Say what failed.** "What failed" and "What this Brief did not check" are sections, not footnotes. The health is Landed, At risk, or Blocked; nothing else. | METR: 0 of 15 agent PRs were ready to merge; about 26 min of fixes each. A green page that hides the fixes costs the reader more. | The kinds; the `failures` and `retro` blocks; the three health states. |
| 9 | **Short.** A `fleet` Brief has at most 10 sections and about 3,000 words. Detail goes into a part that opens. | Network 0.1 had 9,100 words in 26 sections, and its open items were in section 25. | Check: the word count and the section limit. |
| 10 | **Plain words.** Write in the writing standard of the Flint (in this Flint: ASD-STE100). Use the names that the person uses. One idea in each sentence. | The reader is a person who was not there. | The skill `write`. |
| 11 | **One file that works offline.** No CDN script and no font service: the NUU fonts are inside the page. Images link to the evidence by a relative path. | The person opens the file from the Flint; a network may not be there. | The renderer; check: no external script, each path resolves, a render with no network. |
| 12 | **No secrets and no transcripts.** A Brief summarizes. It never copies a key, a token, a password, or the raw text of a transcript. | One old page (orb-crosstalk) held the full text of agent messages, and it went into a commit. | Check: the secret and transcript scan. |

## Observed or inferred

| Basis | Use it when | Example |
|-------|-------------|---------|
| `observed` | A record, a commit, a file, a test result, or a screenshot shows it directly. | "S2a Citations runs in production; QA before and after had 0 FAIL." (the Release Plan says it) |
| `inferred` | The agent concluded it from facts, or the facts do not show it fully. | "The Docs step stopped because the upload order was not safe." (the report suggests it; no log states the cause) |

When you are not sure, use `inferred`. An inferred claim still cites the facts that it comes from.

## Health

| State | Meaning |
|-------|---------|
| `landed` | The work did what its charter said, with proof. Open items can exist; none of them blocks the person. |
| `at-risk` | Part of the work landed, or it landed with a risk that the person must know about today. |
| `blocked` | The work stopped. The person must act before anything continues. |
| `info` | No verdict: an `architecture` or an `explainer` Brief. |

The label of the health says why, in one sentence, with a fact.

## What a Brief is not

- Not the report of the fleet. The report in the Mesh stays the full record. The Brief explains it and links to it.
- Not a dashboard. A Brief is a snapshot at one time (`asOf`). Make a new Brief, or render again, when the facts change.
- Not a place for new decisions of the agent. A Brief shows decisions that wait for the person; the agent does not make them in the Brief.
