import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const loadFixtures = async () => {
  const dsl = await fs.readFile(path.join(root, "fixtures", "sample_dsl.txt"), "utf8");
  const json = await fs.readFile(path.join(root, "fixtures", "sample_json.json"), "utf8");
  return { dsl, json };
};

const loadServer = async () => {
  const url = pathToFileURL(path.join(root, "dist", "server.js")).href;
  return import(url);
};

const layout = {
  direction: "TB",
  nodeWidth: 320,
  nodeHeight: 80,
  hGap: 120,
  vGap: 80,
  padding: 40,
};

const runCase = async (name, flow, server) => {
  const baseName = `smoke-${name}`;
  const outDir = "./out";
  const { scene, meta } = server.generateSceneFromFlow({
    flow,
    seed: 1,
    theme: "light",
    layout,
  });
  if (!scene || !meta) throw new Error(`Failed to generate scene for ${name}`);
  const result = await server.generateAndExport({
    flow,
    seed: 2,
    theme: "light",
    layout,
    outDir,
    baseName,
    formats: ["excalidraw", "svg", "png"],
    png: { scale: 2 },
  });
  if (!result.files || result.files.length === 0) {
    throw new Error(`No files produced for ${name}`);
  }
  return result;
};

const main = async () => {
  try {
    const fixtures = await loadFixtures();
    const server = await loadServer();
    await runCase("dsl", fixtures.dsl, server);
    await runCase("json", fixtures.json, server);
    console.log("Smoke test succeeded.");
  } catch (err) {
    console.error("Smoke test failed:", err);
    process.exit(1);
  }
};

main();
