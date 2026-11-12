import { describe, expect, it } from "vitest";
import { drumKind, drumNoteRows, drumsDifficulty } from "./songDrums";
import type { NotesData, SongExtraData } from "./song";

const notes = (overrides: Partial<NotesData> = {}): NotesData => ({
  instruments: ["drums"],
  hasSoloSections: false,
  hasLyrics: false,
  has2xKick: false,
  hasFlexLanes: false,
  noteCounts: [],
  maxNps: [],
  ...overrides,
});

describe("drumsDifficulty", () => {
  it("prefers the pro drums difficulty", () => {
    expect(drumsDifficulty({ diff_drums: 4, diff_drums_real: 6 } as SongExtraData)).toBe(6);
  });

  it("falls back to the regular difficulty when pro is unset", () => {
    expect(drumsDifficulty({ diff_drums: 4, diff_drums_real: -1 } as SongExtraData)).toBe(4);
    expect(drumsDifficulty({ diff_drums: 4 } as SongExtraData)).toBe(4);
  });

  it("is null when the chart has no drums difficulty", () => {
    expect(drumsDifficulty({ diff_drums: -1, diff_drums_real: -1 } as SongExtraData)).toBeNull();
    expect(drumsDifficulty({} as SongExtraData)).toBeNull();
  });
});

describe("drumKind", () => {
  it("names pro and five-lane charts", () => {
    expect(drumKind(notes({ drumType: 1 }))).toBe("Pro");
    expect(drumKind(notes({ drumType: 2 }))).toBe("5-lane");
  });

  it("is null for plain four-lane or unknown charts", () => {
    expect(drumKind(notes({ drumType: 0 }))).toBeNull();
    expect(drumKind(notes())).toBeNull();
    expect(drumKind(undefined)).toBeNull();
  });
});

describe("drumNoteRows", () => {
  it("lists drum difficulties hardest first with their peak notes per second", () => {
    const data = notes({
      noteCounts: [
        { instrument: "drums", difficulty: "hard", count: 660 },
        { instrument: "guitar", difficulty: "expert", count: 999 },
        { instrument: "drums", difficulty: "expert", count: 2098 },
      ],
      maxNps: [
        { instrument: "drums", difficulty: "expert", nps: 14.5, time: 0 },
        { instrument: "guitar", difficulty: "expert", nps: 20, time: 0 },
      ],
    });
    expect(drumNoteRows(data)).toEqual([
      { difficulty: "expert", count: 2098, nps: 14.5 },
      { difficulty: "hard", count: 660, nps: null },
    ]);
  });

  it("is empty without note data", () => {
    expect(drumNoteRows(undefined)).toEqual([]);
  });
});
