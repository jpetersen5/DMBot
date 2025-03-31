import React from "react";
import Tooltip from "../../../utils/Tooltip/Tooltip";
import { Achievement, AchievementCategory, getRankName } from "../../../utils/achievement";
import "./AchievementIcon.scss";

// Icon mapping based on achievement category
const getCategoryIcon = (category: AchievementCategory, name: string): string => {
  switch (category) {
    case AchievementCategory.General:
      if (name.includes("Score")) return "🏆";
      if (name.includes("FC")) return "👑";
      if (name.includes("Apprentice")) return "📚";
      if (name === "First Score") return "🎮";
      if (name === "The Funny Numbers") return "😂";
      if (name === "Bladder of Steel 2") return "🚽";
      if (name === "???") return "❓";
      return "🎯";
    case AchievementCategory.Hands:
      return "👐";
    case AchievementCategory.Blend:
      return "🎭";
    case AchievementCategory.Kicks:
      return "👟";
    default:
      return "🎮";
  }
};

interface AchievementIconProps {
  achievement: Achievement;
}

const AchievementIcon: React.FC<AchievementIconProps> = ({ achievement }) => {
  const { name, description, rank, achieved, category } = achievement;
  
  const hasRank = rank > 0;
  const rankLabel = hasRank ? getRankName(rank) : "";
  
  // Get appropriate icon
  const icon = getCategoryIcon(category, name);
  
  const displayName = hasRank && rank > 1 ? `${name} ${rankLabel}` : name;
  
  return (
    <Tooltip 
      content={
        <div className="achievement-tooltip">
          <h4 className="achievement-name">{displayName}</h4>
          <p className="achievement-description">{description}</p>
          {achievement.timestamp && (
            <p className="achievement-timestamp">
              Achieved on {new Date(achievement.timestamp).toLocaleDateString()}
            </p>
          )}
        </div>
      }
    >
      <div className={`achievement-icon ${achieved ? "achieved" : "locked"}`}>
        <div className="icon-background">
          <span className="icon">{icon}</span>
        </div>
        {hasRank && (
          <div className="rank-overlay">
            {rankLabel}
          </div>
        )}
      </div>
    </Tooltip>
  );
};

export default AchievementIcon; 