import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/layout/rng.js";

describe("mulberry32", () => {
  it("returns a function", () => {
    expect(typeof mulberry32(0)).toBe("function");
  });

  it("returns values in [0, 1)", () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 200; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it("is deterministic — same seed produces the same sequence", () => {
    const rng1 = mulberry32(12345);
    const rng2 = mulberry32(12345);
    for (let i = 0; i < 20; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it("produces different sequences for different seeds", () => {
    const r1 = mulberry32(1)();
    const r2 = mulberry32(2)();
    expect(r1).not.toBe(r2);
  });

  it("produces different values on consecutive calls", () => {
    const rng = mulberry32(99);
    const values = Array.from({ length: 10 }, () => rng());
    const unique = new Set(values);
    // A random generator should not repeat within 10 draws
    expect(unique.size).toBeGreaterThan(1);
  });

  it("treats seed 0 and seed 1 as distinct", () => {
    expect(mulberry32(0)()).not.toBe(mulberry32(1)());
  });

  it("handles large seed values without throwing", () => {
    expect(() => mulberry32(0xffffffff)()).not.toThrow();
  });

  it("produces numbers, not NaN or Infinity", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 50; i++) {
      const v = rng();
      expect(Number.isFinite(v)).toBe(true);
      expect(Number.isNaN(v)).toBe(false);
    }
  });
});
