export interface Song {
  id: number;
  md5: string;
  artist: string | null;
  name: string | null;
  album: string | null;
  track: number | null;
  year: number | null;
  genre: string | null;
  difficulties?: Record<string, number> | null;
  loading_phrase: string | null;
  playlist_path: string | null;
  note_counts?: NoteCount[] | null;
  chart_coverage?: { [instrument: string]: string[] };
  instruments: string[] | null;
  song_length: number | null;
  charter_refs: string[] | null;
  leaderboard?: LeaderboardEntry[] | null;
  scores_count: number | null;
  fc_count: number | null;
  total_plays: number | null;
  bpm_dominant?: number | null;
  bpm_min?: number | null;
  bpm_max?: number | null;
  optimal_score?: number | null;
  paths?: SongPath[] | null;
  last_update: string;
}

export interface PathBreakdown {
  base: number;
  combo: number;
  sp: number;
  solo: number;
  accents: number;
  ghosts: number;
}

/** a Hydra path from songs_new.paths; `path` is Hydra's verbose notation */
export interface SongPath {
  score: number;
  path: string;
  breakdown: PathBreakdown;
}

/** delta-sync envelope returned by GET /api/songs?v=2[&since=...] */
export interface SongDelta {
  server_time: string;
  songs: Song[];
  deleted: { id: number; md5: string }[];
}

/** merge a delta response into an existing song array */
export const mergeSongs = (existing: Song[], delta: SongDelta): Song[] => {
  const byId = new Map<number, Song>(existing.map(song => [song.id, song]));
  for (const song of delta.songs) {
    byId.set(song.id, song);
  }
  for (const tombstone of delta.deleted) {
    byId.delete(tombstone.id);
  }
  return Array.from(byId.values());
};

export const songMatchesInstrumentDifficulty = (
  song: Pick<Song, "instruments" | "chart_coverage">,
  selectedInstruments: string[],
  selectedDifficulties: string[]
): boolean => {
  const hasInstrument =
    selectedInstruments.length === 0 ||
    selectedInstruments.every(instrument => song.instruments?.includes(instrument));

  const hasDifficulty =
    selectedDifficulties.length === 0 ||
    selectedDifficulties.every(difficulty => {
      const coverage = song.chart_coverage;
      if (!coverage) return false;
      const instruments =
        selectedInstruments.length > 0 ? selectedInstruments : Object.keys(coverage);
      return instruments.some(instrument => coverage[instrument]?.includes(difficulty));
    });

  return hasInstrument && hasDifficulty;
};

/** fields searched without filters */
const SEARCH_FIELD_DELIMITER = "\u0000";

/** build haystack of song data to search on */
export const buildSongSearchString = (song: Song): string => {
  const parts: (string | number | null | undefined)[] = [
    song.name,
    song.artist,
    song.album,
    song.year,
    song.genre,
    song.charter_refs?.join(" "),
    song.loading_phrase,
    song.playlist_path
  ];
  return parts
    .map(part => (part == null ? "" : part.toString().toLowerCase()))
    .join(SEARCH_FIELD_DELIMITER);
};

/** multi-term and match */
export const songSearchStringMatches = (searchString: string, terms: string[]): boolean =>
  terms.every(term => searchString.includes(term));

export interface SongExtraData {
  name?: string;
  artist?: string;
  album?: string;
  genre?: string;
  year?: string;
  charter?: string;
  icon?: string;
  song_length?: number;
  diff_band?: number;
  diff_guitar?: number;
  diff_rhythm?: number;
  diff_bass?: number;
  diff_drums?: number;
  diff_drums_real?: number;
  diff_keys?: number;
  album_track?: number;
  loading_phrase?: string;
  notesData?: NotesData;
}

export interface NotesData {
  instruments: string[];
  hasSoloSections: boolean;
  hasLyrics: boolean;
  has2xKick: boolean;
  hasFlexLanes: boolean;
  drumType?: number;
  noteCounts: NoteCount[];
  maxNps: MaxNps[];
}

export interface NoteCount {
  instrument: string;
  difficulty: Difficulty;
  count: number;
}

export interface MaxNps {
  instrument: string;
  difficulty: Difficulty;
  nps: number;
  time: number;
}

