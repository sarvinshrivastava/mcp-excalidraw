import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { repoRoot, toRelative, ensureDir } from "../../src/util/paths.js";

describe("repoRoot", () => {
  it("is a non-empty string", () => {
    expect(typeof repoRoot).toBe("string");
    expect(repoRoot.length).toBeGreaterThan(0);
  });

  it("points to the directory that contains package.json", () => {
    const pkgJson = path.join(repoRoot, "package.json");
    expect(fs.existsSync(pkgJson)).toBe(true);
  });

  it("is an absolute path", () => {
    expect(path.isAbsolute(repoRoot)).toBe(true);
  });
});

describe("toRelative", () => {
  it("converts an absolute path to a path relative to repoRoot", () => {
    const abs = path.join(repoRoot, "src", "server.ts");
    const rel = toRelative(abs);
    expect(rel).toBe(path.join("src", "server.ts"));
  });

  it("returns an empty string for repoRoot itself", () => {
    expect(toRelative(repoRoot)).toBe("");
  });

  it("handles nested paths", () => {
    const abs = path.join(repoRoot, "src", "flow", "parse.ts");
    const rel = toRelative(abs);
    expect(rel).toBe(path.join("src", "flow", "parse.ts"));
  });

  it("does not include a leading separator", () => {
    const abs = path.join(repoRoot, "package.json");
    const rel = toRelative(abs);
    expect(rel).not.toMatch(/^[/\\]/);
  });
});

describe("ensureDir", () => {
  it("creates a directory that does not yet exist", async () => {
    const dir = path.join(os.tmpdir(), `mcp-test-ensure-${Date.now()}`);
    try {
      await ensureDir(dir);
      expect(fs.existsSync(dir)).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not throw when the directory already exists", async () => {
    const dir = path.join(os.tmpdir(), `mcp-test-exists-${Date.now()}`);
    fs.mkdirSync(dir, { recursive: true });
    try {
      await expect(ensureDir(dir)).resolves.not.toThrow();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("creates nested directories recursively", async () => {
    const dir = path.join(os.tmpdir(), `mcp-test-nested-${Date.now()}`, "a", "b", "c");
    try {
      await ensureDir(dir);
      expect(fs.existsSync(dir)).toBe(true);
    } finally {
      fs.rmSync(path.dirname(path.dirname(path.dirname(dir))), {
        recursive: true,
        force: true,
      });
    }
  });

  it("returns the directory path", async () => {
    const dir = path.join(os.tmpdir(), `mcp-test-ret-${Date.now()}`);
    try {
      const result = await ensureDir(dir);
      expect(result).toBe(dir);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
