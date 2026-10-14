import { describe, expect, it } from "vitest";
import { countAtOrAbove, parseFailOn, shouldFail } from "../src/threshold.js";

describe("parseFailOn", () => {
  it.each(["high", "medium", "low", "none"])("accepts %s", (value) => {
    expect(parseFailOn(value)).toBe(value);
  });

  it("is case-insensitive and trims", () => {
    expect(parseFailOn("  MEDIUM ")).toBe("medium");
  });

  it("defaults to high when empty", () => {
    expect(parseFailOn("")).toBe("high");
  });

  it("rejects unknown values", () => {
    expect(() => parseFailOn("critical")).toThrow(/Invalid fail-on/);
  });
});

describe("shouldFail", () => {
  const onlyLow = { High: 0, Medium: 0, Low: 2 };
  const onlyMedium = { High: 0, Medium: 1, Low: 0 };
  const mixed = { High: 1, Medium: 1, Low: 1 };
  const none = { High: 0, Medium: 0, Low: 0 };

  it("fails on high only when a high finding exists", () => {
    expect(shouldFail(mixed, "high")).toBe(true);
    expect(shouldFail(onlyMedium, "high")).toBe(false);
  });

  it("fails on medium for medium and above", () => {
    expect(shouldFail(onlyMedium, "medium")).toBe(true);
    expect(shouldFail(onlyLow, "medium")).toBe(false);
  });

  it("fails on low for any reported finding", () => {
    expect(shouldFail(onlyLow, "low")).toBe(true);
    expect(shouldFail(none, "low")).toBe(false);
  });

  it("never fails with none", () => {
    expect(shouldFail(mixed, "none")).toBe(false);
  });

  it("counts findings at or above the threshold", () => {
    expect(countAtOrAbove(mixed, "high")).toBe(1);
    expect(countAtOrAbove(mixed, "medium")).toBe(2);
    expect(countAtOrAbove(mixed, "low")).toBe(3);
    expect(countAtOrAbove(mixed, "none")).toBe(0);
  });
});
