import type { FlowGraph, FlowNode } from "../flow/types.js";
import { layoutGraph, type LayoutConfig, type PositionedNode } from "../layout/layout.js";
import {
  type ArrowElement,
  type ExcalidrawElement,
  type ExcalidrawScene,
  type TextElement,
  type RectangleElement,
} from "./schema.js";
import { makeIdGenerator, numericSeedFromId } from "./ids.js";

export type Theme = "light" | "dark";

export type StyleOptions = {
  // Colors
  nodeFill?: string;
  nodeBorder?: string;
  nodeText?: string;
  edgeColor?: string;
  edgeLabelColor?: string;
  canvasBackground?: string;
  // Typography
  fontSize?: number;
  edgeLabelFontSize?: number;
  fontFamily?: 1 | 2 | 3;
  // Geometry
  strokeWidth?: number;
  roughness?: number;
  fillStyle?: "solid" | "hachure" | "cross-hatch";
  cornerRadius?: boolean | number;
};

export type BuildSceneOptions = {
  seed: number;
  theme: Theme;
  layout: LayoutConfig;
  style?: StyleOptions;
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

type RoundnessValue = { type: 3 } | { type: 2; value: number } | null;

type ResolvedStyle = {
  nodeFill: string;
  nodeBorder: string;
  nodeText: string;
  edgeColor: string;
  edgeLabelColor: string;
  canvasBackground: string;
  fontSize: number;
  edgeLabelFontSize: number;
  fontFamily: 1 | 2 | 3;
  strokeWidth: number;
  roughness: number;
  fillStyle: "solid" | "hachure" | "cross-hatch";
  cornerRadius: RoundnessValue;
};

const resolveStyle = (palette: StylePalette, style: StyleOptions = {}): ResolvedStyle => {
  const resolveCornerRadius = (cr?: boolean | number): RoundnessValue => {
    if (cr === false) return null;
    if (typeof cr === "number") return { type: 2, value: cr };
    return { type: 3 };
  };
  return {
    nodeFill: style.nodeFill ?? palette.fill,
    nodeBorder: style.nodeBorder ?? palette.stroke,
    nodeText: style.nodeText ?? palette.text,
    edgeColor: style.edgeColor ?? palette.stroke,
    edgeLabelColor: style.edgeLabelColor ?? palette.text,
    canvasBackground: style.canvasBackground ?? palette.background,
    fontSize: style.fontSize ?? 18,
    edgeLabelFontSize: style.edgeLabelFontSize ?? 14,
    fontFamily: style.fontFamily ?? 1,
    strokeWidth: style.strokeWidth ?? 2,
    roughness: style.roughness ?? 0,
    fillStyle: style.fillStyle ?? "solid",
    cornerRadius: resolveCornerRadius(style.cornerRadius),
  };
};

const BASE_STYLE = {
  angle: 0,
  strokeStyle: "solid" as const,
  opacity: 100,
  groupIds: [] as string[],
  isDeleted: false,
  link: null,
  locked: false,
};

const textMetrics = (text: string, fontSize: number, maxWidth?: number) => {
  const avg = fontSize * 0.6;
  let displayText = text;
  let width = Math.ceil(text.length * avg);
  if (maxWidth !== undefined && width > maxWidth) {
    while (displayText.length > 1 && Math.ceil(displayText.length * avg + avg) > maxWidth) {
      displayText = displayText.slice(0, -1);
    }
    displayText = displayText.trimEnd() + "…";
    width = Math.min(Math.ceil(displayText.length * avg), maxWidth);
  }
  return { width, height: Math.ceil(fontSize * 1.25), displayText };
};

const makeRect = (
  idGen: ReturnType<typeof makeIdGenerator>,
  node: PositionedNode,
  rs: ResolvedStyle,
): RectangleElement => ({
  id: idGen("rect", node.id),
  type: "rectangle",
  x: node.x,
  y: node.y,
  width: node.width,
  height: node.height,
  strokeColor: rs.nodeBorder,
  backgroundColor: rs.nodeFill,
  roundness: rs.cornerRadius,
  seed: numericSeedFromId(node.id),
  version: 1,
  versionNonce: numericSeedFromId(`${node.id}-rect`),
  updated: 1,
  boundElements: [],
  fillStyle: rs.fillStyle,
  strokeWidth: rs.strokeWidth,
  roughness: rs.roughness,
  ...BASE_STYLE,
});

const makeNodeText = (
  idGen: ReturnType<typeof makeIdGenerator>,
  node: PositionedNode,
  rs: ResolvedStyle,
): TextElement => {
  const fontSize = rs.fontSize;
  const { width, height, displayText } = textMetrics(node.label, fontSize, node.width);
  return {
    id: idGen("text", node.id),
    type: "text",
    x: node.center.x - width / 2,
    y: node.center.y - height / 2,
    width,
    height,
    strokeColor: rs.nodeText,
    backgroundColor: "transparent",
    roundness: null,
    seed: numericSeedFromId(`${node.id}-text`),
    version: 1,
    versionNonce: numericSeedFromId(`${node.id}-text-v`),
    updated: 1,
    text: displayText,
    fontSize,
    fontFamily: rs.fontFamily,
    textAlign: "center",
    verticalAlign: "middle",
    baseline: rs.fontSize,
    containerId: null,
    originalText: node.label,
    lineHeight: 1.25,
    boundElements: null,
    fillStyle: rs.fillStyle,
    strokeWidth: rs.strokeWidth,
    roughness: rs.roughness,
    ...BASE_STYLE,
  };
};

const makeArrow = (
  idGen: ReturnType<typeof makeIdGenerator>,
  from: PositionedNode,
  to: PositionedNode,
  rs: ResolvedStyle,
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
    strokeColor: rs.edgeColor,
    backgroundColor: rs.edgeColor,
    roundness: null,
    seed: numericSeedFromId(id),
    version: 1,
    versionNonce: numericSeedFromId(`${id}-v`),
    updated: 1,
    startBinding: { elementId: idGen("rect", from.id), focus: 0, gap: 8 },
    endBinding: { elementId: idGen("rect", to.id), focus: 0, gap: 8 },
    boundElements: null,
    fillStyle: rs.fillStyle,
    strokeWidth: rs.strokeWidth,
    roughness: rs.roughness,
    ...BASE_STYLE,
  };
};

