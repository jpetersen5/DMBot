/** buckets for a user's leaderboard placements (not global elo standing) */

export interface PlaceBucket {
  key: string;
  label: string;
  min: number;
  max: number;
}

export const PLACE_BUCKETS: PlaceBucket[] = [
  { key: "1", label: "1st", min: 1, max: 1 },
  { key: "2", label: "2nd", min: 2, max: 2 },
  { key: "3", label: "3rd", min: 3, max: 3 },
  { key: "4-5", label: "4th–5th", min: 4, max: 5 },
  { key: "6-10", label: "6th–10th", min: 6, max: 10 },
  { key: "11-25", label: "11th–25th", min: 11, max: 25 },
  { key: "26+", label: "26th+", min: 26, max: Infinity }
];

/** bucket key for a placement, or null when the score is unranked */
export const bucketForPlace = (place: number | null | undefined): string | null => {
  if (!place || place < 1) return null;
  return PLACE_BUCKETS.find(bucket => place >= bucket.min && place <= bucket.max)?.key ?? null;
};

export interface PlaceDistributionResult {
  counts: Record<string, number>;
  unranked: number;
  total: number;
}

export const buildPlaceDistribution = (
  scores: { rank?: number | null }[]
): PlaceDistributionResult => {
  const counts: Record<string, number> = Object.fromEntries(
    PLACE_BUCKETS.map(bucket => [bucket.key, 0])
  );
  let unranked = 0;

  for (const score of scores) {
    const key = bucketForPlace(score.rank);
    if (key) counts[key]++;
    else unranked++;
  }

  return { counts, unranked, total: scores.length };
};

export const toggleBucket = (selected: string[], key: string): string[] =>
  selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key];

/** all scores when nothing is selected, otherwise only those in a selected bucket */
export const filterByBuckets = <T extends { rank?: number | null }>(scores: T[], selected: string[]): T[] => {
  if (selected.length === 0) return scores;
  return scores.filter(score => {
    const key = bucketForPlace(score.rank);
    return key !== null && selected.includes(key);
  });
};
