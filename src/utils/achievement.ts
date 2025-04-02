export interface Achievement {
  id: string;
  name: string;
  description: string;
  rank: number;
  category: AchievementCategory;
  achieved: boolean;
  timestamp?: string;
  level?: number;
  group?: AchievementGroup;
  song_md5?: string | string[];
}

export enum AchievementCategory {
  General = "general",
  Hands = "hands",
  Blend = "blend",
  Kicks = "kicks"
}

export enum AchievementGroup {
  Score = "score",
  FullCombo = "full_combo",
  Charter = "charter",
  Special = "special",
  
  Level1 = "level1",
  Level2 = "level2",
  Level3 = "level3",
  Level4 = "level4",
  Level5 = "level5",
  Level6 = "level6",
  Level7 = "level7",
  Level8 = "level8",
  Level9 = "level9",
  Level10 = "level10",
  Level11 = "level11",
  Level12 = "level12",
  Level13 = "level13",
  Level14 = "level14",
  Level15 = "level15",
  Level16 = "level16",

  Error = "error"
}

export interface UserAchievements {
  achievements: Achievement[];
}

export function getRankName(rank: number): string {
  switch (rank) {
    case 1: return "I";
    case 2: return "II";
    case 3: return "III";
    case 4: return "IV";
    default: return "";
  }
}

export function getCategoryName(category: AchievementCategory): string {
  switch (category) {
    case AchievementCategory.General: return "General";
    case AchievementCategory.Hands: return "Hands";
    case AchievementCategory.Blend: return "Blend";
    case AchievementCategory.Kicks: return "Kicks";
    default: return "";
  }
}

export function getGroupName(group: AchievementGroup): string {
  switch (group) {
    case AchievementGroup.Score: return "Score Achievements";
    case AchievementGroup.FullCombo: return "Full Combo Achievements";
    case AchievementGroup.Charter: return "Charter Achievements";
    case AchievementGroup.Special: return "Special Achievements";
    
    case AchievementGroup.Level1: return "Level 1";
    case AchievementGroup.Level2: return "Level 2";
    case AchievementGroup.Level3: return "Level 3";
    case AchievementGroup.Level4: return "Level 4";
    case AchievementGroup.Level5: return "Level 5";
    case AchievementGroup.Level6: return "Level 6";
    case AchievementGroup.Level7: return "Level 7";
    case AchievementGroup.Level8: return "Level 8";
    case AchievementGroup.Level9: return "Level 9";
    case AchievementGroup.Level10: return "Level 10";
    case AchievementGroup.Level11: return "Level 11";
    case AchievementGroup.Level12: return "Level 12";
    case AchievementGroup.Level13: return "Level 13";
    case AchievementGroup.Level14: return "Level 14";
    case AchievementGroup.Level15: return "Level 15";
    default: return "";
  }
}

export function inferAchievementGroup(achievement: Achievement): AchievementGroup {
  if (achievement.group) {
    return achievement.group;
  }
  
  if (achievement.category === AchievementCategory.General) {
    if (achievement.name.includes("Score")) {
      return AchievementGroup.Score;
    } else if (achievement.name.includes("FC")) {
      return AchievementGroup.FullCombo;
    } else if (achievement.name.includes("Apprentice") || achievement.name === "Hurray, Recharts!" || achievement.name === "Remix Apprentice") {
      return AchievementGroup.Charter;
    } else {
      return AchievementGroup.Special;
    }
  }
  
  return AchievementGroup.Error;
} 