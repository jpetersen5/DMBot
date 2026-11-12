/** Maps a song folder (relative to its song root) to the curated playlist name shown on the site. */

const TOURNAMENT_PREFIX = "Tournament - ";

const GAME_ALIASES: Record<string, string> = {
  "rock band network (rb4)": "Rock Band Network",
  "rock band rivals": "Rock Band 4",
  "rock band vr": "Rock Band 4",
  "rock band acdc live track pack": "Rock Band AC/DC",
};

/** [folder path prefix, playlist], checked in order after tournaments */
const PREFIX_RULES: [string[], string][] = [
  [["synced charts", "sync charts", "birdmanexe drive"], "BirdmanExe Sync Drive"],
  [["synced charts", "sync charts", "drummer's monthly drive"], "Drummer's Monthly Sync Drive"],
  [["synced charts", "sync charts", "misc", "dm meme drive"], "Drummer's Monthly Meme Drive"],
  [["synced charts", "sync charts", "misc", "drumb n' geet charts"], "Drumb n' Geet"],
  [["synced charts", "sync charts", "misc", "hoph2o discography charts"], "Chorus"],
  [["synced charts", "sync charts", "popular charters"], "Chorus"],
  [["downloaded charts", "archived birdman"], "BirdmanExe Archived"],
  [["downloaded charts", "extra"], "Misc"],
  [["misc"], "Misc"],
];

const splitPath = (relPath: string): string[] => relPath.split(/[\\/]+/).filter(Boolean);

const startsWith = (segments: string[], prefix: string[]): boolean =>
  prefix.every((part, i) => segments[i]?.toLowerCase() === part);

/** index of the setlist folder, if this song sits inside a tournament setlist */
function setlistIndex(segments: string[]): number {
  const lower = segments.map(s => s.toLowerCase());
  const container = lower.indexOf("tournaments");
  if (container !== -1 && container + 1 < segments.length - 1) return container + 1;
  if (lower[0] === "downloaded charts" && segments.length > 2 && /setlist|tournament/.test(lower[1])) return 1;
  return -1;
}

function tournamentName(segments: string[], setlist: number): string {
  const groups = segments.slice(setlist + 1, -1);
  const kept = groups.filter((group, i) => {
    const child = groups[i + 1];
    return !child || !child.toLowerCase().startsWith(group.toLowerCase());
  });
  const labels = kept.map(group => group.replace(/^t(\d+)$/i, "Tier $1"));
  return [TOURNAMENT_PREFIX + segments[setlist], ...labels].join(" - ");
}

function gameName(folder: string): string {
  const name = folder.replace(/^\(\d{4}\)\s*/, "").replace(/\s+DLC$/i, "").trim();
  return GAME_ALIASES[name.toLowerCase()] ?? name;
}

export function playlistFor(relPath: string): string {
  const segments = splitPath(relPath);
  if (segments.length < 2) return "";

  const setlist = setlistIndex(segments);
  if (setlist !== -1) return tournamentName(segments, setlist);

  for (const [prefix, playlist] of PREFIX_RULES) {
    if (startsWith(segments, prefix)) return playlist;
  }

  const top = segments[0].toLowerCase();
  if ((top === "rock band" || top === "guitar hero") && segments.length > 2) return gameName(segments[1]);

  return "";
}

/** one md5 can live in several folders (e.g. a drive and a tournament setlist) */
export function joinPlaylists(playlists: string[]): string {
  const unique = [...new Set(playlists.filter(Boolean))];
  const isTournament = (name: string) => name.startsWith(TOURNAMENT_PREFIX);
  return unique
    .sort((a, b) => Number(isTournament(a)) - Number(isTournament(b)) || a.localeCompare(b))
    .join(",");
}
