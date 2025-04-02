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

const formatThresholdValue = (name: string, rank: number): string => {
  if (name.includes("Score Recruit")) return "2M";
  if (name.includes("Score Semi-Pro")) return "10M";
  if (name.includes("Score Adept")) return "50M";
  if (name.includes("Score Veteran")) return "200M";
  if (name.includes("Score Master")) return "1B";
  if (name.includes("Scorer")) return "3B";
  
  if (name.includes("FC Recruit")) return "10";
  if (name.includes("FC Semi-Pro")) return "25";
  if (name.includes("FC Adept")) return "50";
  if (name.includes("FC Veteran")) return "200";
  if (name.includes("FC Master")) return "500";
  if (name.includes("FCer")) return "1K";
  
  return getRankName(rank);
};

interface AchievementIconProps {
  achievement: Achievement;
}

const AchievementIcon: React.FC<AchievementIconProps> = ({ achievement }) => {
  const { name, description, rank, achieved, category } = achievement;
  
  const hasRank = rank > 0;
  
  const isThresholdAchievement = name.includes("Score") || name.includes("FC");
  const rankLabel = isThresholdAchievement ? 
    formatThresholdValue(name, rank) : 
    (hasRank ? getRankName(rank) : "");
  
  const icon = getCategoryIcon(category, name);
  
  const displayName = hasRank && rank > 1 && !isThresholdAchievement ? 
    `${name} ${getRankName(rank)}` : name;
  
  const tooltipContent = (
    <div className="achievement-tooltip">
      <h4 className="achievement-name">{displayName}</h4>
      <p className="achievement-description">{description}</p>
      {!achieved && <p className="achievement-locked">Not yet achieved</p>}
      {achievement.timestamp && (
        <p className="achievement-timestamp">
          Achieved on {new Date(achievement.timestamp).toLocaleDateString()}
        </p>
      )}
    </div>
  );
  
  return (
    <Tooltip content={tooltipContent}>
      <div className={`achievement-icon ${achieved ? "achieved" : "locked"}`}>
        <div className="icon-background">
          <span className="icon">{icon}</span>
        </div>
        {hasRank && (
          <div className={`rank-overlay ${isThresholdAchievement ? "threshold" : ""}`}>
            {rankLabel}
          </div>
        )}
      </div>
    </Tooltip>
  );
};

export default AchievementIcon; 