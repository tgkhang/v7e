# visualize

A self-learning tool that turns what you learn (algorithms, system design, app architecture, networking) into visual pages you can review later.

Each topic is a Markdown file in `content/<category>/<slug>/index.md`. Inside it you can use:

- **Mermaid** diagrams, for structure
- **`flow`** blocks: animated step-by-step diagrams where you watch a request move through an architecture and press Next/Play
- **`embed`** blocks: custom HTML visualizers, like the sort visualizer
- Tables, callouts (`> [!TIP]`), and `<details>` review cards

## Use

```bash
npm install
npm run dev                                   # open http://localhost:5173
npm run new -- networking/osi-model "OSI 7 layers"
npm run check                                 # validate all topics
npm run build                                 # static site in dist/
```

## Add a topic with an LLM

Give the LLM your notes and this repo. `CLAUDE.md` tells it how to pick blocks, write `flow` diagrams, keep your raw notes, and run `npm run check`. Claude Code reads it automatically. With another LLM, attach `CLAUDE.md`. Example prompt:

> Here are my notes on load balancers: … Create a topic page for them.
