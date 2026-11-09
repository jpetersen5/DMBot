import { describe, it, expect } from "vitest";
import { User, UserStats, hasScores } from "./user";

const user = (stats?: UserStats | undefined): User => ({
  id: "1",
  username: "tester",
  avatar: null,
  permissions: "user",
  stats
});

const stats = (over: Partial<UserStats> = {}): UserStats => ({
  total_fcs: 0,
  avg_percent: 0,
  total_score: 0,
  total_scores: 0,
  ...over
});

describe("hasScores", () => {
  it("is false when stats are absent", () => {
    expect(hasScores(user(undefined))).toBe(false);
  });

  it("is false when total_scores is zero", () => {
    expect(hasScores(user(stats()))).toBe(false);
  });

  it("is false for a scoreless user carrying an elo rank", () => {
    expect(hasScores(user(stats({ rank: 42 })))).toBe(false);
  });

  it("is true once a single score is uploaded", () => {
    expect(hasScores(user(stats({ total_scores: 1 })))).toBe(true);
  });
});
