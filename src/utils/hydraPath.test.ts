import { describe, expect, it } from "vitest";
import { optimalVariants, parseHydraPath, shortPath, stepVariant, verbosePath } from "./hydraPath";
import type { SongPath } from "./song";

const path = (score: number, p = "(No mult squeezes.) | 1"): SongPath => ({
  score,
  path: p,
  breakdown: { base: 0, combo: 0, sp: 0, solo: 0, accents: 0, ghosts: 0 },
});

describe("parseHydraPath", () => {
  it("parses squeezes, activations and timings", () => {
    expect(parseHydraPath("2x, 3x | E1 (45 ms) 2+ (30 ms/12 ms) 0")).toEqual({
      squeezes: ["2x", "3x"],
      activations: [
        { short: "E1", timing: "45 ms" },
        { short: "2+", timing: "30 ms/12 ms" },
        { short: "0", timing: null },
      ],
    });
  });

  it("treats Hydra placeholders as empty", () => {
    expect(parseHydraPath("(No mult squeezes.) | (No activations.)")).toEqual({ squeezes: [], activations: [] });
  });
});

describe("shortPath", () => {
  it("strips timings", () => {
    expect(shortPath(parseHydraPath("(No mult squeezes.) | E1 (45 ms) 2"))).toBe("E1 2");
  });

  it("names a path without activations", () => {
    expect(shortPath(parseHydraPath("(No mult squeezes.) | (No activations.)"))).toBe("No activations");
  });

  it("keeps mult squeezes", () => {
    expect(shortPath(parseHydraPath("2x, 3x | E1 (45 ms) 2"))).toBe("2x, 3x | E1 2");
  });
});

describe("optimalVariants", () => {
  it("keeps the paths tied with the first", () => {
    const paths = [path(500, "a | 1"), path(500, "a | 2"), path(490, "a | 3")];
    expect(optimalVariants(paths)).toEqual(paths.slice(0, 2));
  });

  it("is empty without paths", () => {
    expect(optimalVariants(null)).toEqual([]);
    expect(optimalVariants(undefined)).toEqual([]);
    expect(optimalVariants([])).toEqual([]);
  });
});

describe("stepVariant", () => {
  it("wraps around in both directions", () => {
    expect(stepVariant(1, 1, 2)).toBe(0);
    expect(stepVariant(0, -1, 3)).toBe(2);
    expect(stepVariant(0, 1, 3)).toBe(1);
  });
});

describe("verbosePath", () => {
  it("keeps timings and drops placeholders", () => {
    expect(verbosePath(parseHydraPath("(No mult squeezes.) | E1 (45 ms) 2"))).toBe("E1 (45 ms) 2");
  });

  it("puts squeezes first", () => {
    expect(verbosePath(parseHydraPath("2x, 3x | E1 (45 ms)"))).toBe("2x, 3x | E1 (45 ms)");
  });

  it("names missing activations after squeezes", () => {
    expect(verbosePath(parseHydraPath("2x, 3x | (No activations.)"))).toBe("2x, 3x | No activations");
  });
});
