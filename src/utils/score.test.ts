import { describe, expect, it } from "vitest";
import { formatRankOf, medalForRank } from "./score";

describe("formatRankOf", () => {
  it("appends the board size", () => {
    expect(formatRankOf(1, 20)).toBe("1st / 20");
  });

  it("omits the board size when unknown", () => {
    expect(formatRankOf(3, undefined)).toBe("3rd");
  });

  it("keeps N/A for an unranked score", () => {
    expect(formatRankOf(0, 20)).toBe("N/A");
  });
});

describe("medalForRank", () => {
  it.each([
    [1, "gold"],
    [2, "silver"],
    [3, "bronze"]
  ])("gives place %i a %s medal", (rank, medal) => {
    expect(medalForRank(rank)).toBe(medal);
  });

  it.each([0, 4, 26])("gives place %i no medal", rank => {
    expect(medalForRank(rank)).toBeNull();
  });
});
