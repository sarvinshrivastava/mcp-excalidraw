# mcp-excaligen — Agent Reference

## 1. What this service does

**Pipeline:** `flow input` → `parse` → `layout` → `buildScene` → `export`

1. **parse** — converts DSL text or JSON into a `FlowGraph` (nodes + edges)
2. **layout** — topological sort + grid positioning (TB or LR)
3. **buildScene** — maps the positioned graph to Excalidraw element JSON
4. **export** — renders the scene to `.excalidraw`, `.svg`, and/or `.png` via Playwright + Chromium

All scene IDs and positions are deterministic given the same `seed`.

---

## 2. DSL Syntax

```
Start -> "Enter OTP" -> Verify : submit -> Done
```

| Construct | Syntax | Notes |
|-----------|--------|-------|
| Bare node ID | `MyNode` | ID and label are the same |
| Quoted node label | `"My Node"` or `'My Node'` | Colons allowed inside quotes |
| Edge | `A -> B` | Arrow between two nodes |
| Edge label | `A -> B : label text` | Colon after to-node |
| Alias definition | `id = "Pretty Label"` | Sets label for a bare ID |
| Comment | `# ...` or `// ...` | Entire line ignored |
| Blank lines | | Ignored |
| JSON input | `{ "nodes": [...], "edges": [...] }` | Detected by leading `{` |

**Multi-line example:**

```
# MCP Server pipeline
server = "MCP STDIO Server"
server -> "3 Tools: flow/export/generate" : exposes
"3 Tools: flow/export/generate" -> output : produces
```

---

## 3. Tool: `flow_to_scene`

Converts a flow description into an Excalidraw scene JSON (no file I/O).

**Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `flow` | string | required | DSL text or JSON flow |
| `seed` | integer | `1` | Seed for deterministic layout |
| `theme` | `"light"` \| `"dark"` | `"light"` | Base colour palette |
| `layout` | object | see §6 | Layout configuration |
| `style` | object | `{}` | Visual style overrides (see §7) |

**Output:**

```json
{
  "scene": { "type": "excalidraw", "version": 2, "elements": [...], "appState": {...}, ... },
  "meta": { "nodes": 3, "edges": 2 }
}
```

---

## 4. Tool: `export_scene`

Exports a pre-built Excalidraw scene to disk. The scene already has styles baked into its elements — no `style` parameter here.

**Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `scene` | object | required | Excalidraw scene JSON from `flow_to_scene` |
| `formats` | array | `["excalidraw"]` | One or more of `"excalidraw"`, `"svg"`, `"png"` |
| `outDir` | string | `"./out"` | Output directory path |
| `baseName` | string | `"diagram"` | Base filename (without extension) |
| `png.scale` | number | `2` | PNG pixel density multiplier |

**Output:**

```json
{
  "files": [
    { "format": "excalidraw", "path": "out/diagram.excalidraw" },
    { "format": "svg", "path": "out/diagram.svg" }
  ]
}
```

---

## 5. Tool: `generate_and_export`

End-to-end: parse → layout → build → export. Combines `flow_to_scene` + `export_scene`.

**Parameters:** all `flow_to_scene` params (including `style`) plus:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `outDir` | string | `"./out"` | Output directory |
| `baseName` | string | `"diagram"` | Base filename |
| `formats` | array | `["excalidraw","svg","png"]` | Formats to produce |
| `png.scale` | number | `2` | PNG pixel density |

`"excalidraw"` format is always added automatically (needed for `scenePath`).

**Output:**

```json
{
  "scenePath": "out/diagram.excalidraw",
  "files": [...],
  "meta": { "nodes": 3, "edges": 2 }
}
```

---

## 6. Layout parameters

Passed as the `layout` object.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `direction` | `"TB"` \| `"LR"` | `"TB"` | Top-to-bottom or left-to-right |
| `nodeWidth` | number | `320` | Node rectangle width (px) |
| `nodeHeight` | number | `80` | Node rectangle height (px) |
| `hGap` | number | `120` | Horizontal gap between nodes (px) |
| `vGap` | number | `80` | Vertical gap between nodes (px) |
| `padding` | number | `40` | Canvas padding around the graph (px) |

