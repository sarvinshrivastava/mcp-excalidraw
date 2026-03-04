## mcp-excaligen

MCP STDIO server that converts simple flow descriptions (DSL or JSON) into deterministic Excalidraw scenes and exports them as `.excalidraw`, `.svg`, and `.png`.

### Install
- `npm install`
- `npx playwright install chromium` (needed for SVG/PNG exports)

### Run
- Dev: `npm run dev`
- Build: `npm run build`
- Start (STDIO transport): `npm run start`
- Smoke check: `npm run smoke`

### MCP config
```
[mcp_servers.excaligen]
command = "node"
args = ["<ABS_PATH>/mcp-excaligen/dist/server.js"]
```

### Tools
- `flow_to_scene`
  - Input: `{ flow: string, seed?: number, theme?: "light"|"dark", layout?: { direction?: "TB"|"LR", nodeWidth?: number, nodeHeight?: number, hGap?: number, vGap?: number, padding?: number } }`
  - Output: `{ scene: { type: "excalidraw", version: 2, source: "mcp-excaligen", elements: [], appState: {}, files: {} }, meta: { nodes: number, edges: number } }`
- `export_scene`
  - Input: `{ scene: object, formats?: ("excalidraw"|"svg"|"png")[], outDir?: string, baseName?: string, png?: { scale?: number } }`
  - Output: `{ files: [{ format, path }] }`
- `generate_and_export`
  - Input: `{ flow: string, seed?: number, theme?: "light"|"dark", layout?: Layout, outDir?: string, baseName?: string, formats?: ("excalidraw"|"svg"|"png")[], png?: { scale?: number } }`
  - Output: `{ scenePath: string, files: [{ format, path }], meta: { nodes, edges } }`

### Example tool calls
- `flow_to_scene` request:
```json
{
  "name": "flow_to_scene",
  "arguments": {
    "flow": "Start -> Review : next\nReview -> Done",
    "seed": 7
  }
}
```
Response (content): `{"scene": {...}, "meta":{"nodes":3,"edges":2}}`

- `export_scene` request:
```json
{
  "name": "export_scene",
  "arguments": {
    "scene": { "type": "excalidraw", "version": 2, "source": "mcp-excaligen", "elements": [], "appState": {}, "files": {} },
    "formats": ["excalidraw","svg"],
    "outDir": "./out",
    "baseName": "diagram"
  }
}
```
Response (content): `{"files":[{"format":"excalidraw","path":"out/diagram.excalidraw"},{"format":"svg","path":"out/diagram.svg"}]}`

- `generate_and_export` request:
```json
{
  "name": "generate_and_export",
  "arguments": {
    "flow": "A -> B\nB -> C : next",
    "outDir": "./out",
    "baseName": "sample",
    "formats": ["excalidraw","svg","png"],
    "png": { "scale": 2 }
  }
}
```
Response (content): `{"scenePath":"out/sample.excalidraw","files":[...],"meta":{"nodes":3,"edges":2}}`

### Examples
**DSL**
```
Start -> "Enter OTP"
"Enter OTP" -> Verify : submit
Verify -> Done
Done = "Completed"
```

**JSON**
```
{
  "nodes":[{"id":"A","label":"Start"}],
  "edges":[{"from":"A","to":"B","label":"next"}]
}
```

### Notes
- Deterministic: IDs and layout come from the provided seed.
- Theme: set `theme` to `dark` or `light` (defaults to light).
- Outputs are written under the chosen `outDir` (default `./out`) and tool responses return paths relative to the repo root.
- PNG text rendering depends on available fonts; a default sans font is requested in the headless browser.
- If Chromium cannot launch (e.g., `MachPortRendezvous` or crashpad permission errors), rerun `npx playwright install chromium` and ensure the browser cache is writable; some macOS sandboxes may require running outside restrictive environments. The exporter now prefers the full “Chrome for Testing” binary before the headless shell to avoid crashpad/launch issues.

### Container (optional)
- Build: `docker build -t mcp-excaligen .`
- Run: `docker run -it --rm mcp-excaligen`
- Persist exports: `docker run -it --rm -v "$(pwd)/out:/app/out" mcp-excaligen`
See `docs/CONTAINER.md` for details.
