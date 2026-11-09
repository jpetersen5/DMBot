import { describe, it, expect } from "vitest";
import { playlistFor, joinPlaylists } from "./playlists.ts";

const p = (...segments: string[]) => playlistFor(segments.join("\\"));

describe("playlistFor", () => {
  it.each([
    [["Synced Charts", "Sync Charts", "BirdmanExe Drive", "Xane60", "The Agonist - Thank You, Pain"], "BirdmanExe Sync Drive"],
    [["Synced Charts", "Sync Charts", "Drummer's Monthly Drive", "MathRabelo", "After The Burial - Pennyweight"], "Drummer's Monthly Sync Drive"],
    [["Synced Charts", "Sync Charts", "Misc", "DM Meme Drive", "Song"], "Drummer's Monthly Meme Drive"],
    [["Synced Charts", "Sync Charts", "Misc", "Drumb n' Geet Charts", "Song"], "Drumb n' Geet"],
    [["Synced Charts", "Sync Charts", "Misc", "HopH2O Discography Charts", "Song"], "Chorus"],
    [["Synced Charts", "Sync Charts", "Popular Charters", "Miscellany", "V", "Various", "Endless Setlist Folder", "Song"], "Chorus"],
    [["Downloaded Charts", "Archived Birdman", "ApocalypseAP", "Song"], "BirdmanExe Archived"],
    [["Downloaded Charts", "Extra", "Yes - Roundabout"], "Misc"],
  ])("maps %j to %s", (segments, expected) => {
    expect(p(...segments)).toBe(expected);
  });

  it.each([
    ["Rock Band 1 DLC", "Rock Band 1"],
    ["(2007) Rock Band 1", "Rock Band 1"],
    ["Rock Band 4 DLC", "Rock Band 4"],
    ["Rock Band Network", "Rock Band Network"],
    ["Rock Band Network (RB4)", "Rock Band Network"],
    ["(2016) Rock Band Rivals", "Rock Band 4"],
    ["(2017) Rock Band VR", "Rock Band 4"],
    ["(2009) Lego Rock Band", "Lego Rock Band"],
    ["(2010) Green Day Rock Band", "Green Day Rock Band"],
    ["Rock Band ACDC Live Track Pack", "Rock Band AC/DC"],
    ["(2012) Rock Band Blitz", "Rock Band Blitz"],
  ])("names Rock Band folder %s as %s", (folder, expected) => {
    expect(p("Rock Band", folder, "Some Song")).toBe(expected);
    expect(p("Rock Band", folder, "Nested", "Some Song")).toBe(expected);
  });

  it.each([
    [["(2006) Guitar Hero II", "Guitar Hero II", "Song"], "Guitar Hero II"],
    [["(2007) Guitar Hero III - Legends of Rock", "Quickplay", "Song"], "Guitar Hero III - Legends of Rock"],
    [["(2009) Band Hero", "Band Hero 2 Full Band", "Song"], "Band Hero"],
    [["(2015) Guitar Hero Live", "Arctic Monkeys - R U Mine"], "Guitar Hero Live"],
  ])("names Guitar Hero path %j as %s", (segments, expected) => {
    expect(p("Guitar Hero", ...segments)).toBe(expected);
  });

  describe("tournaments", () => {
    const dm = ["Synced Charts", "Sync Charts", "Drummer's Monthly Drive", "Tournaments"];

    it("names DM drive setlists by tournament and tier, not the drive", () => {
      expect(p(...dm, "Summer Blast 2024 Setlist", "Tier 6", "Song")).toBe("Tournament - Summer Blast 2024 Setlist - Tier 6");
    });

    it("expands abbreviated tiers", () => {
      expect(p(...dm, "Icebreaker 2024 Setlist", "T2", "Song")).toBe("Tournament - Icebreaker 2024 Setlist - Tier 2");
      expect(p(...dm, "Summer Blast 2023 Setlist", "Base Setlist", "T1", "Song")).toBe("Tournament - Summer Blast 2023 Setlist - Base Setlist - Tier 1");
    });

    it("drops a group folder its tier folder already repeats", () => {
      expect(p(...dm, "Icebreaker 2023 Setlist", "Base Setlist", "Base Setlist T3", "Song")).toBe("Tournament - Icebreaker 2023 Setlist - Base Setlist T3");
      expect(p(...dm, "BirdmanExe Drum Tournament", "Sudden Death", "Sudden Death Tier 1", "Song")).toBe("Tournament - BirdmanExe Drum Tournament - Sudden Death Tier 1");
    });

    it("keeps named rounds", () => {
      expect(p(...dm, "Conquest Contenders 2 Setlist", "6 - Spike!", "Song")).toBe("Tournament - Conquest Contenders 2 Setlist - 6 - Spike!");
    });

    it("omits the tier when songs sit directly in the setlist", () => {
      expect(p(...dm, "Clonpardy Song Bank", "Song")).toBe("Tournament - Clonpardy Song Bank");
    });

    it("recognises setlists downloaded outside the drive", () => {
      expect(p("Downloaded Charts", "Icebreaker 2026 Setlist", "Tier 3", "Song")).toBe("Tournament - Icebreaker 2026 Setlist - Tier 3");
    });

    it("does not treat a chart pack named setlist as a tournament", () => {
      expect(p("Synced Charts", "Sync Charts", "Popular Charters", "Miscellany", "Endless Setlist Folder", "Song")).toBe("Chorus");
    });
  });

  it("is case-insensitive and accepts forward slashes", () => {
    expect(playlistFor("synced charts/sync charts/birdmanexe drive/a/b")).toBe("BirdmanExe Sync Drive");
  });

  it("leaves unknown folders unnamed", () => {
    expect(p("Somewhere Else", "Song")).toBe("");
  });
});

describe("joinPlaylists", () => {
  it("dedupes, drops blanks, and lists tournaments after regular playlists", () => {
    expect(joinPlaylists([
      "Tournament - Icebreaker 2024 Setlist - Tier 2",
      "",
      "Drummer's Monthly Sync Drive",
      "Drummer's Monthly Sync Drive",
      "BirdmanExe Sync Drive",
    ])).toBe("BirdmanExe Sync Drive,Drummer's Monthly Sync Drive,Tournament - Icebreaker 2024 Setlist - Tier 2");
  });
});
