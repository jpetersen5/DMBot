import { Song } from "./song";

/** Structured tokens inside the song search box. */

export type BpmQuery =
  /** `bpm:240` - dominant BPM within +/- BPM_TOLERANCE */
  | { kind: "exact"; value: number }
  /** `bpm:200-260` - the song's [min,max] span overlaps the requested band */
  | { kind: "range"; lo: number; hi: number }
  | { kind: "gt"; value: number }
  | { kind: "lt"; value: number };

export interface ParsedQuery {
  terms: string[];
  bpm?: BpmQuery;
}

export const BPM_TOLERANCE = 5;

const BPM_TOKEN = /^bpm:(.+)$/i;

const toNumber = (raw: string): number | null => {
  if (!/^\d+(\.\d+)?$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

const parseBpmValue = (raw: string): BpmQuery | null => {
  const rangeMatch = raw.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    const lo = toNumber(rangeMatch[1]);
    const hi = toNumber(rangeMatch[2]);
    if (lo == null || hi == null) return null;
    return { kind: "range", lo: Math.min(lo, hi), hi: Math.max(lo, hi) };
  }

  if (raw.startsWith(">")) {
    const value = toNumber(raw.slice(1));
    return value == null ? null : { kind: "gt", value };
  }

  if (raw.startsWith("<")) {
    const value = toNumber(raw.slice(1));
    return value == null ? null : { kind: "lt", value };
  }

  const value = toNumber(raw);
  return value == null ? null : { kind: "exact", value };
};

/** split a raw search string into structured tokens and plain terms. */
export const parseSongQuery = (input: string): ParsedQuery => {
  const terms: string[] = [];
  let bpm: BpmQuery | undefined;

  for (const token of input.toLowerCase().split(" ")) {
    if (!token) continue;

    const match = token.match(BPM_TOKEN);
    if (match) {
      const parsed = parseBpmValue(match[1]);
      if (parsed) {
        // last one wins, so retyping the filter replaces it
        bpm = parsed;
        continue;
      }
    }

    terms.push(token);
  }

  return { terms, bpm };
};

export const songMatchesBpm = (
  song: Pick<Song, "bpm_dominant" | "bpm_min" | "bpm_max">,
  query: BpmQuery
): boolean => {
  const dominant = song.bpm_dominant;
  if (dominant == null) return false;

  switch (query.kind) {
    case "exact":
      return Math.abs(dominant - query.value) <= BPM_TOLERANCE;

    case "range": {
      const min = song.bpm_min ?? dominant;
      const max = song.bpm_max ?? dominant;
      return max >= query.lo && min <= query.hi;
    }

    case "gt":
      return dominant > query.value;

    case "lt":
      return dominant < query.value;
  }
};

export const hasUnscannedBpm = (songs: Pick<Song, "bpm_dominant">[]): boolean =>
  songs.some(song => song.bpm_dominant == null);
