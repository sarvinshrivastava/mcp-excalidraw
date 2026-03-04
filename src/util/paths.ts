import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fsp } from "node:fs";

const findRepoRoot = () => {
  let current = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i += 1) {
    const candidate = path.resolve(current, "package.json");
    if (fs.existsSync(candidate)) {
      return path.dirname(candidate);
    }
    current = path.resolve(current, "..");
  }
  return current;
};

export const repoRoot = findRepoRoot();

export const ensureDir = async (dir: string) => {
  await fsp.mkdir(dir, { recursive: true });
  return dir;
};

export const toRelative = (absPath: string) => path.relative(repoRoot, absPath);
