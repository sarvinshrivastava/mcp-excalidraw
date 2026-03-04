import { z } from "zod";
import { ParseError } from "../util/errors.js";
import type { FlowGraph, FlowNode, FlowEdge } from "./types.js";

const nodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

const edgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().min(1).optional(),
});

const jsonFlowSchema = z.object({
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
});

const slugify = (value: string) => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "node";
};

const hashString = (value: string) => {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
};

type TokenParse = { id: string; label?: string };

const makeQuotedId = (() => {
  const counts = new Map<string, number>();
  return (label: string) => {
    const base = `${slugify(label)}-${hashString(label).slice(0, 6)}`;
    const next = (counts.get(base) ?? 0) + 1;
    counts.set(base, next);
    return next === 1 ? base : `${base}-${next}`;
  };
})();

const parseToken = (token: string): TokenParse => {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new ParseError("Empty token");
  }

  if (
    (trimmed.startsWith(`"`) && trimmed.endsWith(`"`)) ||
    (trimmed.startsWith(`'`) && trimmed.endsWith(`'`))
  ) {
    const label = trimmed.slice(1, -1);
    return { id: makeQuotedId(label), label };
  }

  return { id: trimmed };
};

export const parseFlow = (input: string): FlowGraph => {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new ParseError("Flow is empty");
  }

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      const safe = jsonFlowSchema.parse(parsed);
      const nodeMap = new Map<string, FlowNode>();
      safe.nodes.forEach((n) => nodeMap.set(n.id, n));
      safe.edges.forEach((e) => {
        if (!nodeMap.has(e.from)) {
          nodeMap.set(e.from, { id: e.from, label: e.from });
        }
        if (!nodeMap.has(e.to)) {
          nodeMap.set(e.to, { id: e.to, label: e.to });
        }
      });
      return { nodes: Array.from(nodeMap.values()), edges: safe.edges };
    } catch (err) {
      if (err instanceof z.ZodError) {
        const issue = err.issues[0];
        const path = issue?.path?.join(".") || "root";
        throw new ParseError(`Invalid JSON flow at "${path}": ${issue.message}`);
      }
      throw new ParseError(
        err instanceof Error ? err.message : "Invalid JSON flow",
      );
    }
  }

  const lines = trimmed.split(/\r?\n/);
  const nodes = new Map<string, FlowNode>();
  const edges: FlowEdge[] = [];
  const idToLabel = new Map<string, string>();

  const ensureNode = (id: string, label?: string) => {
    const existing = nodes.get(id);
    if (existing) {
      if (label && existing.label === existing.id) {
        existing.label = label;
      }
      return existing;
    }
    const node: FlowNode = { id, label: label ?? id };
    nodes.set(id, node);
    return node;
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) {
      return;
    }

    const defMatch = line.match(/^(.+?)\s*=\s*"(.*)"\s*$/);
    if (defMatch) {
      const token = defMatch[1].trim();
      const label = defMatch[2];
      const parsed = parseToken(token);
      idToLabel.set(parsed.id, label);
      ensureNode(parsed.id, label);
      return;
    }

    const edgeMatch = line.match(/^(.*?)\s*->\s*(.*?)(?::\s*(.*))?$/);
    if (!edgeMatch) {
      throw new ParseError(`Could not parse line ${idx + 1}: "${line}"`);
    }

    const fromParsed = parseToken(edgeMatch[1]);
    const toParsed = parseToken(edgeMatch[2]);
    const label = edgeMatch[3]?.trim();

    const fromNode = ensureNode(
      fromParsed.id,
      fromParsed.label ?? idToLabel.get(fromParsed.id),
    );
    const toNode = ensureNode(
      toParsed.id,
      toParsed.label ?? idToLabel.get(toParsed.id),
    );

    edges.push({
      from: fromNode.id,
      to: toNode.id,
      label: label && label.length > 0 ? label : undefined,
    });
  });

  return { nodes: Array.from(nodes.values()), edges };
};
