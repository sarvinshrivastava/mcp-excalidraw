import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseFlow } from "./flow/parse.js";
import { buildScene, type Theme, type StyleOptions } from "./excalidraw/buildScene.js";
import { exportSceneToFiles, type ExportFormat } from "./excalidraw/export.js";
import type { LayoutConfig } from "./layout/layout.js";
import type { ExcalidrawScene } from "./excalidraw/schema.js";

export const DEFAULT_LAYOUT: LayoutConfig = {
  direction: "TB",
  nodeWidth: 320,
  nodeHeight: 80,
  hGap: 120,
  vGap: 80,
  padding: 40,
};

const formatEnum = z.enum(["excalidraw", "svg", "png"]);

const layoutSchema = z.object({
  direction: z.enum(["TB", "LR"]).default("TB"),
  nodeWidth: z.number().positive().default(320),
  nodeHeight: z.number().positive().default(80),
  hGap: z.number().nonnegative().default(120),
  vGap: z.number().nonnegative().default(80),
  padding: z.number().nonnegative().default(40),
});

export const styleSchema = z.object({
  nodeFill: z.string().optional(),
  nodeBorder: z.string().optional(),
  nodeText: z.string().optional(),
  edgeColor: z.string().optional(),
  edgeLabelColor: z.string().optional(),
  canvasBackground: z.string().optional(),
  fontSize: z.number().positive().optional(),
  edgeLabelFontSize: z.number().positive().optional(),
  fontFamily: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  strokeWidth: z.number().positive().optional(),
  roughness: z.number().min(0).max(2).optional(),
  fillStyle: z.enum(["solid", "hachure", "cross-hatch"]).optional(),
  cornerRadius: z.union([z.boolean(), z.number().nonnegative()]).optional(),
}) satisfies z.ZodType<StyleOptions>;

const sceneSchema = z.object({
  type: z.literal("excalidraw"),
  version: z.number(),
  source: z.string(),
  elements: z.array(z.any()),
  appState: z.record(z.any()),
  files: z.record(z.any()),
});

const metaSchema = z.object({
  nodes: z.number(),
  edges: z.number(),
});

const filesSchema = z.array(
  z.object({
    format: formatEnum,
    path: z.string(),
  }),
);

const flowToSceneInputSchema = z.object({
  flow: z.string().min(1),
  seed: z.number().int().default(1),
  theme: z.enum(["light", "dark"]).default("light"),
  layout: layoutSchema.default(DEFAULT_LAYOUT satisfies LayoutConfig),
  style: styleSchema.optional(),
});

const exportSceneInputSchema = z.object({
  scene: sceneSchema,
  formats: z.array(formatEnum).default(["excalidraw"] as const),
  outDir: z.string().default("./out"),
  baseName: z.string().default("diagram"),
  png: z
    .object({
      scale: z.number().positive().default(2),
    })
    .optional(),
});

const generateAndExportSchema = z.object({
  flow: z.string().min(1),
  seed: z.number().int().default(1),
  theme: z.enum(["light", "dark"]).default("light"),
  layout: layoutSchema.default(DEFAULT_LAYOUT satisfies LayoutConfig),
  style: styleSchema.optional(),
  outDir: z.string().default("./out"),
  baseName: z.string().default("diagram"),
  formats: z.array(formatEnum).default(["excalidraw", "svg", "png"] as const),
  png: z
    .object({
      scale: z.number().positive().default(2),
    })
    .optional(),
});

type FlowToSceneInput = z.infer<typeof flowToSceneInputSchema>;
type ExportSceneInput = z.infer<typeof exportSceneInputSchema>;
type GenerateAndExportInput = z.infer<typeof generateAndExportSchema>;

export const generateSceneFromFlow = (
  input: FlowToSceneInput,
): { scene: ExcalidrawScene; meta: { nodes: number; edges: number } } => {
  const graph = parseFlow(input.flow);
  return buildScene(graph, {
    seed: input.seed,
    theme: input.theme as Theme,
    layout: input.layout,
    style: input.style,
  });
};

export const exportSceneFiles = async (options: {
  scene: ExcalidrawScene;
  formats: ExportFormat[];
  outDir: string;
  baseName: string;
  png?: { scale?: number };
}) => exportSceneToFiles(options);

export const generateAndExport = async (options: GenerateAndExportInput) => {
  const { scene, meta } = generateSceneFromFlow(options);
  const uniqueFormats = Array.from(
    new Set<ExportFormat>([...options.formats, "excalidraw"]),
  );
  const { files } = await exportSceneFiles({
    scene,
    formats: uniqueFormats,
    outDir: options.outDir,
    baseName: options.baseName,
    png: options.png,
  });

  const excalidrawFile =
    files.find((f) => f.format === "excalidraw") ?? files[0];

  return { scenePath: excalidrawFile.path, files, meta };
};

const server = new McpServer({
  name: "mcp-excaligen",
  version: "0.1.0",
});

server.registerTool(
  "flow_to_scene",
  {
    description:
      "Convert a flow description (DSL or JSON) into an Excalidraw scene JSON.",
    inputSchema: flowToSceneInputSchema,
    outputSchema: z.object({
      scene: sceneSchema,
      meta: metaSchema,
    }),
  },
  async (input) => {
    const data = flowToSceneInputSchema.parse(input);
    const { scene, meta } = generateSceneFromFlow(data);
    const payload = { scene, meta };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
);

server.registerTool(
  "export_scene",
  {
    description:
      "Export an Excalidraw scene to .excalidraw, .svg, and/or .png files on disk.",
    inputSchema: exportSceneInputSchema,
    outputSchema: z.object({
      files: filesSchema,
    }),
  },
  async (input) => {
    const data = exportSceneInputSchema.parse(input as ExportSceneInput);
    const { files } = await exportSceneFiles({
      scene: data.scene as ExcalidrawScene,
      formats: data.formats as ExportFormat[],
      outDir: data.outDir,
      baseName: data.baseName,
      png: data.png,
    });
    const payload = { files };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
);

server.registerTool(
  "generate_and_export",
  {
    description:
      "Parse a flow, create an Excalidraw scene, and export it to disk in the requested formats.",
    inputSchema: generateAndExportSchema,
    outputSchema: z.object({
      scenePath: z.string(),
      files: filesSchema,
      meta: metaSchema,
    }),
  },
  async (input) => {
    const data = generateAndExportSchema.parse(input as GenerateAndExportInput);
    const payload = await generateAndExport(data);
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
);

export const startServer = async () => {
  await server.connect(new StdioServerTransport());
};

const getEntryUrl = () => {
  const entry = process.argv[1];
  if (!entry) return "";
  try {
    return pathToFileURL(path.resolve(entry)).href;
  } catch {
    return "";
  }
};

if (import.meta.url === getEntryUrl()) {
  startServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
