import { describe, it, expect } from "vitest";
import { summarizeBpm, Tempo } from "./bpm";

const RESOLUTION = 192;

const at = (msTime: number, beatsPerMinute: number, tick = msTime): Tempo =>
  ({ tick, beatsPerMinute, msTime });

describe("summarizeBpm", () => {
  it("returns nulls for an empty tempo map", () => {
    expect(summarizeBpm([], RESOLUTION, 200_000)).toEqual({
      bpm_dominant: null, bpm_min: null, bpm_max: null
    });
  });

  it("uses the single tempo for all three values", () => {
    expect(summarizeBpm([at(0, 174)], RESOLUTION, 200_000)).toEqual({
      bpm_dominant: 174, bpm_min: 174, bpm_max: 174
    });
  });

  it("does not let a short spike outweigh the body of the song", () => {
    // 180 for 4 minutes, 90 for one bar, back to 180 until the end
    const tempos = [at(0, 180), at(240_000, 90), at(242_000, 180)];
    const summary = summarizeBpm(tempos, RESOLUTION, 300_000);

    expect(summary.bpm_dominant).toBe(180);
    expect(summary.bpm_min).toBe(90);
    expect(summary.bpm_max).toBe(180);
  });

  it("picks the tempo holding the most time, not the first or the most markers", () => {
    // three brief 200 markers, one long 120 stretch
    const tempos = [
      at(0, 200), at(1_000, 200, 1), at(2_000, 200, 2), at(3_000, 120)
    ];
    const summary = summarizeBpm(tempos, RESOLUTION, 180_000);

    expect(summary.bpm_dominant).toBe(120);
  });

  it("closes the final segment using songLengthMs", () => {
    // without the song length the trailing 240 stretch would carry no weight
    const tempos = [at(0, 100), at(10_000, 240)];

    expect(summarizeBpm(tempos, RESOLUTION, 300_000).bpm_dominant).toBe(240);
    expect(summarizeBpm(tempos, RESOLUTION, null).bpm_dominant).toBe(100);
  });

  it("rounds fractional BPMs", () => {
    const summary = summarizeBpm([at(0, 239.9004)], RESOLUTION, 100_000);
    expect(summary.bpm_dominant).toBe(240);
  });

  it("ignores non-positive and implausible tempos", () => {
    const tempos = [at(0, 0), at(1_000, -120), at(2_000, 5_000), at(3_000, 150)];
    const summary = summarizeBpm(tempos, RESOLUTION, 200_000);

    expect(summary).toEqual({ bpm_dominant: 150, bpm_min: 150, bpm_max: 150 });
  });

  it("returns nulls when every tempo is implausible", () => {
    expect(summarizeBpm([at(0, 0), at(1, 99_999)], RESOLUTION, 100_000)).toEqual({
      bpm_dominant: null, bpm_min: null, bpm_max: null
    });
  });

  it("falls back to tick math when msTime is absent", () => {
    // 192 ticks per beat; 384 ticks at 120bpm = 2 beats = 1s, then 120s at 200
    const tempos: Tempo[] = [
      { tick: 0, beatsPerMinute: 120 },
      { tick: 384, beatsPerMinute: 200 }
    ];
    const summary = summarizeBpm(tempos, RESOLUTION, null);

    // the trailing segment cannot be closed without msTime, so 120 wins on weight
    expect(summary.bpm_dominant).toBe(120);
    expect(summary.bpm_min).toBe(120);
    expect(summary.bpm_max).toBe(200);
  });

  it("handles unsorted tempo markers", () => {
    const tempos = [at(240_000, 90), at(0, 180), at(242_000, 180)];
    expect(summarizeBpm(tempos, RESOLUTION, 300_000).bpm_dominant).toBe(180);
  });

  it("breaks weight ties toward the lower BPM so re-scans stay stable", () => {
    const tempos = [at(0, 200), at(10_000, 100)];
    expect(summarizeBpm(tempos, RESOLUTION, 20_000).bpm_dominant).toBe(100);
  });
});
