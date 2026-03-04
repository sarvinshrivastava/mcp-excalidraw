import fsSync from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import type { ExcalidrawScene } from "./schema.js";
import { ensureDir, repoRoot, toRelative } from "../util/paths.js";

export type ExportFormat = "excalidraw" | "svg" | "png";

export type ExportOptions = {
  scene: ExcalidrawScene;
  formats: ExportFormat[];
  outDir: string;
  baseName: string;
  png?: { scale?: number };
};

const serializeScene = (scene: ExcalidrawScene) =>
  JSON.stringify(scene, null, 2);

const excalidrawScriptPath = () =>
  path.resolve(
    repoRoot,
    "node_modules",
    "@excalidraw",
    "excalidraw",
    "dist",
    "excalidraw.production.min.js",
  );

const reactUmdPath = () =>
  path.resolve(repoRoot, "node_modules", "react", "umd", "react.production.min.js");

const reactDomUmdPath = () =>
  path.resolve(repoRoot, "node_modules", "react-dom", "umd", "react-dom.production.min.js");

const pageHtml = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { margin: 0; font-family: "Inter", "Helvetica Neue", Arial, sans-serif; }
    </style>
  </head>
  <body></body>
</html>
`;

const resolveExecutablePath = () => {
  const defaultPath = chromium.executablePath();
  const macOSDir = path.dirname(defaultPath);
  const revisionRoot = path.resolve(macOSDir, "..", "..", "..", "..");
  const cacheRoot = path.dirname(revisionRoot);
  const revisionTag = path.basename(revisionRoot).replace("chromium-", "");
  const headlessBase = `chromium_headless_shell-${revisionTag}`;
  const systemChromes = [
    "/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  const headlessCandidates = [
    path.join(
      cacheRoot,
      headlessBase,
      "chrome-headless-shell-mac-arm64",
      "chrome-headless-shell",
    ),
    path.join(
      cacheRoot,
      headlessBase,
      "chrome-headless-shell-mac-x64",
      "chrome-headless-shell",
    ),
  ];
  const candidates = [
    defaultPath,
    defaultPath.replace("mac-x64", "mac-arm64"),
    defaultPath.replace("mac-arm64", "mac-x64"),
    ...systemChromes,
    ...headlessCandidates,
  ];
  for (const candidate of candidates) {
    if (fsSync.existsSync(candidate)) return candidate;
  }
  return defaultPath;
};

export const exportSceneToFiles = async (
  options: ExportOptions,
): Promise<{ files: { format: ExportFormat; path: string }[] }> => {
  const absOut = path.resolve(repoRoot, options.outDir);
  await ensureDir(absOut);

  const results: { format: ExportFormat; path: string }[] = [];

  if (options.formats.includes("excalidraw")) {
    const scenePath = path.join(absOut, `${options.baseName}.excalidraw`);
    await fs.writeFile(scenePath, serializeScene(options.scene), "utf8");
    results.push({ format: "excalidraw", path: toRelative(scenePath) });
  }

  const needsBrowser = options.formats.some((f) => f === "svg" || f === "png");
  if (!needsBrowser) {
    return { files: results };
  }

  const executablePath = resolveExecutablePath();
  const userDataDir = path.join(absOut, ".playwright-profile");
  const homeDir = path.join(absOut, ".chromium-home");
  const crashpadDir = path.join(homeDir, "Library", "Application Support", "Google", "Chrome for Testing", "Crashpad");
  await Promise.all([ensureDir(userDataDir), ensureDir(crashpadDir)]);
  const context = await chromium
    .launchPersistentContext(userDataDir, {
      headless: true,
      executablePath,
      args: [
        "--headless=new",
        "--no-sandbox",
        "--disable-crash-reporter",
        "--disable-crashpad",
        "--disable-features=MachPortRendezvous,Crashpad",
      ],
      ignoreDefaultArgs: ["--enable-crashpad"],
      env: {
        ...process.env,
        HOME: homeDir,
        CRASH_REPORTER_DISABLE: "1",
        CRASHREPORTER_DISABLE: "1",
        CRASHPAD_HANDLER_PATH: "/dev/null",
        USE_CRASHPAD: "0",
      },
    })
    .catch((err) => {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`Playwright Chromium failed to launch: ${reason}`);
    });
  try {
    const page = await context.newPage();
    await page.setContent(pageHtml);

    await page.addScriptTag({ path: reactUmdPath() });
    await page.addScriptTag({ path: reactDomUmdPath() });
    await page.addScriptTag({ path: excalidrawScriptPath() });

    const baseScene = {
      ...options.scene,
      appState: { ...options.scene.appState, exportBackground: true },
    };

    if (options.formats.includes("svg")) {
      const svgContent = await page.evaluate(
        async ({ scene }) => {
          const lib = (globalThis as any).ExcalidrawLib;
          if (!lib) throw new Error("Excalidraw library not loaded");
          const svg = await lib.exportToSvg(scene);
          return new XMLSerializer().serializeToString(svg);
        },
        { scene: baseScene },
      );
      const svgPath = path.join(absOut, `${options.baseName}.svg`);
      await fs.writeFile(svgPath, svgContent, "utf8");
      results.push({ format: "svg", path: toRelative(svgPath) });
    }

    if (options.formats.includes("png")) {
      const scale = options.png?.scale ?? 2;
      const pngBytes = await page.evaluate(
        async ({ scene, scale }) => {
          const lib = (globalThis as any).ExcalidrawLib;
          if (!lib) throw new Error("Excalidraw library not loaded");
          const blob = await lib.exportToBlob(scene, { mimeType: "image/png", quality: 1, scale });
          const buffer = await blob.arrayBuffer();
          return Array.from(new Uint8Array(buffer));
        },
        { scene: baseScene, scale },
      );
      const pngPath = path.join(absOut, `${options.baseName}.png`);
      await fs.writeFile(pngPath, Buffer.from(pngBytes));
      results.push({ format: "png", path: toRelative(pngPath) });
    }
  } finally {
    await context.close();
  }

  return { files: results };
};
