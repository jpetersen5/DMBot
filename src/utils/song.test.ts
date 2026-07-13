import { describe, it, expect } from "vitest";
import {
  Song,
  SongDelta,
  mergeSongs,
  songMatchesInstrumentDifficulty,
  buildSongSearchString,
  songSearchStringMatches
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
