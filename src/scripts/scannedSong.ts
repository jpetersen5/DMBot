import type { ScannedChart } from "scan-chart";
import type { BpmSummary } from "./bpm.ts";
import { joinPlaylists } from "./playlists.ts";

export interface ScannedSong extends ScannedChart, BpmSummary {
  playlistPath: string;
  folders: string[];
}

/** one row per md5: keep the longest name, list every playlist the chart appears in */
export function mergeByMd5(songs: ScannedSong[]): ScannedSong[] {
  const groups = new Map<string, ScannedSong[]>();
  for (const song of songs) {
    const group = groups.get(song.md5);
    if (group) group.push(song);
    else groups.set(song.md5, [song]);
  }

  return [...groups.values()].map(group => {
    const [keep] = [...group].sort((a, b) =>
      (b.name?.length ?? 0) - (a.name?.length ?? 0) || a.folders[0].length - b.folders[0].length);
    return {
      ...keep,
      playlistPath: joinPlaylists(group.map(song => song.playlistPath)),
      folders: group.flatMap(song => song.folders).sort(),
    };
  });
}
