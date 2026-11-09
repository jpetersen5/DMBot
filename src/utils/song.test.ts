import { describe, it, expect } from "vitest";
import {
  Song,
  SongDelta,
  SONG_TABLE_HEADERS,
  mergeSongs,
  songMatchesInstrumentDifficulty,
  buildSongSearchString,
  songSearchStringMatches,
  getSortValues,
  compareMissingLast,
  formatBpmRange,
  bpmMarkerPercent
} from "./song";

const song = (id: number, over: Partial<Song> = {}): Song => ({
  id,
  md5: `md5-${id}`,
  artist: null,
  name: `Song ${id}`,
  album: null,
  track: null,
  year: null,
  genre: null,
  loading_phrase: null,
  playlist_path: null,
  instruments: null,
  song_length: null,
  charter_refs: null,
  scores_count: null,
  fc_count: null,
  total_plays: null,
  last_update: "2026-07-13T00:00:00+00:00",
  ...over
});

const delta = (over: Partial<SongDelta> = {}): SongDelta => ({
  server_time: "2026-07-13T00:00:00+00:00",
  songs: [],
  deleted: [],
  ...over
});

describe("mergeSongs", () => {
  it("inserts new songs", () => {
    const merged = mergeSongs([song(1)], delta({ songs: [song(2)] }));
    expect(merged.map(s => s.id).sort()).toEqual([1, 2]);
  });

  it("updates existing songs by id", () => {
    const merged = mergeSongs(
      [song(1, { name: "Old" })],
      delta({ songs: [song(1, { name: "New" })] })
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe("New");
  });

  it("removes tombstoned ids", () => {
    const merged = mergeSongs(
      [song(1), song(2)],
      delta({ deleted: [{ id: 1, md5: "md5-1" }] })
    );
    expect(merged.map(s => s.id)).toEqual([2]);
  });

  it("returns the existing set unchanged for an empty delta", () => {
    const existing = [song(1), song(2)];
    const merged = mergeSongs(existing, delta());
    expect(merged.map(s => s.id)).toEqual([1, 2]);
  });

  it("applies an update and a delete together", () => {
    const merged = mergeSongs(
      [song(1, { name: "Old" }), song(2)],
      delta({ songs: [song(1, { name: "New" })], deleted: [{ id: 2, md5: "md5-2" }] })
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ id: 1, name: "New" });
  });
});

describe("song search (buildSongSearchString + songSearchStringMatches)", () => {
  const matches = (s: Song, query: string): boolean =>
    songSearchStringMatches(buildSongSearchString(s), query.toLowerCase().split(" "));

  const track = song(10, {
    name: "Through the Fire and Flames",
    artist: "DragonForce",
    album: "Inhuman Rachine",
    year: 2006,
    genre: "Power Metal",
    charter_refs: ["Harmonix", "GuitarHero"],
    loading_phrase: "Shred on",
    playlist_path: "Rock/Metal"
  });

  it("matches a single term case-insensitively", () => {
    expect(matches(track, "dragonforce")).toBe(true);
    expect(matches(track, "DRAGONFORCE")).toBe(true);
    expect(matches(track, "flames")).toBe(true);
  });

  it("requires every term to match (multi-term AND across fields)", () => {
    // both terms present, in different fields
    expect(matches(track, "dragonforce flames")).toBe(true);
    // second term is absent -> whole query fails
    expect(matches(track, "dragonforce nirvana")).toBe(false);
  });

  it("matches against charter_refs", () => {
    expect(matches(track, "harmonix")).toBe(true);
    expect(matches(track, "guitarhero")).toBe(true);
    expect(matches(track, "harmonix guitarhero")).toBe(true);
  });

  it("matches a numeric query against the year", () => {
    expect(matches(track, "2006")).toBe(true);
  });

  it("does NOT match a numeric query against id, md5 or scores_count", () => {
    const identifierOnly = song(2006, {
      // id 2006 -> default md5 is "md5-2006"; also stuff scores_count with 2006
      name: "No Year Here",
      artist: "Anon",
      year: null,
      scores_count: 2006
    });
    expect(identifierOnly.md5).toContain("2006");
    expect(matches(identifierOnly, "2006")).toBe(false);
  });
});

