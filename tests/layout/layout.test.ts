import { describe, it, expect } from "vitest";
import { layoutGraph, type LayoutConfig } from "../../src/layout/layout.js";
import type { FlowGraph } from "../../src/flow/types.js";

const cfg: LayoutConfig = {
  direction: "TB",
  nodeWidth: 160,
  nodeHeight: 40,
  hGap: 60,
  vGap: 40,
  padding: 20,
};

describe("layoutGraph — node geometry", () => {
  it("attaches x, y, width, height, and center to every node", () => {
    const graph: FlowGraph = {
      nodes: [{ id: "A", label: "A" }],
      edges: [],
    };
    const { nodes } = layoutGraph(graph, cfg);
    const n = nodes[0];
    expect(n.x).toBeDefined();
    expect(n.y).toBeDefined();
    expect(n.width).toBe(cfg.nodeWidth);
    expect(n.height).toBe(cfg.nodeHeight);
    expect(n.center.x).toBe(n.x + n.width / 2);
    expect(n.center.y).toBe(n.y + n.height / 2);
  });

  it("respects the padding offset", () => {
    const graph: FlowGraph = {
      nodes: [{ id: "A", label: "A" }],
      edges: [],
    };
    const { nodes } = layoutGraph(graph, cfg);
    expect(nodes[0].x).toBeGreaterThanOrEqual(cfg.padding);
    expect(nodes[0].y).toBeGreaterThanOrEqual(cfg.padding);
  });

  it("passes through edges unchanged", () => {
    const edge = { from: "A", to: "B" };
    const graph: FlowGraph = {
      nodes: [
        { id: "A", label: "A" },
        { id: "B", label: "B" },
      ],
      edges: [edge],
    };
    const result = layoutGraph(graph, cfg);
    expect(result.edges).toEqual([edge]);
  });
});

describe("layoutGraph — TB (top-bottom) direction", () => {
  it("places a downstream node at a greater y than the upstream node", () => {
    const graph: FlowGraph = {
      nodes: [
        { id: "A", label: "A" },
        { id: "B", label: "B" },
      ],
      edges: [{ from: "A", to: "B" }],
    };
    const { nodes } = layoutGraph(graph, cfg);
    const a = nodes.find((n) => n.id === "A")!;
    const b = nodes.find((n) => n.id === "B")!;
    expect(b.y).toBeGreaterThan(a.y);
  });

  it("places sibling nodes at the same y but different x", () => {
    const graph: FlowGraph = {
      nodes: [
        { id: "root", label: "Root" },
        { id: "left", label: "Left" },
        { id: "right", label: "Right" },
      ],
      edges: [
        { from: "root", to: "left" },
        { from: "root", to: "right" },
      ],
    };
    const { nodes } = layoutGraph(graph, cfg);
    const l = nodes.find((n) => n.id === "left")!;
    const r = nodes.find((n) => n.id === "right")!;
    expect(l.y).toBe(r.y);
    expect(l.x).not.toBe(r.x);
  });

  it("handles a three-level chain with strictly increasing y", () => {
    const graph: FlowGraph = {
      nodes: [
        { id: "A", label: "A" },
        { id: "B", label: "B" },
        { id: "C", label: "C" },
      ],
      edges: [
        { from: "A", to: "B" },
        { from: "B", to: "C" },
      ],
    };
    const { nodes } = layoutGraph(graph, cfg);
    const a = nodes.find((n) => n.id === "A")!;
    const b = nodes.find((n) => n.id === "B")!;
    const c = nodes.find((n) => n.id === "C")!;
    expect(b.y).toBeGreaterThan(a.y);
    expect(c.y).toBeGreaterThan(b.y);
  });
});

describe("layoutGraph — LR (left-right) direction", () => {
  const lrCfg: LayoutConfig = { ...cfg, direction: "LR" };

  it("places a downstream node at a greater x than the upstream node", () => {
    const graph: FlowGraph = {
      nodes: [
        { id: "A", label: "A" },
        { id: "B", label: "B" },
      ],
      edges: [{ from: "A", to: "B" }],
    };
    const { nodes } = layoutGraph(graph, lrCfg);
    const a = nodes.find((n) => n.id === "A")!;
    const b = nodes.find((n) => n.id === "B")!;
    expect(b.x).toBeGreaterThan(a.x);
  });

  it("places sibling nodes at the same x but different y", () => {
    const graph: FlowGraph = {
      nodes: [
        { id: "root", label: "Root" },
        { id: "top", label: "Top" },
        { id: "bot", label: "Bot" },
      ],
      edges: [
        { from: "root", to: "top" },
        { from: "root", to: "bot" },
      ],
    };
    const { nodes } = layoutGraph(graph, lrCfg);
    const t = nodes.find((n) => n.id === "top")!;
    const b = nodes.find((n) => n.id === "bot")!;
    expect(t.x).toBe(b.x);
    expect(t.y).not.toBe(b.y);
  });
});

