export interface Score {
  rank: number;
  is_fc: boolean;
  score: number;
  speed: number;
  artist: string;
  percent: number;
  song_name: string;
  identifier: string;
  play_count: number;
  posted: string;
}

export interface UnknownScore extends Score {
  filepath: string | null;
}

export interface Scores {
  scores: Score[];
  unknown_scores: UnknownScore[];
}

export const SCORE_TABLE_HEADERS = {
  song_name: "Song",
  artist: "Artist",
  score: "Score",
  percent: "Percent",
  speed: "Speed",
  is_fc: "FC",
  play_count: "Plays",
  posted: "Posted",
  rank: "Rank"
};

export const formatRank = (rank: number): string => {
  if (!rank) return "N/A";
  if (rank % 10 === 1 && rank !== 11) return `${rank}st`;
  if (rank % 10 === 2 && rank !== 12) return `${rank}nd`;
  if (rank % 10 === 3 && rank !== 13) return `${rank}rd`;
  return `${rank}th`;
};

