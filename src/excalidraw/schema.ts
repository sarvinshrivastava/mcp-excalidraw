export type ExcalidrawElementBase = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: "solid" | "hachure" | "cross-hatch";
  strokeWidth: number;
  strokeStyle: "solid" | "dashed" | "dotted";
  roughness: number;
  opacity: number;
  groupIds: string[];
  roundness: { type: number } | null;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  boundElements: { type: "arrow"; id: string }[] | null;
  updated: number;
  link: string | null;
  locked: boolean;
};

export type RectangleElement = ExcalidrawElementBase & {
  type: "rectangle";
};

export type ArrowElement = ExcalidrawElementBase & {
  type: "arrow";
  points: [number, number][];
  startBinding: { elementId: string; focus: number; gap: number } | null;
  endBinding: { elementId: string; focus: number; gap: number } | null;
};

export type TextElement = ExcalidrawElementBase & {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: number;
  textAlign: "center" | "left" | "right";
  verticalAlign: "top" | "middle" | "bottom" | "baseline";
  baseline: number;
  containerId: string | null;
  originalText: string;
  lineHeight: number;
};

export type ExcalidrawElement = RectangleElement | ArrowElement | TextElement;

export type ExcalidrawScene = {
  type: "excalidraw";
  version: 2;
  source: "mcp-excaligen";
  elements: ExcalidrawElement[];
  appState: {
    viewBackgroundColor?: string;
    currentItemFontFamily?: number;
  };
  files: Record<string, unknown>;
};
