import React from "react";
import { useNavigate } from "react-router-dom";
import { useAchievements } from "../../context/AchievementContext";
import AchievementToastContainer from "./AchievementToastContainer";

const AchievementToastsWrapper: React.FC = () => {
  const { achievements, clearAchievement, clearAllAchievements } = useAchievements();
  const navigate = useNavigate();
  
  const handleNavigate = (path: string) => {
    navigate(path);
  };
  
  return (
    <AchievementToastContainer 
      achievements={achievements}
      onClear={clearAchievement}
      onClearAll={clearAllAchievements}
      onNavigate={handleNavigate}
    />
  );
};

export default AchievementToastsWrapper; 