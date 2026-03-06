/**
 * netflix.mjs
 *
 * Generates a PNG diagram of a Netflix-style microservices architecture
 * and saves it to the repo root as netflix.png.
 *
 * Usage:
 *   node scripts/netflix.mjs
 *
 * Requires `npm run build` to have been run first.
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const distServerUrl = pathToFileURL(path.join(root, "dist", "server.js")).href;

// How Netflix works — simplified microservices flow.
const dsl = `
"Client (Web / Mobile / TV)" -> "Load Balancer (ELB)"
"Load Balancer (ELB)" -> "API Gateway (Zuul)"
"API Gateway (Zuul)" -> "Auth Service" : verify token
"API Gateway (Zuul)" -> "Profile Service"
"API Gateway (Zuul)" -> "Catalog Service"
"API Gateway (Zuul)" -> "Streaming Service"
"API Gateway (Zuul)" -> "Payment Service"
"Auth Service" -> "Cassandra (Identity)"
"Profile Service" -> "MySQL (Profiles)"
"Profile Service" -> "Kafka (Event Bus)"
"Catalog Service" -> "DynamoDB (Catalog)"
"Streaming Service" -> "S3 (Encoded Video)"
"Streaming Service" -> "CDN (Open Connect)"
"Payment Service" -> "Payment Gateway"
"Kafka (Event Bus)" -> "Spark ML (Recommendations)"
"Kafka (Event Bus)" -> "Druid (Analytics)"
`.trim();

const layout = {
  direction: "LR",
  nodeWidth: 180,
  nodeHeight: 56,
  hGap: 64,
  vGap: 20,
  padding: 48,
  fitContent: true,
};

const style = {
  // Netflix dark palette
  canvasBackground: "#141414",
  nodeFill:         "#1f1f1f",
  nodeBorder:       "#E50914",
  nodeText:         "#f5f5f1",
  edgeColor:        "#E50914",
  edgeLabelColor:   "#999999",
  // Typography
  fontFamily:        2,
  fontSize:         14,
  edgeLabelFontSize: 11,
  // Geometry — sharp, professional
  strokeWidth:  1.5,
  roughness:    0,
  fillStyle:    "solid",
  cornerRadius: true,
};

const main = async () => {
  console.log("Importing compiled server module from dist/ ...");
  const server = await import(distServerUrl);

  console.log("Generating Netflix architecture scene ...");
  const { scene, meta } = server.generateSceneFromFlow({
    flow: dsl,
    seed: 7,
    theme: "dark",
    layout,
    style,
  });
  console.log(`  Scene built: ${meta.nodes} nodes, ${meta.edges} edges`);

  const tmpOutDir = path.join(root, "out", "_netflix_tmp");
  const baseName  = "netflix";

  console.log("Exporting PNG via Playwright + Chromium ...");
  const { files } = await server.exportSceneFiles({
    scene,
    formats: ["png"],
    outDir:  tmpOutDir,
    baseName,
    png: { scale: 2 },
  });

  const pngEntry = files.find((f) => f.format === "png");
  if (!pngEntry) throw new Error("PNG export did not produce a file");

  const srcPath  = path.resolve(root, pngEntry.path);
  const destPath = path.join(root, "netflix.png");

  console.log(`Moving PNG → ${destPath} ...`);
  await fs.copyFile(srcPath, destPath);
  await fs.rm(tmpOutDir, { recursive: true, force: true });

  console.log(`Done! Netflix diagram saved to: ${destPath}`);
};

main().catch((err) => {
  console.error("netflix.mjs failed:", err);
  process.exit(1);
});