export interface LeaderboardEntry {
  rank: number;
  is_fc: boolean;
  score: number;
  speed: number;
  posted?: string;
  percent: number;
  user_id: string;
  username: string;
  play_count?: number;
}

export type Difficulty = "expert" | "hard" | "medium" | "easy";

export const SONG_TABLE_HEADERS = {
  name: "Name",
  artist: "Artist",
  album: "Album",
  year: "Year",
  genre: "Genre",
  song_length: "Length",
  bpm_dominant: "BPM",
  charter: "Charter",
  scores_count: "Scores",
  total_plays: "Plays",
  last_update: "Last Update",
};

export const SONG_DIFFICULTIES = {
  "expert": "X",
  "hard": "H",
  "medium": "M",
  "easy": "E",
};

export const msToTime = (duration: number) => {
  const timeString = new Date(duration).toISOString().substring(11, 19);
  return timeString.replace(/^0{1,2}:(0{1,2})?/, '').replace(/^0/, '');
}

export const msToHourMinSec = (duration: number) => {
  const hours = Math.floor(duration / 3600000);
  const minutes = Math.floor((duration % 3600000) / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export const formatTimeDifference = (lastUpdate: string) => {
  const now = new Date();
  const updateTime = new Date(lastUpdate);
  const diff = now.getTime() - updateTime.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years} year${years > 1 ? "s" : ""} ago`;
  if (months > 0) return `${months} month${months > 1 ? "s" : ""} ago`;
  if (weeks > 0) return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  return `${seconds} second${seconds !== 1 ? "s" : ""} ago`;
};

export const formatExactTime = (lastUpdate: string) => {
  const date = new Date(lastUpdate);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

export const getSurroundingSongIds = (songs: Song[], currentSongId: string) => {
  const currentIndex = songs.findIndex(song => song.id.toString() === currentSongId);
  if (currentIndex === -1) return { prevSongIds: [], nextSongIds: [] };
  const prevSongIds = songs.slice(0, currentIndex).map(song => song.id.toString());
  const nextSongIds = songs.slice(currentIndex + 1).map(song => song.id.toString());
  return { prevSongIds, nextSongIds };
};

export const getSortValues = (a: Song, b: Song, sortKey: string) => {
  let aValue = a[sortKey as keyof Song];
  let bValue = b[sortKey as keyof Song];
  if (
    sortKey === "year" ||
    sortKey === "song_length" ||
    sortKey === "scores_count" ||
    sortKey === "total_plays" ||
    sortKey === "fc_count" ||
    sortKey === "bpm_dominant"
  ) {
    aValue = aValue ? parseInt(aValue.toString()) : 0;
    bValue = bValue ? parseInt(bValue.toString()) : 0;
  } else {
    aValue = aValue ? aValue.toString().toLowerCase() : "";
    bValue = bValue ? bValue.toString().toLowerCase() : "";
  }
  return [aValue, bValue];
};

/** columns where a missing value means "not known yet" rather than zero */
const MISSING_LAST_KEYS = new Set(["bpm_dominant"]);

/** sorts unknown values after known ones regardless of sort direction; 0 when both or neither are known */
export const compareMissingLast = (a: Song, b: Song, sortKey: string): number => {
  if (!MISSING_LAST_KEYS.has(sortKey)) return 0;
  const aMissing = a[sortKey as keyof Song] == null;
  const bMissing = b[sortKey as keyof Song] == null;
  return Number(aMissing) - Number(bMissing);
};

type BpmFields = Pick<Song, "bpm_dominant" | "bpm_min" | "bpm_max">;

export const formatBpmRange = (song: BpmFields): string => {
  if (song.bpm_dominant == null) return "No BPM data for this chart yet";
  return `Min: ${song.bpm_min ?? song.bpm_dominant} – Max: ${song.bpm_max ?? song.bpm_dominant}`;
};

/** where the dominant BPM sits between min and max, as a percentage for the range bar */
export const bpmMarkerPercent = (song: BpmFields): number | null => {
  if (song.bpm_dominant == null) return null;
  const min = song.bpm_min ?? song.bpm_dominant;
  const max = song.bpm_max ?? song.bpm_dominant;
  if (max <= min) return 50;
  return Math.min(100, Math.max(0, ((song.bpm_dominant - min) / (max - min)) * 100));
};