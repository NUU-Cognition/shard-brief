# Brief

The Brief shard (`brf`) makes **Briefs**: explanatory HTML pages of technical work. A person opens a Brief as a raw file in a browser. It is full width, in the NUU Cognition styles, light and dark, and it works with no network.

```
collect  →  write  →  render  →  check
script      agent      script      script + a fresh agent
```

- **collect** reads the records of Orbh, the commits, the Mesh notes, and the media, and writes `facts.json`. Each fact has an id and a source.
- **write**: the agent fills `brief.json`, a typed spec (schema `brief/0.1`, 18 block types). Each claim cites facts and is observed or inferred.
- **render** makes `Media/Briefs/(Brief) <date> <Title>.html` from the spec. The page holds the spec and the facts, so it can be rendered again.
- **check** validates the schema, the facts, the grounding of each number, each quote, each path, the limits, and the privacy, and renders the page in headless Chrome at 1280 px and 390 px with no network.

Kinds in v0.1: `fleet`, `status`, `architecture`, `explainer`.

## Structure

```
Shards/(Source Local) Brief/
├── shard.yaml                 folders: Media/Briefs
├── dev-init-brf.md
├── workflows/  dev-wkfl-brf-brief.md
├── skills/     collect · write · render · check
├── knowledge/  principles · kinds · blocks · visual_language · sources
├── assets/     schema.json · tokens.css · page.css · page.js · lib.js
└── scripts/    dev-collect.js · dev-render.js · dev-check.js
```

## Use

```bash
flint shard start brf
flint shard brf collect --kind fleet --fleet <handle>
# fill .flint/briefs/<id>/brief.json
flint shard brf render ".flint/briefs/<id>/brief.json"
flint shard brf check "Media/Briefs/(Brief) <date> <Title>.html"
```

Edit the files of this source, then run `flint shard build brief`. The scripts need Node.js 22 or later; the browser checks need Google Chrome (or `BRIEF_CHROME`).

The design and the research are in Notepad 233 and Task 1277.
