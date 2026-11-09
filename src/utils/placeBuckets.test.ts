import { describe, it, expect } from "vitest";
import {
  PLACE_BUCKETS,
  bucketForPlace,
  buildPlaceDistribution,
  toggleBucket,
  filterByBuckets
} from "./placeBuckets";

describe("bucketForPlace", () => {
  it.each([
    [1, "1"],
    [2, "2"],
    [3, "3"],
    [4, "4-5"],
    [5, "4-5"],
    [6, "6-10"],
    [10, "6-10"],
    [11, "11-25"],
    [25, "11-25"],
    [26, "26+"],
    [1000, "26+"]
  ])("maps place %i to bucket %s", (place, expected) => {
    expect(bucketForPlace(place)).toBe(expected);
  });

  it.each([[0], [null], [undefined], [-1]])("treats %s as unranked", (place) => {
    expect(bucketForPlace(place as number | null | undefined)).toBeNull();
  });

  it("covers every place from 1 upward with no gaps", () => {
    for (let place = 1; place <= 60; place++) {
      expect(bucketForPlace(place)).not.toBeNull();
    }
  });
});

describe("buildPlaceDistribution", () => {
  it("counts each bucket and totals to the input length", () => {
    const scores = [
      { rank: 1 }, { rank: 1 }, { rank: 2 }, { rank: 4 },
      { rank: 12 }, { rank: 99 }, { rank: null }, {}
    ];

    const { counts, unranked, total } = buildPlaceDistribution(scores);

    expect(counts["1"]).toBe(2);
    expect(counts["2"]).toBe(1);
    expect(counts["3"]).toBe(0);
    expect(counts["4-5"]).toBe(1);
    expect(counts["11-25"]).toBe(1);
    expect(counts["26+"]).toBe(1);
    expect(unranked).toBe(2);
    expect(total).toBe(scores.length);

    const bucketed = Object.values(counts).reduce((sum, n) => sum + n, 0);
    expect(bucketed + unranked).toBe(total);
  });

  it("returns a zero for every bucket when given no scores", () => {
    const { counts, unranked, total } = buildPlaceDistribution([]);
    expect(Object.keys(counts)).toEqual(PLACE_BUCKETS.map(b => b.key));
    expect(Object.values(counts).every(n => n === 0)).toBe(true);
    expect(unranked).toBe(0);
    expect(total).toBe(0);
  });
});

describe("toggleBucket", () => {
  it("adds an unselected bucket", () => {
    expect(toggleBucket(["1"], "2")).toEqual(["1", "2"]);
  });

  it("removes a selected bucket", () => {
    expect(toggleBucket(["1", "2"], "1")).toEqual(["2"]);
  });
});

describe("filterByBuckets", () => {
  const scores = [{ rank: 1 }, { rank: 2 }, { rank: 3 }, { rank: 7 }, { rank: 0 }];

  it("shows everything when nothing is selected", () => {
    expect(filterByBuckets(scores, [])).toBe(scores);
  });

  it("shows only the selected place", () => {
    expect(filterByBuckets(scores, ["1"])).toEqual([{ rank: 1 }]);
  });

  it("combines selected places", () => {
    expect(filterByBuckets(scores, ["1", "2"])).toEqual([{ rank: 1 }, { rank: 2 }]);
  });

  it("drops unranked scores while filtering", () => {
    expect(filterByBuckets(scores, ["6-10"])).toEqual([{ rank: 7 }]);
  });
});
