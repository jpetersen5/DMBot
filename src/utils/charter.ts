export interface Charter {
    id: string;
    name: string;
    colorized_name: string | null;
    user_id: string | null;
    charter_stats: CharterStatsData;
}

export interface CharterStatsData {
  total_songs: number;
  total_length: number;
  avg_length: number;
  total_scores: number;
  avg_scores: number;
  difficulty_distribution: { [key: string]: number };
  genre_distribution: { [key: string]: number };
  year_distribution: { [key: string]: number };
  most_common_artist: string;
  last_updated: string;
}