describe("songMatchesInstrumentDifficulty", () => {
  const drumsSong = song(1, {
    instruments: ["drums", "guitar"],
    chart_coverage: { drums: ["expert", "hard"], guitar: ["medium"] }
  });

  it("matches everything when no filters are active", () => {
    expect(songMatchesInstrumentDifficulty(drumsSong, [], [])).toBe(true);
    // even a song with no coverage passes when nothing is filtered
    expect(songMatchesInstrumentDifficulty(song(2), [], [])).toBe(true);
  });

  it("matches on difficulty alone across any instrument", () => {
    expect(songMatchesInstrumentDifficulty(drumsSong, [], ["expert"])).toBe(true);
    expect(songMatchesInstrumentDifficulty(drumsSong, [], ["easy"])).toBe(false);
  });

  it("matches on instrument alone using song.instruments", () => {
    expect(songMatchesInstrumentDifficulty(drumsSong, ["drums"], [])).toBe(true);
    expect(songMatchesInstrumentDifficulty(drumsSong, ["bass"], [])).toBe(false);
  });

  it("requires the selected instrument to cover the selected difficulty", () => {
    // drums covers expert
    expect(songMatchesInstrumentDifficulty(drumsSong, ["drums"], ["expert"])).toBe(true);
    // guitar does not cover expert (only medium)
    expect(songMatchesInstrumentDifficulty(drumsSong, ["guitar"], ["expert"])).toBe(false);
  });

  it("excludes a song lacking chart_coverage when difficulty filters are active", () => {
    const bare = song(3, { instruments: ["drums"] });
    expect(songMatchesInstrumentDifficulty(bare, [], ["expert"])).toBe(false);
    expect(songMatchesInstrumentDifficulty(bare, ["drums"], ["expert"])).toBe(false);
    // but still selectable by instrument alone
    expect(songMatchesInstrumentDifficulty(bare, ["drums"], [])).toBe(true);
  });
});

describe("SONG_TABLE_HEADERS", () => {
  it("keeps the column order SongTableRow hardcodes its <td>s in", () => {
    expect(Object.keys(SONG_TABLE_HEADERS)).toEqual([
      "name",
      "artist",
      "album",
      "year",
      "genre",
      "song_length",
      "bpm_dominant",
      "charter",
      "scores_count",
      "total_plays",
      "last_update"
    ]);
  });
});

describe("getSortValues", () => {
  it("sorts plays numerically, not lexically", () => {
    const [a, b] = getSortValues(
      song(1, { total_plays: 9 }),
      song(2, { total_plays: 100 }),
      "total_plays"
    );
    expect(a).toBe(9);
    expect(b).toBe(100);
    expect(Number(a) < Number(b)).toBe(true);
  });

  it("coerces a null play count to 0 rather than an empty string", () => {
    const [a] = getSortValues(song(1), song(2), "total_plays");
    expect(a).toBe(0);
  });
});

describe("BPM sorting", () => {
  it("sorts dominant BPM numerically", () => {
    const [a, b] = getSortValues(song(1, { bpm_dominant: 95 }), song(2, { bpm_dominant: 180 }), "bpm_dominant");
    expect(Number(a) < Number(b)).toBe(true);
  });

  it("puts songs without BPM after songs with it, whichever way the column is sorted", () => {
    const known = song(1, { bpm_dominant: 120 });
    const unknown = song(2, { bpm_dominant: null });
    expect(compareMissingLast(unknown, known, "bpm_dominant")).toBe(1);
    expect(compareMissingLast(known, unknown, "bpm_dominant")).toBe(-1);
    expect(compareMissingLast(known, song(3, { bpm_dominant: 90 }), "bpm_dominant")).toBe(0);
  });

  it("leaves other columns alone", () => {
    expect(compareMissingLast(song(1), song(2, { year: 2001 }), "year")).toBe(0);
  });
});

describe("formatBpmRange", () => {
  it("shows the tempo range", () => {
    expect(formatBpmRange(song(1, { bpm_dominant: 145, bpm_min: 140, bpm_max: 150 }))).toBe("Min: 140 – Max: 150");
  });

  it("falls back to the dominant BPM when the range is missing", () => {
    expect(formatBpmRange(song(1, { bpm_dominant: 128 }))).toBe("Min: 128 – Max: 128");
  });

  it("explains songs without BPM data", () => {
    expect(formatBpmRange(song(1))).toBe("No BPM data for this chart yet");
  });
});

describe("bpmMarkerPercent", () => {
  it("places the dominant BPM within the range", () => {
    expect(bpmMarkerPercent(song(1, { bpm_dominant: 150, bpm_min: 100, bpm_max: 200 }))).toBe(50);
  });

  it("centres a steady tempo", () => {
    expect(bpmMarkerPercent(song(1, { bpm_dominant: 128, bpm_min: 128, bpm_max: 128 }))).toBe(50);
  });

  it("is null without BPM data", () => {
    expect(bpmMarkerPercent(song(1))).toBeNull();
  });
});
