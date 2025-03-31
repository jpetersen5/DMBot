export interface Achievement {
  id: string;
  name: string;
  description: string;
  rank: number; // 1-4 for achievements with levels, 1 for one-time achievements
  category: AchievementCategory;
  achieved: boolean;
  timestamp?: string; // When it was achieved
}

export enum AchievementCategory {
  General = "general",
  Hands = "hands",
  Blend = "blend",
  Kicks = "kicks"
}

export interface UserAchievements {
  achievements: Achievement[];
}

// Helper function to get level name
export function getRankName(rank: number): string {
  switch (rank) {
    case 1: return "I";
    case 2: return "II";
    case 3: return "III";
    case 4: return "IV";
    default: return "";
  }
}

// Helper function to get category name
export function getCategoryName(category: AchievementCategory): string {
  switch (category) {
    case AchievementCategory.General: return "General";
    case AchievementCategory.Hands: return "Hands";
    case AchievementCategory.Blend: return "Blend";
    case AchievementCategory.Kicks: return "Kicks";
    default: return "";
  }
} 