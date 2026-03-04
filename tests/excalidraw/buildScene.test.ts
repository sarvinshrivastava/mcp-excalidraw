import { describe, it, expect } from "vitest";
import { buildScene } from "../../src/excalidraw/buildScene.js";
import type { FlowGraph } from "../../src/flow/types.js";

const defaultLayout = {
  direction: "TB" as const,
  nodeWidth: 320,
  nodeHeight: 80,
  hGap: 120,
  vGap: 80,
  padding: 40,
};

const twoNodeGraph: FlowGraph = {
  nodes: [
    { id: "A", label: "Node A" },
    { id: "B", label: "Node B" },
  ],
  edges: [{ from: "A", to: "B" }],
};

const defaultOpts = {
  seed: 1,
  theme: "light" as const,
  layout: defaultLayout,
};

describe("buildScene — scene structure", () => {
  it("returns a scene object and a meta object", () => {
    const { scene, meta } = buildScene(twoNodeGraph, defaultOpts);
    expect(scene).toBeDefined();
    expect(meta).toBeDefined();
  });

  it("scene has type 'excalidraw'", () => {
    const { scene } = buildScene(twoNodeGraph, defaultOpts);
    expect(scene.type).toBe("excalidraw");
  });

  it("scene has version 2", () => {
    const { scene } = buildScene(twoNodeGraph, defaultOpts);
    expect(scene.version).toBe(2);
  });

  it("scene source is 'mcp-excaligen'", () => {
    const { scene } = buildScene(twoNodeGraph, defaultOpts);
    expect(scene.source).toBe("mcp-excaligen");
  });

  it("scene has an elements array", () => {
    const { scene } = buildScene(twoNodeGraph, defaultOpts);
    expect(Array.isArray(scene.elements)).toBe(true);
  });

  it("scene has appState and files fields", () => {
    const { scene } = buildScene(twoNodeGraph, defaultOpts);
    expect(scene.appState).toBeDefined();
    expect(scene.files).toBeDefined();
  });

  it("meta.nodes equals the number of nodes in the graph", () => {
    const { meta } = buildScene(twoNodeGraph, defaultOpts);
    expect(meta.nodes).toBe(2);
  });

  it("meta.edges equals the number of edges in the graph", () => {
    const { meta } = buildScene(twoNodeGraph, defaultOpts);
    expect(meta.edges).toBe(1);
  });
});

describe("buildScene — elements per graph component", () => {
  it("creates one rectangle element per node", () => {
    const { scene } = buildScene(twoNodeGraph, defaultOpts);
    const rects = scene.elements.filter((e) => e.type === "rectangle");
    expect(rects).toHaveLength(2);
  });

  it("creates one text element per node (for its label)", () => {
    const { scene } = buildScene(twoNodeGraph, defaultOpts);
    const texts = scene.elements.filter((e) => e.type === "text") as Array<{
      text: string;
      type: string;
    }>;
    const nodeLabels = twoNodeGraph.nodes.map((n) => n.label);
    nodeLabels.forEach((label) => {
      expect(texts.some((t) => t.text === label)).toBe(true);
    });
  });

  it("creates one arrow element per edge", () => {
    const { scene } = buildScene(twoNodeGraph, defaultOpts);
    const arrows = scene.elements.filter((e) => e.type === "arrow");
    expect(arrows).toHaveLength(1);
  });

  it("creates an edge-label text element when the edge has a label", () => {
    const graph: FlowGraph = {
      nodes: [
        { id: "P", label: "P" },
        { id: "Q", label: "Q" },
      ],
      edges: [{ from: "P", to: "Q", label: "on-click" }],
    };
    const { scene } = buildScene(graph, defaultOpts);
    const texts = scene.elements.filter((e) => e.type === "text") as Array<{
      text: string;
    }>;
    expect(texts.some((t) => t.text === "on-click")).toBe(true);
  });

  it("does NOT create an edge-label element when the edge has no label", () => {
    const { scene } = buildScene(twoNodeGraph, defaultOpts);
    // For a plain A→B edge there should be exactly 2 text elements (node labels)
    const texts = scene.elements.filter((e) => e.type === "text");
    expect(texts).toHaveLength(2);
  });

  it("produces no arrow elements when the graph has no edges", () => {
    const graph: FlowGraph = {
      nodes: [{ id: "Solo", label: "Solo" }],
      edges: [],
    };
    const { scene } = buildScene(graph, defaultOpts);
    const arrows = scene.elements.filter((e) => e.type === "arrow");
    expect(arrows).toHaveLength(0);
  });
});

