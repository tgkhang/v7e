# Visualize — authoring guide for LLMs

This repo is a personal learning library. Each topic is a folder under `content/<category>/<slug>/` with an `index.md` that the app (Vite + React) renders as a visual page. Your usual job: **the user gives you notes (text, a .md file, an image, an HTML visualizer) and you turn them into a topic page.**

## Workflow when the user hands you notes

1. Pick a category (existing ones first: `ls content`) and a kebab-case slug, e.g. `networking/osi-model`, `system-design/load-balancer`.
2. Create the folder. Save the user's raw notes verbatim as `notes.md` (or move their file there) and set `source: notes.md` in frontmatter. Never delete their original content.
3. Write `index.md` (start from `templates/topic.md`, or run `npm run new -- category/slug "Title"`).
4. For each concept, choose the block that fits (table below). Aim for at least one **flow** for anything with requests, packets, or state changing over time.
5. Fact-check the notes. Keep the user's meaning, but when the notes are wrong or outdated, add a `> [!IMPORTANT]` callout with the correction. Don't silently rewrite it. Finish half-written sentences, and say so.
6. End with a `## Review` section: 4–6 `<details>` Q&A cards.
7. Run `npm run check` and fix every error. Then `npm run dev` to view it.

Write everything in English, even when the notes are in another language (keep the raw notes as they are in `notes.md`).

## Which block for what

| Content | Block |
|---|---|
| Static structure, hierarchy, relationships, sequence of messages | ```` ```mermaid ```` (flowchart, sequenceDiagram, classDiagram, stateDiagram, erDiagram, …) |
| Something that **happens over time**: a request through an architecture, packets down the OSI stack, a load balancer picking servers, a cache hit/miss | ```` ```flow ```` (animated, step-by-step; spec below) |
| An algorithm with per-step data state (arrays, pointers, trees) | Standalone `visualizer.html` in the topic folder + ```` ```embed ```` |
| Comparisons | GFM table |
| Corrections, gotchas, rules of thumb | `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]` |
| Config / commands | fenced code with a language |
| Images | put the file in the topic folder, `![alt](diagram.png)` |

## Frontmatter

```yaml
---
title: Load Balancer          # required
summary: One sentence.        # shown on cards and under the title
tags: [networking, l4, l7]
created: 2026-11-11
source: notes.md              # raw notes in the same folder
order: 10                     # sort order within the category (default 100)
---
```

## `flow` block spec (YAML)

```yaml
title: Shown above the diagram
hidden: [n4]                     # nodes invisible at the start (reveal later with `show`)
nodes:                           # placed on a grid: one col ≈ 180px, one row ≈ 96px; fractions allowed
  - { id: c1, label: Client, sub: optional 2nd line, kind: client, col: 0, row: 0 }
  - { id: lb, label: Load balancer, kind: lb, col: 1.5, row: 0, w: 1 }   # w = width in columns
groups:                          # dashed box drawn around nodes (process, VPC, layer…)
  - { label: Server pool, nodes: [s1, s2] }
edges:                           # "a -> b" or { from, to, label, dashed: true }
  - c1 -> lb
  - { from: lb, to: s1, label: round robin }
steps:                           # each step = one click of Next
  - title: Short heading
    text: >-
      One or two sentences explaining what happens and why.
    flow: [c1 -> lb, lb -> s1]   # a packet animates along these hops, in order (reverse of an edge is fine; undefined hops draw dashed)
    active: [s1]                 # extra highlight, this step only
    state: { s1: busy }          # CARRIES OVER to later steps; set `normal` or ~ to clear
    labels: { s1: handling req 1 }  # replaces `sub`, carries over; ~ to clear
    show: [n4]                   # carries over
    hide: [c1]                   # carries over
```

- `kind`: `box` (default), `client`, `server`, `process`, `thread`, `socket`, `lb`, `db`, `cache`, `queue`, `layer`, `note`. Kind does not change the look (except `note`, drawn dashed), but say what the node is.
- `state`: `idle` (green, free), `busy` (orange, working), `wait` (purple, queued), `held` (red, occupied but doing nothing), `error`, `done` (faded), `off` (faded). A legend under the diagram explains the colours that are used.
- Keep the UI simple: one idea per step, short plain sentences in `text`. The step text is shown above the picture.
- YAML gotchas: quote any string containing `: `, a leading `:`, `#`, or, inside `{ }` flow maps, a comma (`labels: { a: "x, y" }`).
- Layout: put the flow left→right (clients col 0, then middle tiers, then backends). Keep 1–2 words per label, and 4–12 nodes and 4–9 steps per diagram. Several small flows beat one huge one.
- Good reference: `content/system-design/apache-mpm/index.md`.

## `embed` block

```yaml
src: visualizer.html   # file in the topic folder (or an https URL)
title: Optional caption
height: 900            # px, default 640
```

When writing a standalone visualizer HTML: self-contained (inline CSS/JS, no CDN needed), supports light and dark via `prefers-color-scheme`, has step/play controls. See `content/algorithms/sorting/visualizer.html`.

## Project layout

```
content/<category>/<slug>/index.md   topic page (rendered)
content/<category>/<slug>/notes.md   raw notes (linked as "Raw notes")
content/<category>/<slug>/*          images, HTML visualizers (served at /content/...)
templates/topic.md                   starting point for new topics
scripts/check.mjs                    npm run check: validates frontmatter, flow blocks, embeds, links
scripts/new-topic.mjs                npm run new -- category/slug "Title"
src/flow-spec.ts                     flow parser/validator (shared by app and check)
src/components/                      Markdown, Flow, Mermaid, Embed renderers
```
