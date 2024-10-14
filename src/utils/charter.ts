export interface Charter {
    id: string;
    name: string;
    colorized_name: string | null;
    user_id: string | null;
    charter_stats: CharterStatsData;
    charter_songs: number[];
}

export interface CharterStatsData {
  total_songs: number;
  total_length: number;
  avg_length: number;
  total_scores: number;
  avg_scores: number;
  difficulty_distribution: { [key: string]: DifficultyDistribution };
  genre_distribution: { [key: string]: number };
  year_distribution: { [key: string]: number };
  most_common_artist: string;
  last_updated: string;
}

interface DifficultyDistribution {
  [key: string]: number;
}