const LABEL_H_PAD = 48; // 24 px each side — used when fitContent is true

const makeNodeSizer =
  (rs: ResolvedStyle, minWidth: number, nodeHeight: number) =>
  (node: FlowNode): { width: number; height: number } => {
    const { width: textW } = textMetrics(node.label, rs.fontSize);
    return { width: Math.max(textW + LABEL_H_PAD, minWidth), height: nodeHeight };
  };

const makeEdgeLabel = (
  idGen: ReturnType<typeof makeIdGenerator>,
  from: PositionedNode,
  to: PositionedNode,
  text: string,
  rs: ResolvedStyle,
  direction: "TB" | "LR",
): TextElement => {
  const fontSize = rs.edgeLabelFontSize;
  const { width, height, displayText } = textMetrics(text, fontSize);

  // Place label at the midpoint of the actual arrow gap (between node edges),
  // then offset perpendicularly so it doesn't sit on the arrow line.
  let midX: number;
  let midY: number;
  if (direction === "LR") {
    midX = (from.x + from.width + to.x) / 2;
    midY = (from.center.y + to.center.y) / 2 - fontSize - 4;
  } else {
    midX = (from.center.x + to.center.x) / 2 + fontSize + 4;
    midY = (from.y + from.height + to.y) / 2;
  }
  const mid = { x: midX, y: midY };
  return {
    id: idGen("label", `${from.id}->${to.id}:${text}`),
    type: "text",
    x: mid.x - width / 2,
    y: mid.y - height / 2,
    width,
    height,
    strokeColor: rs.edgeLabelColor,
    backgroundColor: "transparent",
    roundness: null,
    seed: numericSeedFromId(`${from.id}-label-${to.id}`),
    version: 1,
    versionNonce: numericSeedFromId(`${from.id}-label-${to.id}-v`),
    updated: 1,
    text: displayText,
    fontSize,
    fontFamily: rs.fontFamily,
    textAlign: "center",
    verticalAlign: "middle",
    baseline: rs.edgeLabelFontSize,
    containerId: null,
    originalText: text,
    lineHeight: 1.25,
    boundElements: null,
    fillStyle: rs.fillStyle,
    strokeWidth: rs.strokeWidth,
    roughness: rs.roughness,
    ...BASE_STYLE,
  };
};

export const buildScene = (
  graph: FlowGraph,
  options: BuildSceneOptions,
): { scene: ExcalidrawScene; meta: { nodes: number; edges: number } } => {
  const palette = palettes[options.theme] ?? palettes.light;
  const rs = resolveStyle(palette, options.style);
  const nodeSizer = options.layout.fitContent
    ? makeNodeSizer(rs, options.layout.nodeWidth, options.layout.nodeHeight)
    : undefined;
  const layout = layoutGraph(graph, options.layout, nodeSizer);
  const idGen = makeIdGenerator(options.seed);

  const elements: ExcalidrawElement[] = [];

  layout.nodes.forEach((node) => {
    elements.push(makeRect(idGen, node, rs), makeNodeText(idGen, node, rs));
  });

  layout.edges.forEach((edge) => {
    const fromNode = layout.nodes.find((n) => n.id === edge.from);
    const toNode = layout.nodes.find((n) => n.id === edge.to);
    if (!fromNode || !toNode) {
      return;
    }
    const arrow = makeArrow(idGen, fromNode, toNode, rs, options.layout.direction);
    elements.push(arrow);
    if (edge.label) {
      elements.push(makeEdgeLabel(idGen, fromNode, toNode, edge.label, rs, options.layout.direction));
    }
  });

  const scene: ExcalidrawScene = {
    type: "excalidraw",
    version: 2,
    source: "mcp-excaligen",
    elements,
    appState: {
      viewBackgroundColor: rs.canvasBackground,
      currentItemFontFamily: rs.fontFamily,
    },
    files: {},
  };

  return {
    scene,
    meta: { nodes: layout.nodes.length, edges: layout.edges.length },
  };
};
