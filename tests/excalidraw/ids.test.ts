import { describe, it, expect } from "vitest";
import { makeIdGenerator, numericSeedFromId } from "../../src/excalidraw/ids.js";

describe("makeIdGenerator", () => {
  it("returns a function", () => {
    expect(typeof makeIdGenerator(1)).toBe("function");
  });

  it("generates deterministic IDs for the same seed and inputs", () => {
    const gen1 = makeIdGenerator(42);
    const gen2 = makeIdGenerator(42);
    expect(gen1("rect", "nodeA")).toBe(gen2("rect", "nodeA"));
    expect(gen1("arrow", "A->B")).toBe(gen2("arrow", "A->B"));
    expect(gen1("text", "nodeA")).toBe(gen2("text", "nodeA"));
  });

  it("generates different IDs for different seeds", () => {
    const gen1 = makeIdGenerator(1);
    const gen2 = makeIdGenerator(2);
    expect(gen1("rect", "node")).not.toBe(gen2("rect", "node"));
  });

  it("prefixes each ID with the kind", () => {
    const gen = makeIdGenerator(7);
    expect(gen("rect", "x")).toMatch(/^rect-/);
    expect(gen("arrow", "a->b")).toMatch(/^arrow-/);
    expect(gen("text", "x")).toMatch(/^text-/);
    expect(gen("label", "edge")).toMatch(/^label-/);
  });

  it("returns a non-empty string", () => {
    const gen = makeIdGenerator(0);
    const id = gen("rect", "node");
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("produces different IDs for different kinds with the same name", () => {
    const gen = makeIdGenerator(1);
    const rectId = gen("rect", "node");
    const textId = gen("text", "node");
    expect(rectId).not.toBe(textId);
  });

  it("produces different IDs for different names with the same kind", () => {
    const gen = makeIdGenerator(1);
    expect(gen("rect", "nodeA")).not.toBe(gen("rect", "nodeB"));
  });

  it("is consistent across multiple calls with the same args", () => {
    const gen = makeIdGenerator(99);
    const id1 = gen("rect", "stable");
    const id2 = gen("rect", "stable");
    // Same generator, same args → same ID (pure hash, no state)
    expect(id1).toBe(id2);
  });
});

describe("numericSeedFromId", () => {
  it("returns a number", () => {
    expect(typeof numericSeedFromId("any-id")).toBe("number");
  });

  it("returns the same value for the same input", () => {
    expect(numericSeedFromId("hello")).toBe(numericSeedFromId("hello"));
  });

  it("returns different values for different inputs", () => {
    expect(numericSeedFromId("foo")).not.toBe(numericSeedFromId("bar"));
  });

  it("returns a non-negative integer", () => {
    const val = numericSeedFromId("test-node");
    expect(Number.isInteger(val)).toBe(true);
    expect(val).toBeGreaterThanOrEqual(0);
  });

  it("handles an empty string without throwing", () => {
    expect(() => numericSeedFromId("")).not.toThrow();
  });

  it("handles long strings", () => {
    const long = "x".repeat(1000);
    const val = numericSeedFromId(long);
    expect(Number.isFinite(val)).toBe(true);
  });
});
