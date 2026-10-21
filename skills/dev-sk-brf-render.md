---
description: "Render a Brief with the script render: brief.json and facts.json become one full-width page in Media/Briefs, or render a page again from the data inside it"
---

> [!important] THIS FILE IS AN INSTRUCTION. WHEN REFERENCED IT IS MEANT TO BE TAKEN AS AN ACTION.

Run `flint shard start brf` if you haven't already.

# Skill: Render

Make the page of a Brief from its spec. Never write or edit the HTML by hand.

# Input

- The path of `brief.json` (its `facts.json` is beside it, or at `factsFile`)
- Or the path of an existing page, to render it again (for example after the styles of the shard changed)

# Actions

1. **Render.**
   ```bash
   flint shard brf render ".flint/briefs/<id>/brief.json"
   ```
   The page goes to `Media/Briefs/(Brief) <date> <Title>.html`. `--out <path>` writes it elsewhere (for a test).
2. **Read the result.**
   - `ok: false` with `spec-invalid`: the reason lists each problem with its place (`$.sections[2].blocks[0]<cards>.items[1]: needs "title"`). Fix `brief.json` and render again.
   - `warnings`: an image that does not exist, an unknown fact id, a diagram edge or path that names a missing node. Fix each one.
3. **Render a page again from its data.**
   ```bash
   flint shard brf render --from "Media/Briefs/(Brief) <date> <Title>.html"
   ```
   It reads the spec and the facts inside the page and writes the same file with the current styles of the shard. To edit the spec of a page on a machine with no work folder, extract it first:
   ```bash
   flint shard brf render --from "Media/Briefs/(Brief) <date> <Title>.html" --extract ".flint/briefs/<id>"
   ```
   Then edit `brief.json` there and render it.
4. When the title or the date changes, the file name changes. Delete the old page file (a page is not a Mesh artifact, so `flint helper delete` does not apply), and change each link to it.

# Output

- The page in `Media/Briefs/`
- The JSON of render: the file, its size, the facts cited, the claims, the words, and the warnings
