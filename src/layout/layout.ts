import type { FlowEdge, FlowGraph, FlowNode } from "../flow/types.js";

export type LayoutDirection = "TB" | "LR";

export type LayoutConfig = {
  direction: LayoutDirection;
  nodeWidth: number;
  nodeHeight: number;
  hGap: number;
  vGap: number;
  padding: number;
};

export type PositionedNode = FlowNode & {
  x: number;
  y: number;
  width: number;
  height: number;
  center: { x: number; y: number };
};

export type LayoutResult = {
  nodes: PositionedNode[];
  edges: FlowEdge[];
};

const sortLex = (values: string[]) => [...values].sort((a, b) => a.localeCompare(b));

export const layoutGraph = (
  graph: FlowGraph,
  config: LayoutConfig,
): LayoutResult => {
  const indegree = new Map<string, number>();
  const adjacency = new Map<string, Set<string>>();

  graph.nodes.forEach((node) => {
    indegree.set(node.id, 0);
    adjacency.set(node.id, new Set());
  });

  graph.edges.forEach((edge) => {
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
    adjacency.get(edge.from)?.add(edge.to);
  });

  const starts = graph.nodes
    .filter((node) => (indegree.get(node.id) ?? 0) === 0)
    .map((n) => n.id);
  const startQueue = starts.length > 0 ? sortLex(starts) : sortLex(graph.nodes.map((n) => n.id));

  const visited = new Set<string>();
  const depth = new Map<string, number>();
  const order: string[] = [];
  let maxDepth = 0;

  const enqueueNeighbors = (id: string, currentDepth: number) => {
    const neighbors = adjacency.get(id);
    if (!neighbors) return [];
    const nextDepth = currentDepth + 1;
    const items = sortLex([...neighbors]).filter((n) => !visited.has(n));
    items.forEach((n) => {
      const existing = depth.get(n);
      if (existing === undefined || nextDepth < existing) {
        depth.set(n, nextDepth);
      }
    });
    return items;
  };

  const processQueue = (queue: string[], initialDepth: number) => {
    queue.forEach((id) => {
      if (!depth.has(id)) depth.set(id, initialDepth);
    });
    while (queue.length > 0) {
      const current = queue.shift() as string;
      if (visited.has(current)) continue;
      visited.add(current);
      const currentDepth = depth.get(current) ?? initialDepth;
      maxDepth = Math.max(maxDepth, currentDepth);
      order.push(current);
      const neighbors = enqueueNeighbors(current, currentDepth);
      queue.push(...neighbors);
    }
  };

  processQueue([...startQueue], 0);

  const remaining = sortLex(graph.nodes.map((n) => n.id)).filter(
    (id) => !visited.has(id),
  );
  let extraDepth = maxDepth;
  remaining.forEach((id) => {
    extraDepth += 1;
    processQueue([id], extraDepth);
    maxDepth = Math.max(maxDepth, extraDepth);
  });

  const levels = new Map<number, string[]>();
  order.forEach((id) => {
    const d = depth.get(id) ?? 0;
    const level = levels.get(d) ?? [];
    level.push(id);
    levels.set(d, level);
  });

  const positioned: PositionedNode[] = [];
  const width = config.nodeWidth;
  const height = config.nodeHeight;

  [...levels.keys()]
    .sort((a, b) => a - b)
    .forEach((lvl) => {
      const ids = sortLex(levels.get(lvl) ?? []);
      ids.forEach((id, idx) => {
        const node = graph.nodes.find((n) => n.id === id);
        if (!node) return;
        const x =
          config.direction === "TB"
            ? config.padding + idx * (width + config.hGap)
            : config.padding + lvl * (width + config.hGap);
        const y =
          config.direction === "TB"
            ? config.padding + lvl * (height + config.vGap)
            : config.padding + idx * (height + config.vGap);
        positioned.push({
          ...node,
          x,
          y,
          width,
          height,
          center: { x: x + width / 2, y: y + height / 2 },
        });
      });
    });

  return { nodes: positioned, edges: graph.edges };
};
