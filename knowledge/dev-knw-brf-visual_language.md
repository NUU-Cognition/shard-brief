---
description: "The look of a Brief: NUU UI (the tokens, the fonts, the components, and the logo lockup of packages/ui), the full-width layout, the tones of a status, the type, and which visual to use for which content"
---

# Knowledge: The Visual Language of a Brief

A Brief looks like a page of a NUU app: it uses **NUU UI** (`Repos/main/packages/ui`) and the **full width** of the window. The renderer owns the look: an agent never writes CSS for a Brief. This file says what the look is, where it comes from, and which visual fits which content.

## Where the styles come from

Three assets copy the NUU design standard, so a Brief opens as one raw file with no build and no network.

| Asset | What it holds | Source |
|-------|---------------|--------|
| `ast-brf-fonts.css` | Inter (the body), Geist (the headings), and Geist Mono (code): the latin subsets as variable fonts, inside the page | The font files that `next/font/google` gives to the NUU apps |
| `ast-brf-tokens.css` | The neutral colours, the brand (`#3D6A9A`), the Four Elements, the extended palette, the radius scale, light and dark; the text scale and the ring of a card | `packages/ui/src/styles/draft.css` |
| `ast-brf-page.css` | The components, each rule with the name of the component that it copies | `packages/ui/src/components`: `card`, `badge`, `button`, `input`, `table`, `alert`, `tabs`, `popover`, `sonner`, `sidebar`, `breadcrumb`, `section-cards`, `heading`, `product-logo` |

The rules of NUU UI that a Brief keeps:

- **The page is white** (`--background`), with the text in `--foreground` and the secondary text in `--muted-foreground`. The sidebar is `--sidebar`. A card is white with a 1 px ring of the foreground at 10 % and a radius of 14 px. A popover has the same ring. There is no drop shadow, except under a toast (the shadow of `sonner`).
- **The logo is `ProductBrandNavbar`**: the NUU mark at 1.3 em in the text colour (never in a box), a gap of 0.9 em from the stroke, the mark 2 px higher, and "NUU Cognition" in Geist 500 at 16 px. The header is 56 px high, with a 24 px side padding and a border under it.
- **A badge** is 20 px high, with a radius of 8 px, a border, 12 px medium text, and the bg, the text, and the faint border of one element. An element badge has no dot.
- **A button** is the standard `button.tsx`: flat, with no rim and no drop shadow, 32 px high (28 px when small), a radius of 10 px, and 14 px medium text. The main action is the brand variant (`.btn`); the others are the outline variant (`.btn.outline`) or the ghost variant (`.btn.ghost`). In dark mode the brand button has dark text, because white text on the dark brand colour has a contrast of only 2.3:1.
- **Do not use Chisel.** `components/chisel` and `styles/chisel.css` are in NUU UI, but no NUU app uses them. Thus a Brief has no rim shadow, no platform shadow, and no off-white floor (`--back`).

When the standard changes, change these assets in the source of the shard, build the shard, and render each Brief again with `flint shard brf render --from "<page>"`. To get new font files, build a NUU app that uses `next/font/google` and take the latin files from its `.next/static/media`.

## The layout

- **Full width.** The page uses the whole window. On a screen of 1200 px or more, a sidebar of 16 rem on the left holds the sections and the strip "N claims · N observed · N inferred". On a smaller screen, a tab list of the sections stays under the header.
- **Grids fill the width.** Cards, decisions, groups, and galleries are grids that add columns as the window grows. Tables, timelines, and diagrams fill the width, and they scroll inside their frame on a phone; the page never scrolls sideways.
- **Prose stops at 72 characters.** A paragraph does not run across the full width; the grids do.
- **The hero.** The kind badge and the eyebrow, the title, the lede, and the as-of line on the left; the health card on the right; the stat cards under both. The stat cards fill whole rows: 2 columns on a phone, 3 on a medium screen, and one row for 5 or 6 stats on a wide screen.
- **The spacing** is in steps of 4 px: 64 px between sections, 24 px between blocks, 16 px between cards, 16 to 20 px inside a card.
- **Light and dark.** The page follows the system. The button in the top bar cycles auto, light, and dark; the browser keeps the choice for all Briefs.

## The tones

One element of the Four Elements for each meaning, on every Brief:

| Tone | Meaning |
|------|---------|
| earth (green) | landed, done, pass, fixed, observed |
| sun (amber) | at risk, partial, open, inferred |
| fire (red) | blocked, failed |
| water (blue, the brand) | information, agent at work, a step |
| storm (violet) | review |
| air (blue grey) | deferred |
| moon (grey) | skipped, not applicable, accepted |

Do not use a colour to mean something else. A stat gets a `tone` only when the number is good (earth) or bad (sun, fire) news; the tone shows as a dot before its label, and the number stays in the text colour.

## Type and text

The heading scale of `heading.tsx`: Geist at weight 400 with tight tracking. Weight 600 is only for the numbers of a stat or a diffstat.

| Role | Style |
|------|-------|
| The title (h1) | Geist 400, 36 px (30 px on a phone) |
| A section (h2) | Geist 400, 24 px; its summary is 14 px in the muted colour |
| A card or block title | Geist 500, 16 px |
| A stat | Geist 600, 24 to 30 px, tabular numbers |
| The lede and prose | Inter 16 px, line height 1.6 |
| Claims, cards, tables, and the other text | Inter 14 px |
| Labels (h5: "Health", "For you") | Inter 500, 12 px, upper case, wide tracking, muted |
| IDs, SHAs, paths, commands | Geist Mono, inline code |

## Which visual for which content

| Content | Visual | Block |
|---------|--------|-------|
| The verdict | The health card and the lede | hero |
| Numbers that matter | Stat cards | `stats` |
| Many lanes or areas at once | A board (rows by stages) | `board` |
| A list of things, each with a state | Cards with a status | `cards` |
| What changed | A changelog in groups, with the diffstat | `changes` |
| A change of a UI | Before and after screenshots | `compare` |
| The state of a UI | Screenshots, at most 12 | `gallery` |
| A behaviour of a UI over time | A short video (later; link it from a card for now) | — |
| A flow or a structure | A diagram of at most 9 nodes, with paths | `diagram` |
| Work over time | Swimlanes | `timeline` |
| A failure | Symptom, cause, tried, state | `failures` |
| A lesson | Went well, went wrong, got lucky | `retro` |
| A procedure | Numbered steps | `steps` |
| A way to check it yourself | Commands with copy buttons | `commands` |
| Detail that most readers skip | A part that opens | `details` |

Use a diagram only when it is clearer than a paragraph. Use a table only when the reader compares rows.

## Screenshots

- Choose the few that prove a claim: one for each lane or change, at most 12 in a gallery and at most 6 in "What changed".
- Prefer a pair before and after to two screenshots of the after state.
- The caption says what to see ("The share menu now lists the orgs"), not what the file is.
- Link to the image where it is. Never copy a screenshot into `Media/Briefs/`.
- Do not show a screenshot with a secret, a token, or personal data of a person outside the team.
