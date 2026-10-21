---
description: "Write the spec of a Brief (brief.json): read the facts and the notes, add quoted facts, and fill the hero, the decisions, and the sections of the kind"
---

> [!important] THIS FILE IS AN INSTRUCTION. WHEN REFERENCED IT IS MEANT TO BE TAKEN AS AN ACTION.

Run `flint shard start brf` if you haven't already.

# Skill: Write

Fill `brief.json` so that the page explains the work. You write data, not HTML: the script `render` makes the page.

# Input

- The work folder with `facts.json` and the starter `brief.json` ([[dev-sk-brf-collect]])
- The kind and its sections ([[dev-knw-brf-kinds]]), the blocks ([[dev-knw-brf-blocks]]), and the rules ([[dev-knw-brf-principles]])

# Actions

1. **Read the sources.** Read `facts.json`. Then read the notes in the order of [[dev-knw-brf-sources]] § Read more than collect gives. For a fleet: the report first, then the release or publish notes, the lane reports, and QA. Note each sentence that you will depend on.
   - A long note (a lane report can have 10,000 words): read its summary, its final state, its open items, and its result table first. Read the body only for a claim that needs it.
   - `derived.notes` gives the headings of each note; use them to go to the right part.
2. **Add the facts that you need.** For each sentence of a note that a claim depends on, add a fact to `brief.json#facts` with `source.type: "mesh"`, the `path`, and a `quote` copied word for word (one sentence, or a part of one; at most 600 characters). Give each fact an id with a prefix (`report:`, `rel:`, `qa:`, `ops:`). Do not add a fact that collect already has.
3. **Choose the screenshots.** `derived.media` lists each image of each folder. Open a candidate image to see it. Choose the few that prove a claim ([[dev-knw-brf-visual_language]] § Screenshots). Prefer a pair before and after. Set `env` (`dev`, `prod`) on each image. The renderer adds a fact for each image, so a figure needs no other fact unless its caption claims more.
4. **Write the hero.**
   - `lede`: the answer in at most 3 sentences. Start with the result, not with the method. Cite the facts of its numbers in `ledeEvidence`.
   - `health`: `landed`, `at-risk`, or `blocked`, and a label of one sentence with its fact.
   - `stats`: 4 to 6 numbers that matter to the reader, each with its fact. Copy each number exactly as the fact has it.
   - `eyebrow`, `asOf`: keep what collect wrote; correct the time and the commit when a later fact exists.
5. **Write the decisions.** Each decision that waits for the person: a question as the `title`, why it matters in `why` (2 or 3 sentences, with a fact), 2 to 4 `options`, and your `recommend`. When nothing waits, remove the list.
6. **Fill each section of the kind.** Replace each TODO callout with the blocks that [[dev-knw-brf-kinds]] gives for that section. Rules:
   - Each claim cites one or more facts and has a basis. When you are not sure, use `inferred`.
   - Each number is in a fact that the claim cites. When the number is a sum or a difference, add the fact that states it, or write the parts. A name with digits (`S2b`, `A17`, `v0.2`, a handle, a sha) is not a number, so it needs no fact of its own.
   - Say what failed and what is not done, in their own sections.
   - Put the detail that most readers skip into `details` blocks or the `details` of a card.
   - Use the names that the work uses (the lane names, the step names such as `S2a`).
   - Write in the writing standard of the Flint (in this Flint: ASD-STE100 Simplified Technical English).
7. **Add `related`.** Link the report, the Task, and the notes that the reader opens next.
8. **Remove every TODO.** Then validate: `flint shard brf render "<work>/brief.json"` refuses a spec that does not match the schema, and lists each problem.

# Output

- A complete `brief.json` with no TODO, ready for [[dev-sk-brf-render]]
