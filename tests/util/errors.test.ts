import { describe, it, expect } from "vitest";
import { ValidationError, ParseError } from "../../src/util/errors.js";

describe("ValidationError", () => {
  it("has the correct name", () => {
    const err = new ValidationError("something went wrong");
    expect(err.name).toBe("ValidationError");
  });

  it("stores the provided message", () => {
    const err = new ValidationError("invalid value");
    expect(err.message).toBe("invalid value");
  });

  it("is an instance of Error", () => {
    const err = new ValidationError("test");
    expect(err).toBeInstanceOf(Error);
  });

  it("is an instance of ValidationError", () => {
    const err = new ValidationError("test");
    expect(err).toBeInstanceOf(ValidationError);
  });

  it("can be caught as an Error", () => {
    expect(() => {
      throw new ValidationError("boom");
    }).toThrow(Error);
  });

  it("preserves the stack trace", () => {
    const err = new ValidationError("trace check");
    expect(err.stack).toBeDefined();
  });
});

describe("ParseError", () => {
  it("has the correct name", () => {
    const err = new ParseError("bad syntax");
    expect(err.name).toBe("ParseError");
  });

  it("stores the provided message", () => {
    const err = new ParseError("unexpected token");
    expect(err.message).toBe("unexpected token");
  });

  it("is an instance of Error", () => {
    const err = new ParseError("test");
    expect(err).toBeInstanceOf(Error);
  });

  it("is an instance of ParseError", () => {
    const err = new ParseError("test");
    expect(err).toBeInstanceOf(ParseError);
  });

  it("can be caught as an Error", () => {
    expect(() => {
      throw new ParseError("boom");
    }).toThrow(Error);
  });

  it("is distinct from ValidationError", () => {
    const parseErr = new ParseError("test");
    expect(parseErr).not.toBeInstanceOf(ValidationError);
    const validErr = new ValidationError("test");
    expect(validErr).not.toBeInstanceOf(ParseError);
  });
});