---

## 7. Style parameters

Passed as the `style` object. All fields are optional; omitting `style` entirely is 100% backwards-compatible.

### Colors

| Field | Type | Light default | Dark default |
|-------|------|---------------|--------------|
| `nodeFill` | CSS color string | `#ffffff` | `#111827` |
| `nodeBorder` | CSS color string | `#1e1e1e` | `#e5e7eb` |
| `nodeText` | CSS color string | `#111827` | `#e5e7eb` |
| `edgeColor` | CSS color string | `#1e1e1e` | `#e5e7eb` |
| `edgeLabelColor` | CSS color string | `#111827` | `#e5e7eb` |
| `canvasBackground` | CSS color string | `#ffffff` | `#0b1221` |

### Typography

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `fontSize` | number | `18` | Node label font size (px) |
| `edgeLabelFontSize` | number | `14` | Edge label font size (px) |
| `fontFamily` | `1` \| `2` \| `3` | `1` | 1=Virgil (hand-drawn), 2=Helvetica, 3=Cascadia Code |

### Geometry

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `strokeWidth` | number | `2` | Border/line thickness (px) |
| `roughness` | number (0–2) | `0` | Sketch roughness (0=clean, 2=very rough) |
| `fillStyle` | `"solid"` \| `"hachure"` \| `"cross-hatch"` | `"solid"` | Node fill pattern |
| `cornerRadius` | `boolean` \| `number` | `true` (type 3) | `false`=sharp, `true`=rounded, `N`=custom radius |

---

## 8. What CAN be changed via parameters

- Node/edge colours (fill, border, text, arrow, label)
- Canvas background colour
- Font size (nodes and edge labels separately)
- Font family (Virgil / Helvetica / Cascadia Code)
- Stroke width and roughness
- Fill pattern (solid / hachure / cross-hatch)
- Corner radius style
- Layout direction (TB / LR)
- Node dimensions and gaps
- Seed (for reproducible randomness in element IDs)
- Theme (light / dark as a base palette)

---

## 9. What CANNOT be changed via parameters

- Per-node or per-edge style overrides (all nodes share one style)
- Dashed or dotted arrows (all arrows use solid stroke)
- Arrow head style
- Opacity per element
- Text alignment within nodes
- Z-order of elements
- Scene envelope fields (`type`, `version`, `source`, `files`)

---

## 10. Examples

### Minimal — two nodes, defaults

```
flow: "Start -> End"
```

### Dark theme with custom colours

```
flow: "Auth -> Session -> Dashboard"
theme: "dark"
style:
  nodeFill: "#1a2744"
  nodeBorder: "#4f8ef7"
  nodeText: "#e0eaff"
  canvasBackground: "#0d1b2e"
```

### Sketch / hand-drawn feel

```
flow: "Idea -> Draft -> Review -> Publish"
style:
  roughness: 2
  strokeWidth: 3
  fillStyle: "hachure"
  fontFamily: 1
```

### Clean Helvetica, left-to-right

```
flow: "Input -> Process -> Output"
layout:
  direction: "LR"
style:
  fontFamily: 2
  roughness: 0
  cornerRadius: false
```

### Large font, monospace labels

```
flow: "main() -> parse() -> render()"
style:
  fontSize: 22
  fontFamily: 3
  strokeWidth: 1
```

---

## 11. npm scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `npm run dev` | Hot-reload dev server (tsx) |
| `build` | `npm run build` | Compile TypeScript → `dist/` |
| `start` | `npm run start` | Run compiled server |
| `smoke` | `npm run smoke` | Build + smoke tests on `fixtures/` |
| `test` | `npm test` | Vitest unit test suite |
| `gen:arch` | `npm run gen:arch` | Regenerate `architecture.png` |
