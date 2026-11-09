import { describe, it, expect } from "vitest";
import { mergeByMd5, type ScannedSong } from "./scannedSong.ts";

const song = (md5: string, name: string, folder: string, playlistPath: string) =>
  ({ md5, name, folders: [folder], playlistPath }) as ScannedSong;

describe("mergeByMd5", () => {
  it("keeps one row per md5 with every playlist and folder", () => {
    const [merged, ...rest] = mergeByMd5([
      song("a", "Holy Wars", "Tournaments\\Legacy Cup 2025 Setlist\\Tier 1\\x", "Tournament - Legacy Cup 2025 Setlist - Tier 1"),
      song("a", "Holy Wars...The Punishment Due", "Drummer's Monthly Drive\\Rh\\x", "Drummer's Monthly Sync Drive"),
    ]);
    expect(rest).toEqual([]);
    expect(merged.name).toBe("Holy Wars...The Punishment Due");
    expect(merged.playlistPath).toBe("Drummer's Monthly Sync Drive,Tournament - Legacy Cup 2025 Setlist - Tier 1");
    expect(merged.folders).toHaveLength(2);
  });

  it("prefers the shorter folder path when names tie", () => {
    const deep = { ...song("a", "Song", "a\\b\\c", ""), artist: "deep" };
    const shallow = { ...song("a", "Song", "a\\b", ""), artist: "shallow" };
    expect(mergeByMd5([deep, shallow])[0].artist).toBe("shallow");
  });

  it("leaves distinct charts alone", () => {
    expect(mergeByMd5([song("a", "One", "x", "P"), song("b", "Two", "y", "Q")])).toHaveLength(2);
  });
});
