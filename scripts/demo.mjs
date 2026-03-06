/**
 * gen_architecture.mjs
 *
 * Generates a PNG diagram of the MCP Excalidraw service architecture
 * and saves it to the repo root as architecture.png.
 *
 * Usage:
 *   node scripts/gen_architecture.mjs
 *
 * Requires `npm run build` to have been run first.
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const distServerUrl = pathToFileURL(path.join(root, "dist", "server.js")).href;

// DSL describing how the MCP service works.
// Using JSON format for precise control over node IDs and layout.
const dsl = `
"User / Client" -> "MCP STDIO Server"
"MCP STDIO Server" -> "3 Tools: flow_to_scene / export_scene / generate_and_export" : exposes
"MCP STDIO Server" -> "parse.ts (DSL to FlowGraph)" : calls
"parse.ts (DSL to FlowGraph)" -> "layout.ts (Topological Sort + Positioning)"
"layout.ts (Topological Sort + Positioning)" -> "buildScene.ts (FlowGraph to Excalidraw Scene)"
"buildScene.ts (FlowGraph to Excalidraw Scene)" -> "export.ts (Playwright + Chromium)"
"export.ts (Playwright + Chromium)" -> "Output File (.excalidraw / .svg / .png)"
`.trim();

const layout = {
  direction: "LR",
  nodeWidth: 160,   // minimum — nodes expand to fit their label
  nodeHeight: 72,
  hGap: 64,
  vGap: 48,
  padding: 48,
  fitContent: true,
};

const style = {
  // Colors — clean blue palette
  canvasBackground: "#f8fafc",
  nodeFill:         "#e8f4fd",
  nodeBorder:       "#2563eb",
  nodeText:         "#1e293b",
  edgeColor:        "#64748b",
  edgeLabelColor:   "#475569",
  // Typography — Helvetica for a crisp architecture diagram
  fontFamily:        2,
  fontSize:         14,
  edgeLabelFontSize: 12,
  // Geometry — clean, no roughness
  strokeWidth:  1.5,
  roughness:    0,
  fillStyle:    "solid",
  cornerRadius: true,
};

const main = async () => {
  console.log("Importing compiled server module from dist/ ...");
  const server = await import(distServerUrl);

  console.log("Generating Excalidraw scene from architecture DSL ...");
  const { scene, meta } = server.generateSceneFromFlow({
    flow: dsl,
    seed: 42,
    theme: "light",
    layout,
    style,
  });
  console.log(`  Scene built: ${meta.nodes} nodes, ${meta.edges} edges`);

  // Export to a temp directory inside out/ so exportSceneToFiles can write there.
  const tmpOutDir = path.join(root, "out", "_arch_tmp");
  const baseName = "architecture";

  console.log("Exporting PNG via Playwright + Chromium ...");
  const { files } = await server.exportSceneFiles({
    scene,
    formats: ["png"],
    outDir: tmpOutDir,
    baseName,
    png: { scale: 2 },
  });

  const pngEntry = files.find((f) => f.format === "png");
  if (!pngEntry) {
    throw new Error("PNG export did not produce a file");
  }

  // exportSceneToFiles returns a relative path; resolve it from repo root.
  const srcPath = path.resolve(root, pngEntry.path);
  const destPath = path.join(root, "architecture.png");

  console.log(`Moving PNG from ${srcPath} to ${destPath} ...`);
  await fs.copyFile(srcPath, destPath);

  // Clean up the temp directory.
  await fs.rm(tmpOutDir, { recursive: true, force: true });

  console.log(`Done! Architecture diagram saved to: ${destPath}`);
};

main().catch((err) => {
  console.error("gen_architecture failed:", err);
  process.exit(1);
});
