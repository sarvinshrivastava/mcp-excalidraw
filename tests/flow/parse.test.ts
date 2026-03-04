import { describe, it, expect } from "vitest";
import { parseFlow } from "../../src/flow/parse.js";
import { ParseError } from "../../src/util/errors.js";

// NOTE: parse.ts uses a module-level closure (makeQuotedId) that tracks how
// many times each quoted label has been used. To keep tests independent,
// each test case uses a unique quoted label so the counter does not affect
// node IDs between test runs within this file.

describe("parseFlow — DSL: basic edge parsing", () => {
  it("parses a simple two-node edge", () => {
    const graph = parseFlow("Alpha -> Beta");
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].from).toBe("Alpha");
    expect(graph.edges[0].to).toBe("Beta");
  });

  it("uses the node id as its label for unquoted identifiers", () => {
    const graph = parseFlow("X1 -> Y1");
    const x = graph.nodes.find((n) => n.id === "X1");
    expect(x?.label).toBe("X1");
  });

  it("parses an edge label using the colon syntax", () => {
    const graph = parseFlow("NodeA -> NodeB : on-success");
    expect(graph.edges[0].label).toBe("on-success");
  });

  it("sets edge label to undefined when no colon is present", () => {
    const graph = parseFlow("NodeC -> NodeD");
    expect(graph.edges[0].label).toBeUndefined();
  });

  it("trims whitespace around node ids and labels", () => {
    const graph = parseFlow("  NodeE  ->  NodeF  :  my label  ");
    expect(graph.edges[0].from).toBe("NodeE");
    expect(graph.edges[0].to).toBe("NodeF");
    expect(graph.edges[0].label).toBe("my label");
  });

  it("deduplicates nodes that appear in multiple edges", () => {
    const graph = parseFlow("A -> B\nB -> C\nA -> C");
    const ids = graph.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length); // no duplicates
    expect(graph.nodes).toHaveLength(3);
  });
});

describe("parseFlow — DSL: quoted labels", () => {
  it("parses a double-quoted label and sets it on the node", () => {
    const graph = parseFlow('"QuotedNodeAlpha" -> End1');
    const n = graph.nodes.find((n) => n.label === "QuotedNodeAlpha");
    expect(n).toBeDefined();
  });

  it("parses a single-quoted label and sets it on the node", () => {
    const graph = parseFlow("'QuotedNodeBeta' -> End2");
    const n = graph.nodes.find((n) => n.label === "QuotedNodeBeta");
    expect(n).toBeDefined();
  });

  it("does NOT use the raw quoted string as the node id", () => {
    const graph = parseFlow('"QuotedNodeGamma" -> End3');
    const n = graph.nodes.find((n) => n.label === "QuotedNodeGamma");
    // The id should be a slugified/hashed form, not the literal quoted string
    expect(n?.id).not.toBe('"QuotedNodeGamma"');
  });
});

describe("parseFlow — DSL: definition syntax", () => {
  it("assigns a label to a node via the id = \"label\" syntax", () => {
    const graph = parseFlow('myNode = "My Pretty Label"\nmyNode -> Other1');
    const n = graph.nodes.find((n) => n.id === "myNode");
    expect(n?.label).toBe("My Pretty Label");
  });

  it("allows the defined node to appear as both source and target", () => {
    const graph = parseFlow(
      'entryNode = "Welcome"\nStart1 -> entryNode\nentryNode -> End5',
    );
    const entry = graph.nodes.find((n) => n.id === "entryNode");
    expect(entry?.label).toBe("Welcome");
    // Two edges referencing entryNode → it appears once in nodes
    expect(graph.nodes.filter((n) => n.id === "entryNode")).toHaveLength(1);
  });
});