describe("buildScene — theming", () => {
  it("light theme sets viewBackgroundColor to #ffffff", () => {
    const { scene } = buildScene(twoNodeGraph, {
      ...defaultOpts,
      theme: "light",
    });
    expect(scene.appState.viewBackgroundColor).toBe("#ffffff");
  });

  it("dark theme sets viewBackgroundColor to #0b1221", () => {
    const { scene } = buildScene(twoNodeGraph, {
      ...defaultOpts,
      theme: "dark",
    });
    expect(scene.appState.viewBackgroundColor).toBe("#0b1221");
  });

  it("light theme rectangles use light stroke color", () => {
    const { scene } = buildScene(twoNodeGraph, {
      ...defaultOpts,
      theme: "light",
    });
    const rect = scene.elements.find((e) => e.type === "rectangle");
    expect(rect?.strokeColor).toBe("#1e1e1e");
  });

  it("dark theme rectangles use dark stroke color", () => {
    const { scene } = buildScene(twoNodeGraph, {
      ...defaultOpts,
      theme: "dark",
    });
    const rect = scene.elements.find((e) => e.type === "rectangle");
    expect(rect?.strokeColor).toBe("#e5e7eb");
  });
});

describe("buildScene — determinism", () => {
  it("produces identical scenes for the same inputs", () => {
    const { scene: s1 } = buildScene(twoNodeGraph, defaultOpts);
    const { scene: s2 } = buildScene(twoNodeGraph, defaultOpts);
    expect(JSON.stringify(s1)).toBe(JSON.stringify(s2));
  });

  it("produces different element IDs for different seeds", () => {
    const { scene: s1 } = buildScene(twoNodeGraph, { ...defaultOpts, seed: 1 });
    const { scene: s2 } = buildScene(twoNodeGraph, {
      ...defaultOpts,
      seed: 999,
    });
    const ids1 = s1.elements.map((e) => e.id).join(",");
    const ids2 = s2.elements.map((e) => e.id).join(",");
    expect(ids1).not.toBe(ids2);
  });
});

describe("buildScene — edge cases", () => {
  it("handles an empty graph (no nodes, no edges)", () => {
    const { scene, meta } = buildScene({ nodes: [], edges: [] }, defaultOpts);
    expect(scene.elements).toHaveLength(0);
    expect(meta.nodes).toBe(0);
    expect(meta.edges).toBe(0);
  });

  it("handles a graph with multiple edges including labelled ones", () => {
    const graph: FlowGraph = {
      nodes: [
        { id: "S", label: "Start" },
        { id: "M", label: "Middle" },
        { id: "E", label: "End" },
      ],
      edges: [
        { from: "S", to: "M", label: "step 1" },
        { from: "M", to: "E", label: "step 2" },
      ],
    };
    const { scene, meta } = buildScene(graph, defaultOpts);
    expect(meta.nodes).toBe(3);
    expect(meta.edges).toBe(2);
    const arrows = scene.elements.filter((e) => e.type === "arrow");
    expect(arrows).toHaveLength(2);
  });

  it("works with LR layout direction", () => {
    const lrLayout = { ...defaultLayout, direction: "LR" as const };
    const { scene, meta } = buildScene(twoNodeGraph, {
      ...defaultOpts,
      layout: lrLayout,
    });
    expect(meta.nodes).toBe(2);
    expect(scene.elements.length).toBeGreaterThan(0);
  });

  it("element ids are non-empty strings", () => {
    const { scene } = buildScene(twoNodeGraph, defaultOpts);
    scene.elements.forEach((el) => {
      expect(typeof el.id).toBe("string");
      expect(el.id.length).toBeGreaterThan(0);
    });
  });

  it("rectangle elements have correct width and height from layout config", () => {
    const { scene } = buildScene(twoNodeGraph, defaultOpts);
    const rects = scene.elements.filter((e) => e.type === "rectangle");
    rects.forEach((r) => {
      expect(r.width).toBe(defaultLayout.nodeWidth);
      expect(r.height).toBe(defaultLayout.nodeHeight);
    });
  });

  it("ignores edges whose nodes are not in the graph", () => {
    // Edge references a node that doesn't exist in the nodes list
    const graph: FlowGraph = {
      nodes: [{ id: "A", label: "A" }],
      edges: [{ from: "A", to: "ghost-node" }],
    };
    // buildScene should not crash; the missing node causes the edge to be skipped
    const { scene } = buildScene(graph, defaultOpts);
    const arrows = scene.elements.filter((e) => e.type === "arrow");
    expect(arrows).toHaveLength(0);
  });
});
