import type { FlowEdge, FlowGraph, FlowNode } from "../flow/types.js";

export type LayoutDirection = "TB" | "LR";

export type LayoutConfig = {
  direction: LayoutDirection;
  nodeWidth: number;
  nodeHeight: number;
  hGap: number;
  vGap: number;
  padding: number;
  /** When true, nodes expand horizontally to fit their label (nodeWidth becomes a minimum). */
  fitContent?: boolean;
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
  nodeSizer?: (node: FlowNode) => { width: number; height: number },
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
    let i = 0;
    while (i < queue.length) {
      const current = queue[i++] as string;
      if (visited.has(current)) continue;
      visited.add(current);
      const currentDepth = depth.get(current)!;
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
    const d = depth.get(id)!;
    const level = levels.get(d) ?? [];
    level.push(id);
    levels.set(d, level);
  });

  // Compute per-node sizes (may vary when nodeSizer is provided).
  const nodeSizes = new Map<string, { width: number; height: number }>();
  graph.nodes.forEach((node) => {
    nodeSizes.set(
      node.id,
      nodeSizer
        ? nodeSizer(node)
        : { width: config.nodeWidth, height: config.nodeHeight },
    );
  });

  const sortedLevels = [...levels.keys()].sort((a, b) => a - b);

  // Max dimension per level — used for cross-axis spacing.
  const levelMaxW = new Map<number, number>();
  const levelMaxH = new Map<number, number>();
  sortedLevels.forEach((lvl) => {
    let maxW = 0;
    let maxH = 0;
    levels.get(lvl)!.forEach((id) => {
      const s = nodeSizes.get(id) ?? { width: config.nodeWidth, height: config.nodeHeight };;
      if (s.width > maxW) maxW = s.width;
      if (s.height > maxH) maxH = s.height;
    });
    levelMaxW.set(lvl, maxW);
    levelMaxH.set(lvl, maxH);
  });

  // Cumulative main-axis offset per level.
  const levelXOff = new Map<number, number>(); // used in LR
  const levelYOff = new Map<number, number>(); // used in TB
  let cumX = config.padding;
  let cumY = config.padding;
  sortedLevels.forEach((lvl) => {
    levelXOff.set(lvl, cumX);
    levelYOff.set(lvl, cumY);
    cumX += levelMaxW.get(lvl)! + config.hGap;
    cumY += levelMaxH.get(lvl)! + config.vGap;
  });

  // Build parent map for barycenter-based cross-axis alignment.
  const parents = new Map<string, string[]>();
  graph.nodes.forEach((n) => parents.set(n.id, []));
  graph.edges.forEach((e) => parents.get(e.to)?.push(e.from));

  // Cross-axis position per node (y for LR, x for TB).
  const crossPos = new Map<string, number>();

  sortedLevels.forEach((lvl) => {
    const ids = levels.get(lvl)!;

    // Step size along the cross axis for this level.
    const crossStep =
      config.direction === "LR"
        ? levelMaxH.get(lvl)! + config.vGap
        : levelMaxW.get(lvl)! + config.hGap;

    // Ideal cross position = average of already-positioned parents' cross positions.
    const ideal = new Map<string, number | null>();
    ids.forEach((id) => {
      const pids = (parents.get(id) ?? []).filter((pid) => crossPos.has(pid));
      if (pids.length === 0) {
        ideal.set(id, null);
      } else {
        const avg = pids.reduce((s, pid) => s + crossPos.get(pid)!, 0) / pids.length;
        ideal.set(id, avg);
      }
    });

    // Sort by ideal position when both nodes have a preference; otherwise keep lex order.
    const sorted = sortLex(ids).sort((a, b) => {
      const ia = ideal.get(a)!;
      const ib = ideal.get(b)!;
      if (ia === null || ib === null) return 0;
      return ia - ib;
    });

    // Place each node: use ideal position but enforce minimum spacing from previous.
    let prevPos = -Infinity;
    sorted.forEach((id) => {
      const pref = ideal.get(id)!;
      const minPos = prevPos === -Infinity ? config.padding : prevPos + crossStep;
      const pos =
        pref !== null ? Math.max(minPos, Math.max(config.padding, pref)) : minPos;
      crossPos.set(id, pos);
      prevPos = pos;
    });
  });

  const positioned: PositionedNode[] = [];

  sortedLevels.forEach((lvl) => {
    const ids = levels.get(lvl)!;
    ids.forEach((id) => {
      const node = graph.nodes.find((n) => n.id === id);
      if (!node) return;
      const { width, height } = nodeSizes.get(id)!;
      const cross = crossPos.get(id)!;
      const main =
        config.direction === "LR" ? levelXOff.get(lvl)! : levelYOff.get(lvl)!;
      const x = config.direction === "LR" ? main : cross;
      const y = config.direction === "LR" ? cross : main;
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
