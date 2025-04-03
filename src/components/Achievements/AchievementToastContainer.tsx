import React from "react";
import { Achievement } from "../../utils/achievement";
import AchievementToast from "./AchievementToast";
import "./AchievementToast.scss";

interface AchievementToastContainerProps {
  achievements: Achievement[];
  onClear: (achievementId: string) => void;
  onClearAll: () => void;
  onNavigate?: (path: string) => void;
}

const AchievementToastContainer: React.FC<AchievementToastContainerProps> = ({
  achievements,
  onClear,
  onClearAll,
  onNavigate
}) => {
  if (achievements.length === 0) {
    return null;
  }
  
  const showClearAllButton = achievements.length > 5;
  
  return (
    <div className="achievement-toasts-container">
      {achievements.map(achievement => (
        <AchievementToast
          key={achievement.id}
          achievement={achievement}
          autoClose={false}
          onClose={() => onClear(achievement.id)}
          onNavigate={onNavigate}
        />
      ))}
      
      {showClearAllButton && (
        <button 
          className="clear-all-button"
          onClick={onClearAll}
        >
          Clear All
        </button>
      )}
    </div>
  );
};

export default AchievementToastContainer; 