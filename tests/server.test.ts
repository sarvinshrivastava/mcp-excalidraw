import { vi, describe, it, expect, afterEach } from "vitest";

// Mock the Playwright-dependent export module so tests don't need Chromium.
vi.mock("../src/excalidraw/export.js", () => ({
  exportSceneToFiles: vi.fn().mockResolvedValue({
    files: [{ format: "excalidraw", path: "out/diagram.excalidraw" }],
  }),
}));

// Import AFTER mock is declared (Vitest hoists vi.mock automatically).
const { generateSceneFromFlow, exportSceneFiles, generateAndExport, DEFAULT_LAYOUT } =
  await import("../src/server.js");
const { exportSceneToFiles } = await import("../src/excalidraw/export.js");

afterEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// DEFAULT_LAYOUT
// ─────────────────────────────────────────────

describe("DEFAULT_LAYOUT", () => {
  it("uses TB (top-to-bottom) direction", () => {
    expect(DEFAULT_LAYOUT.direction).toBe("TB");
  });

  it("has positive nodeWidth and nodeHeight", () => {
    expect(DEFAULT_LAYOUT.nodeWidth).toBeGreaterThan(0);
    expect(DEFAULT_LAYOUT.nodeHeight).toBeGreaterThan(0);
  });

  it("has non-negative gaps", () => {
    expect(DEFAULT_LAYOUT.hGap).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_LAYOUT.vGap).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_LAYOUT.padding).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────
// generateSceneFromFlow
// ─────────────────────────────────────────────

describe("generateSceneFromFlow", () => {
  it("returns a scene and meta for a simple DSL flow", () => {
    const { scene, meta } = generateSceneFromFlow({
      flow: "S1 -> S2",
      seed: 1,
      theme: "light",
      layout: DEFAULT_LAYOUT,
    });
    expect(scene).toBeDefined();
    expect(meta.nodes).toBe(2);
    expect(meta.edges).toBe(1);
  });

  it("returns correct node/edge counts for a multi-step flow", () => {
    const { meta } = generateSceneFromFlow({
      flow: "Step1 -> Step2\nStep2 -> Step3\nStep3 -> Step4",
      seed: 1,
      theme: "light",
      layout: DEFAULT_LAYOUT,
    });
    expect(meta.nodes).toBe(4);
    expect(meta.edges).toBe(3);
  });

  it("handles a JSON-formatted flow", () => {
    const json = JSON.stringify({
      nodes: [
        { id: "x", label: "X" },
        { id: "y", label: "Y" },
      ],
      edges: [{ from: "x", to: "y" }],
    });
    const { meta } = generateSceneFromFlow({
      flow: json,
      seed: 1,
      theme: "dark",
      layout: DEFAULT_LAYOUT,
    });
    expect(meta.nodes).toBe(2);
    expect(meta.edges).toBe(1);
  });

  it("produces a valid Excalidraw scene envelope", () => {
    const { scene } = generateSceneFromFlow({
      flow: "R1 -> R2",
      seed: 42,
      theme: "light",
      layout: DEFAULT_LAYOUT,
    });
    expect(scene.type).toBe("excalidraw");
    expect(scene.version).toBe(2);
    expect(Array.isArray(scene.elements)).toBe(true);
  });

  it("uses the dark theme when requested", () => {
    const { scene } = generateSceneFromFlow({
      flow: "D1 -> D2",
      seed: 1,
      theme: "dark",
      layout: DEFAULT_LAYOUT,
    });
    expect(scene.appState.viewBackgroundColor).toBe("#0b1221");
  });

  it("throws when given an empty flow string", () => {
    expect(() =>
      generateSceneFromFlow({
        flow: "",
        seed: 1,
        theme: "light",
        layout: DEFAULT_LAYOUT,
      }),
    ).toThrow();
  });

  it("throws when given an unparseable DSL line", () => {
    expect(() =>
      generateSceneFromFlow({
        flow: "not a valid flow line",
        seed: 1,
        theme: "light",
        layout: DEFAULT_LAYOUT,
      }),
    ).toThrow();
  });

  it("is deterministic for the same seed and flow", () => {
    const opts = { flow: "T1 -> T2", seed: 7, theme: "light" as const, layout: DEFAULT_LAYOUT };
    const { scene: s1 } = generateSceneFromFlow(opts);
    const { scene: s2 } = generateSceneFromFlow(opts);
    expect(JSON.stringify(s1)).toBe(JSON.stringify(s2));
  });
});

// ─────────────────────────────────────────────
// exportSceneFiles (delegates to exportSceneToFiles)
// ─────────────────────────────────────────────

describe("exportSceneFiles", () => {
  it("delegates to exportSceneToFiles with the provided options", async () => {
    const mockScene = { type: "excalidraw" } as any;
    await exportSceneFiles({
      scene: mockScene,
      formats: ["excalidraw"],
      outDir: "./out",
      baseName: "test",
    });
    expect(exportSceneToFiles).toHaveBeenCalledOnce();
    expect(exportSceneToFiles).toHaveBeenCalledWith({
      scene: mockScene,
      formats: ["excalidraw"],
      outDir: "./out",
      baseName: "test",
    });
  });

  it("passes optional png options through", async () => {
    const mockScene = { type: "excalidraw" } as any;
    await exportSceneFiles({
      scene: mockScene,
      formats: ["png"],
      outDir: "./out",
      baseName: "img",
      png: { scale: 3 },
    });
    expect(exportSceneToFiles).toHaveBeenCalledWith(
      expect.objectContaining({ png: { scale: 3 } }),
    );
  });

  it("returns the files array from the underlying exporter", async () => {
    const result = await exportSceneFiles({
      scene: {} as any,
      formats: ["excalidraw"],
      outDir: "./out",
      baseName: "d",
    });
    expect(result.files).toHaveLength(1);
    expect(result.files[0].format).toBe("excalidraw");
  });
});

// ─────────────────────────────────────────────
// generateAndExport
// ─────────────────────────────────────────────

describe("generateAndExport", () => {
  it("returns scenePath, files, and meta", async () => {
    const result = await generateAndExport({
      flow: "GA1 -> GA2",
      seed: 1,
      theme: "light",
      layout: DEFAULT_LAYOUT,
      outDir: "./out",
      baseName: "diagram",
      formats: ["excalidraw"],
    });
    expect(result.scenePath).toBe("out/diagram.excalidraw");
    expect(Array.isArray(result.files)).toBe(true);
    expect(result.meta.nodes).toBe(2);
    expect(result.meta.edges).toBe(1);
  });

  it("always includes 'excalidraw' format even when not requested", async () => {
    await generateAndExport({
      flow: "GA3 -> GA4",
      seed: 1,
      theme: "light",
      layout: DEFAULT_LAYOUT,
      outDir: "./out",
      baseName: "diagram",
      formats: ["svg"],
    });
    // exportSceneToFiles should have been called with formats including 'excalidraw'
    const callArg = (exportSceneToFiles as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.formats).toContain("excalidraw");
  });

  it("deduplicates formats (excalidraw requested + always-added)", async () => {
    await generateAndExport({
      flow: "GA5 -> GA6",
      seed: 1,
      theme: "light",
      layout: DEFAULT_LAYOUT,
      outDir: "./out",
      baseName: "diagram",
      formats: ["excalidraw", "excalidraw"],
    });
    const callArg = (exportSceneToFiles as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const excalidrawCount = callArg.formats.filter(
      (f: string) => f === "excalidraw",
    ).length;
    expect(excalidrawCount).toBe(1);
  });
});
