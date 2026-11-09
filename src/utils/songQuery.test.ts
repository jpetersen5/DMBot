import { describe, it, expect } from "vitest";
import { parseSongQuery, songMatchesBpm, hasUnscannedBpm, BpmQuery } from "./songQuery";

const bpm = (
  bpm_dominant: number | null,
  bpm_min: number | null = bpm_dominant,
  bpm_max: number | null = bpm_dominant
) => ({ bpm_dominant, bpm_min, bpm_max });

describe("parseSongQuery", () => {
  it("returns plain terms untouched when no token is present", () => {
    expect(parseSongQuery("through the fire")).toEqual({
      terms: ["through", "the", "fire"],
      bpm: undefined
    });
  });

  it("lowercases and drops empty tokens", () => {
    expect(parseSongQuery("  DragonForce   Flames ").terms).toEqual([
      "dragonforce", "flames"
    ]);
  });

  it.each([
    ["bpm:240", { kind: "exact", value: 240 }],
    ["bpm:200-260", { kind: "range", lo: 200, hi: 260 }],
    ["bpm:>200", { kind: "gt", value: 200 }],
    ["bpm:<120", { kind: "lt", value: 120 }],
    ["BPM:240", { kind: "exact", value: 240 }]
  ])("parses %s", (input, expected) => {
    expect(parseSongQuery(input).bpm).toEqual(expected);
  });

  it("strips the token from the search terms", () => {
    const parsed = parseSongQuery("bpm:240 metal");
    expect(parsed.terms).toEqual(["metal"]);
    expect(parsed.bpm).toEqual({ kind: "exact", value: 240 });
  });

  it("normalises a reversed range", () => {
    expect(parseSongQuery("bpm:260-200").bpm).toEqual({ kind: "range", lo: 200, hi: 260 });
  });

  it("degrades a malformed token to an ordinary search term", () => {
    const parsed = parseSongQuery("bpm:abc metal");
    expect(parsed.bpm).toBeUndefined();
    expect(parsed.terms).toEqual(["bpm:abc", "metal"]);
  });

  it("lets the last token win so retyping replaces the filter", () => {
    expect(parseSongQuery("bpm:120 bpm:240").bpm).toEqual({ kind: "exact", value: 240 });
  });
});

describe("songMatchesBpm", () => {
  const exact: BpmQuery = { kind: "exact", value: 240 };

  it("matches within the tolerance and rejects outside it", () => {
    expect(songMatchesBpm(bpm(240), exact)).toBe(true);
    expect(songMatchesBpm(bpm(241), exact)).toBe(true);
    expect(songMatchesBpm(bpm(238), exact)).toBe(true);
    expect(songMatchesBpm(bpm(246), exact)).toBe(false);
    expect(songMatchesBpm(bpm(234), exact)).toBe(false);
  });

  it("overlaps the whole tempo span for a range query", () => {
    const range: BpmQuery = { kind: "range", lo: 200, hi: 260 };
    // a song that passes through the band qualifies even though its dominant
    // (180) sits below it
    expect(songMatchesBpm(bpm(180, 180, 210), range)).toBe(true);
    expect(songMatchesBpm(bpm(120, 100, 150), range)).toBe(false);
    expect(songMatchesBpm(bpm(230), range)).toBe(true);
  });

  it("falls back to the dominant when the span is missing", () => {
    const range: BpmQuery = { kind: "range", lo: 200, hi: 260 };
    expect(songMatchesBpm({ bpm_dominant: 230, bpm_min: null, bpm_max: null }, range)).toBe(true);
    expect(songMatchesBpm({ bpm_dominant: 100, bpm_min: null, bpm_max: null }, range)).toBe(false);
  });

  it("handles open-ended comparisons", () => {
    expect(songMatchesBpm(bpm(240), { kind: "gt", value: 200 })).toBe(true);
    expect(songMatchesBpm(bpm(180), { kind: "gt", value: 200 })).toBe(false);
    expect(songMatchesBpm(bpm(100), { kind: "lt", value: 120 })).toBe(true);
    expect(songMatchesBpm(bpm(140), { kind: "lt", value: 120 })).toBe(false);
  });

  it("never matches a song without BPM data", () => {
    const queries: BpmQuery[] = [
      { kind: "exact", value: 240 },
      { kind: "range", lo: 0, hi: 10_000 },
      { kind: "gt", value: 0 },
      { kind: "lt", value: 10_000 }
    ];
    for (const query of queries) {
      expect(songMatchesBpm(bpm(null), query)).toBe(false);
    }
  });

  it("does not treat half or double time as a match", () => {
    // deliberate: wrong as often as it's right
    expect(songMatchesBpm(bpm(120), exact)).toBe(false);
    expect(songMatchesBpm(bpm(480), exact)).toBe(false);
  });
});

describe("hasUnscannedBpm", () => {
  it("is true when any song still lacks BPM data", () => {
    expect(hasUnscannedBpm([bpm(240), bpm(null)])).toBe(true);
    expect(hasUnscannedBpm([bpm(240), bpm(180)])).toBe(false);
    expect(hasUnscannedBpm([])).toBe(false);
  });
});