describe("layoutGraph — nodeSizer", () => {
  it("uses custom nodeSizer dimensions instead of config defaults", () => {
    const graph: FlowGraph = {
      nodes: [
        { id: "A", label: "A" },
        { id: "B", label: "B" },
      ],
      edges: [{ from: "A", to: "B" }],
    };
    const { nodes } = layoutGraph(graph, cfg, () => ({ width: 300, height: 80 }));
    nodes.forEach((n) => {
      expect(n.width).toBe(300);
      expect(n.height).toBe(80);
    });
  });

  it("nodeSizer overrides produce correct centers", () => {
    const graph: FlowGraph = {
      nodes: [{ id: "X", label: "X" }],
      edges: [],
    };
    const { nodes } = layoutGraph(graph, cfg, () => ({ width: 200, height: 100 }));
    expect(nodes[0].center.x).toBe(nodes[0].x + 100);
    expect(nodes[0].center.y).toBe(nodes[0].y + 50);
  });
});

describe("layoutGraph — barycenter alignment", () => {
  it("aligns a single child to its parent cross-axis position (LR)", () => {
    const lrCfg: LayoutConfig = { ...cfg, direction: "LR" };
    // root → top (row 0), root → bottom (row 1), bottom → child
    // child should be aligned with bottom, not top
    const graph: FlowGraph = {
      nodes: [
        { id: "root", label: "Root" },
        { id: "top", label: "Top" },
        { id: "bottom", label: "Bottom" },
        { id: "child", label: "Child" },
      ],
      edges: [
        { from: "root", to: "top" },
        { from: "root", to: "bottom" },
        { from: "bottom", to: "child" },
      ],
    };
    const { nodes } = layoutGraph(graph, lrCfg);
    const bottom = nodes.find((n) => n.id === "bottom")!;
    const child = nodes.find((n) => n.id === "child")!;
    expect(child.y).toBe(bottom.y);
  });
});

describe("layoutGraph — edge cases", () => {
  it("handles an empty graph", () => {
    const result = layoutGraph({ nodes: [], edges: [] }, cfg);
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it("handles a single isolated node", () => {
    const graph: FlowGraph = {
      nodes: [{ id: "solo", label: "Solo" }],
      edges: [],
    };
    const { nodes } = layoutGraph(graph, cfg);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe("solo");
  });

  it("handles two disconnected nodes (no edges)", () => {
    const graph: FlowGraph = {
      nodes: [
        { id: "X", label: "X" },
        { id: "Y", label: "Y" },
      ],
      edges: [],
    };
    const { nodes } = layoutGraph(graph, cfg);
    expect(nodes).toHaveLength(2);
  });

  it("handles a graph with a diamond shape", () => {
    // A → B, A → C, B → D, C → D
    const graph: FlowGraph = {
      nodes: [
        { id: "A", label: "A" },
        { id: "B", label: "B" },
        { id: "C", label: "C" },
        { id: "D", label: "D" },
      ],
      edges: [
        { from: "A", to: "B" },
        { from: "A", to: "C" },
        { from: "B", to: "D" },
        { from: "C", to: "D" },
      ],
    };
    const { nodes } = layoutGraph(graph, cfg);
    expect(nodes).toHaveLength(4);
    const a = nodes.find((n) => n.id === "A")!;
    const d = nodes.find((n) => n.id === "D")!;
    expect(d.y).toBeGreaterThan(a.y);
  });

  it("preserves node id and label in positioned output", () => {
    const graph: FlowGraph = {
      nodes: [{ id: "myId", label: "My Label" }],
      edges: [],
    };
    const { nodes } = layoutGraph(graph, cfg);
    expect(nodes[0].id).toBe("myId");
    expect(nodes[0].label).toBe("My Label");
  });

  it("positions all nodes in a graph containing a disconnected cycle", () => {
    // A->B is a normal chain (A has indegree 0, BFS starts there).
    // C->D->C is a pure cycle — both C and D have indegree > 0, so neither
    // appears in the initial BFS start queue. They end up in `remaining` and
    // are processed by the second pass in layoutGraph (lines 94-96).
    const graph: FlowGraph = {
      nodes: [
        { id: "A", label: "A" },
        { id: "B", label: "B" },
        { id: "C", label: "C" },
        { id: "D", label: "D" },
      ],
      edges: [
        { from: "A", to: "B" },
        { from: "C", to: "D" },
        { from: "D", to: "C" },
      ],
    };
    const { nodes } = layoutGraph(graph, cfg);
    expect(nodes).toHaveLength(4);
    // C and D must still be positioned even though they are in a cycle
    expect(nodes.find((n) => n.id === "C")).toBeDefined();
    expect(nodes.find((n) => n.id === "D")).toBeDefined();
    // The cycle nodes should appear below the main chain
    const b = nodes.find((n) => n.id === "B")!;
    const c = nodes.find((n) => n.id === "C")!;
    expect(c.y).toBeGreaterThan(b.y);
  });
});
