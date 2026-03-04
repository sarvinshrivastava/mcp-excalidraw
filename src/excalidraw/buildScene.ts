import type { FlowGraph } from "../flow/types.js";
import { layoutGraph, type LayoutConfig, type PositionedNode } from "../layout/layout.js";
import {
  type ArrowElement,
  type ExcalidrawElement,
  type ExcalidrawScene,
  type RectangleElement,
  type TextElement,
} from "./schema.js";
import { makeIdGenerator, numericSeedFromId } from "./ids.js";

export type Theme = "light" | "dark";

export type BuildSceneOptions = {
  seed: number;
  theme: Theme;
  layout: LayoutConfig;
};

type StylePalette = {
  stroke: string;
  fill: string;
  background: string;
  text: string;
};

const palettes: Record<Theme, StylePalette> = {
  light: {
    stroke: "#1e1e1e",
    fill: "#ffffff",
    background: "#ffffff",
    text: "#111827",
  },
  dark: {
    stroke: "#e5e7eb",
    fill: "#111827",
    background: "#0b1221",
    text: "#e5e7eb",
  },
};

const BASE_STYLE = {
  angle: 0,
  fillStyle: "solid" as const,
  strokeWidth: 2,
  strokeStyle: "solid" as const,
  roughness: 0,
  opacity: 100,
  groupIds: [] as string[],
  isDeleted: false,
  link: null,
  locked: false,
};

const textMetrics = (text: string, fontSize: number) => {
  const avg = fontSize * 0.6;
  const width = Math.max(fontSize, Math.ceil(text.length * avg));
  const height = Math.ceil(fontSize * 1.25);
  return { width, height };
};

const makeRect = (
  idGen: ReturnType<typeof makeIdGenerator>,
  node: PositionedNode,
  palette: StylePalette,
): RectangleElement => ({
  id: idGen("rect", node.id),
  type: "rectangle",
  x: node.x,
  y: node.y,
  width: node.width,
  height: node.height,
  strokeColor: palette.stroke,
  backgroundColor: palette.fill,
  roundness: { type: 3 },
  seed: numericSeedFromId(node.id),
  version: 1,
  versionNonce: numericSeedFromId(`${node.id}-rect`),
  updated: 1,
  boundElements: [],
  ...BASE_STYLE,
});

const makeNodeText = (
  idGen: ReturnType<typeof makeIdGenerator>,
  node: PositionedNode,
  palette: StylePalette,
): TextElement => {
  const fontSize = 18;
  const { width, height } = textMetrics(node.label, fontSize);
  return {
    id: idGen("text", node.id),
    type: "text",
    x: node.center.x - width / 2,
    y: node.center.y - height / 2,
    width,
    height,
    strokeColor: palette.text,
    backgroundColor: "transparent",
    roundness: null,
    seed: numericSeedFromId(`${node.id}-text`),
    version: 1,
    versionNonce: numericSeedFromId(`${node.id}-text-v`),
    updated: 1,
    text: node.label,
    fontSize,
    fontFamily: 1,
    textAlign: "center",
    verticalAlign: "middle",
    baseline: fontSize,
    containerId: null,
    originalText: node.label,
    lineHeight: 1.25,
    boundElements: null,
    ...BASE_STYLE,
  };
};

const makeArrow = (
  idGen: ReturnType<typeof makeIdGenerator>,
  from: PositionedNode,
  to: PositionedNode,
  palette: StylePalette,
  direction: "TB" | "LR",
): ArrowElement => {
  const start =
    direction === "TB"
      ? { x: from.center.x, y: from.y + from.height }
      : { x: from.x + from.width, y: from.center.y };
  const end =
    direction === "TB"
      ? { x: to.center.x, y: to.y }
      : { x: to.x, y: to.center.y };

  const minX = Math.min(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const points: [number, number][] = [
    [start.x - minX, start.y - minY],
    [end.x - minX, end.y - minY],
  ];
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  const id = idGen("arrow", `${from.id}->${to.id}`);

  return {
    id,
    type: "arrow",
    x: minX,
    y: minY,
    width,
    height,
    points,
    strokeColor: palette.stroke,
    backgroundColor: palette.stroke,
    roundness: null,
    seed: numericSeedFromId(id),
    version: 1,
    versionNonce: numericSeedFromId(`${id}-v`),
    updated: 1,
    startBinding: { elementId: idGen("rect", from.id), focus: 0, gap: 8 },
    endBinding: { elementId: idGen("rect", to.id), focus: 0, gap: 8 },
    boundElements: null,
    ...BASE_STYLE,
  };
};

const makeEdgeLabel = (
  idGen: ReturnType<typeof makeIdGenerator>,
  from: PositionedNode,
  to: PositionedNode,
  text: string,
  palette: StylePalette,
): TextElement => {
  const fontSize = 14;
  const { width, height } = textMetrics(text, fontSize);
  const mid = {
    x: (from.center.x + to.center.x) / 2,
    y: (from.center.y + to.center.y) / 2,
  };
  return {
    id: idGen("label", `${from.id}->${to.id}:${text}`),
    type: "text",
    x: mid.x - width / 2,
    y: mid.y - height / 2,
    width,
    height,
    strokeColor: palette.text,
    backgroundColor: "transparent",
    roundness: null,
    seed: numericSeedFromId(`${from.id}-label-${to.id}`),
    version: 1,
    versionNonce: numericSeedFromId(`${from.id}-label-${to.id}-v`),
    updated: 1,
    text,
    fontSize,
    fontFamily: 1,
    textAlign: "center",
    verticalAlign: "middle",
    baseline: fontSize,
    containerId: null,
    originalText: text,
    lineHeight: 1.25,
    boundElements: null,
    ...BASE_STYLE,
  };
};

export const buildScene = (
  graph: FlowGraph,
  options: BuildSceneOptions,
): { scene: ExcalidrawScene; meta: { nodes: number; edges: number } } => {
  const palette = palettes[options.theme] ?? palettes.light;
  const layout = layoutGraph(graph, options.layout);
  const idGen = makeIdGenerator(options.seed);

  const nodeRects: Record<string, RectangleElement> = {};
  const elements: ExcalidrawElement[] = [];

  layout.nodes.forEach((node) => {
    const rect = makeRect(idGen, node, palette);
    nodeRects[node.id] = rect;
    elements.push(rect, makeNodeText(idGen, node, palette));
  });

  layout.edges.forEach((edge) => {
    const fromNode = layout.nodes.find((n) => n.id === edge.from);
    const toNode = layout.nodes.find((n) => n.id === edge.to);
    if (!fromNode || !toNode) {
      return;
    }
    const arrow = makeArrow(idGen, fromNode, toNode, palette, options.layout.direction);
    elements.push(arrow);
    if (edge.label) {
      elements.push(makeEdgeLabel(idGen, fromNode, toNode, edge.label, palette));
    }
  });

  const scene: ExcalidrawScene = {
    type: "excalidraw",
    version: 2,
    source: "mcp-excaligen",
    elements,
    appState: {
      viewBackgroundColor: palette.background,
      currentItemFontFamily: 1,
    },
    files: {},
  };

  return {
    scene,
    meta: { nodes: layout.nodes.length, edges: layout.edges.length },
  };
};