describe("parseFlow — DSL: multi-line flows", () => {
  it("parses a three-node chain across two lines", () => {
    const graph = parseFlow("N1 -> N2\nN2 -> N3");
    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(2);
  });

  it("ignores blank lines", () => {
    const graph = parseFlow("\nN4 -> N5\n\nN5 -> N6\n");
    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(2);
  });

  it("ignores lines starting with #", () => {
    const graph = parseFlow("# This is a comment\nN7 -> N8");
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
  });

  it("ignores lines starting with //", () => {
    const graph = parseFlow("// double-slash comment\nN9 -> N10");
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
  });

  it("parses a realistic multi-step flow using the fixture pattern", () => {
    const dsl = [
      "# Sample",
      "Start -> OtpStep",
      "OtpStep -> Verify : submit",
      "Verify -> Done",
      "Verify -> ErrorState : retry",
      'Done = "Completed"',
    ].join("\n");
    const graph = parseFlow(dsl);
    // Start, OtpStep, Verify, Done, ErrorState
    expect(graph.nodes).toHaveLength(5);
    expect(graph.edges).toHaveLength(4);
    expect(graph.edges.find((e) => e.label === "submit")).toBeDefined();
    expect(graph.edges.find((e) => e.label === "retry")).toBeDefined();
    const done = graph.nodes.find((n) => n.id === "Done");
    expect(done?.label).toBe("Completed");
  });
});

describe("parseFlow — JSON input", () => {
  it("parses a minimal valid JSON flow", () => {
    const json = JSON.stringify({
      nodes: [
        { id: "a", label: "Node A" },
        { id: "b", label: "Node B" },
      ],
      edges: [{ from: "a", to: "b" }],
    });
    const graph = parseFlow(json);
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
  });

  it("uses node labels from the JSON", () => {
    const json = JSON.stringify({
      nodes: [{ id: "x", label: "Extra Node" }],
      edges: [],
    });
    const graph = parseFlow(json);
    expect(graph.nodes[0].label).toBe("Extra Node");
  });

  it("preserves edge labels from JSON", () => {
    const json = JSON.stringify({
      nodes: [
        { id: "p", label: "P" },
        { id: "q", label: "Q" },
      ],
      edges: [{ from: "p", to: "q", label: "transition" }],
    });
    const graph = parseFlow(json);
    expect(graph.edges[0].label).toBe("transition");
  });

  it("auto-creates nodes that appear only in edges (not in nodes array)", () => {
    const json = JSON.stringify({
      nodes: [],
      edges: [{ from: "implicit-a", to: "implicit-b" }],
    });
    const graph = parseFlow(json);
    const ids = graph.nodes.map((n) => n.id);
    expect(ids).toContain("implicit-a");
    expect(ids).toContain("implicit-b");
  });

  it("handles a JSON flow with no edges", () => {
    const json = JSON.stringify({
      nodes: [{ id: "lonely", label: "Alone" }],
      edges: [],
    });
    const graph = parseFlow(json);
    expect(graph.nodes).toHaveLength(1);
    expect(graph.edges).toHaveLength(0);
  });

  it("handles a JSON flow with no nodes and no edges", () => {
    const json = JSON.stringify({ nodes: [], edges: [] });
    const graph = parseFlow(json);
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
  });
});

describe("parseFlow — error cases", () => {
  it("throws ParseError for an empty string", () => {
    expect(() => parseFlow("")).toThrow(ParseError);
  });

  it("throws ParseError for whitespace-only input", () => {
    expect(() => parseFlow("   \n  \t  ")).toThrow(ParseError);
  });

  it("throws ParseError for a line with no arrow and no definition", () => {
    expect(() => parseFlow("this is not valid dsl syntax")).toThrow(ParseError);
  });

  it("throws ParseError for malformed JSON (syntax error)", () => {
    expect(() => parseFlow("{not: valid, json}")).toThrow(ParseError);
  });

  it("throws ParseError for structurally invalid JSON (wrong shape)", () => {
    const json = JSON.stringify({ nodes: "not-an-array", edges: [] });
    expect(() => parseFlow(json)).toThrow(ParseError);
  });

  it("throws ParseError for JSON nodes missing required id field", () => {
    const json = JSON.stringify({
      nodes: [{ label: "No ID" }],
      edges: [],
    });
    expect(() => parseFlow(json)).toThrow(ParseError);
  });

  it("throws ParseError for JSON nodes with empty id", () => {
    const json = JSON.stringify({
      nodes: [{ id: "", label: "Empty ID" }],
      edges: [],
    });
    expect(() => parseFlow(json)).toThrow(ParseError);
  });

  it("error message for an invalid line includes the line number", () => {
    try {
      parseFlow("A -> B\nbad line here\nC -> D");
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ParseError);
      expect((err as ParseError).message).toMatch(/2/);
    }
  });
});
