# mcp-excaligen

MCP (Model Context Protocol) STDIO server that converts flow descriptions into Excalidraw scenes, exported as `.excalidraw`, `.svg`, or `.png`.

## Commands

```bash
npm run dev        # Run server in dev mode (tsx, hot reload)
npm run build      # Compile TypeScript to dist/ via tsup (ESM)
npm run start      # Run compiled STDIO server
npm run smoke      # Build + run smoke tests on fixtures/
```

### First-time setup
```bash
npm install
npx playwright install chromium   # Required for SVG/PNG export
```

## Architecture

```
src/
├── server.ts               # MCP server entry; registers 3 tools
├── flow/
│   ├── parse.ts            # DSL + JSON → FlowGraph
│   └── types.ts            # FlowNode, FlowEdge, FlowGraph types
├── layout/
│   ├── layout.ts           # Topological sort + TB/LR positioning
│   └── rng.ts              # Seeded RNG for deterministic layout
├── excalidraw/
│   ├── schema.ts           # Excalidraw element types
│   ├── ids.ts              # Numeric-seeded ID generation
│   ├── buildScene.ts       # FlowGraph → Excalidraw scene
│   └── export.ts           # Scene → file exports via Playwright
└── util/
    ├── errors.ts
    └── paths.ts
```

## MCP Tools

| Tool | Input | Output |
|------|-------|--------|
| `flow_to_scene` | DSL or JSON flow | Excalidraw scene JSON |
| `export_scene` | Scene JSON + format | Files in `out/` |
| `generate_and_export` | DSL/JSON + format | End-to-end pipeline |

## Key Details

- **Runtime**: Node ≥18.18.0, ES modules (`"type": "module"`)
- **Build**: `tsup` → ESM in `dist/`; `tsconfig.json` targets ES2021/NodeNext
- **Exports**: Playwright + Chromium for SVG/PNG rendering
- **Determinism**: Seeded RNG (`seed` param) ensures reproducible layouts
- **Themes**: `light` / `dark` via `buildScene.ts`
- **Layout directions**: `TB` (top-bottom) or `LR` (left-right)
- **Output dir**: `out/` (gitignored)

## DSL Syntax

```
Start -> "Enter OTP" -> Verify : submit -> Done
```

Arrows (`->`) define edges; quoted labels are node names; `: label` annotates edge.

## Docker

```bash
docker build -t mcp-excaligen .
docker run -it --rm -v "$(pwd)/out:/app/out" mcp-excaligen
```

Chromium + dependencies are baked into the image; browser cache at `/app/ms-playwright`.

## Validation

Input validation uses `zod`. Custom error types in `util/errors.ts`. Smoke tests in `scripts/smoke.mjs` against `fixtures/`.
