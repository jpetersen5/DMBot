import React, { createContext, useContext, useState, ReactNode } from "react";
import { Achievement } from "../utils/achievement";
import { useUploadProgress } from "../hooks/useUploadProgress";

interface AchievementContextType {
  showAchievement: (achievement: Achievement) => void;
  achievements: Achievement[];
  clearAchievement: (achievementId: string) => void;
  clearAllAchievements: () => void;
}

const AchievementContext = createContext<AchievementContextType | undefined>(undefined);

export const useAchievements = () => {
  const context = useContext(AchievementContext);
  if (!context) {
    throw new Error("useAchievements must be used within an AchievementProvider");
  }
  return context;
};

interface AchievementProviderProps {
  children: ReactNode;
}

export const AchievementProvider: React.FC<AchievementProviderProps> = ({ children }) => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const { newAchievements, clearAchievement: clearUploadAchievement } = useUploadProgress();
  
  React.useEffect(() => {
    if (newAchievements.length > 0) {
      const newAchievementsToShow = newAchievements.filter(
        newAchievement => !achievements.some(a => a.id === newAchievement.id)
      );
      
      if (newAchievementsToShow.length > 0) {
        setAchievements(prev => [...prev, ...newAchievementsToShow]);
      }
    }
  }, [newAchievements, achievements]);
  
  const showAchievement = (achievement: Achievement) => {
    if (!achievements.some(a => a.id === achievement.id)) {
      setAchievements(prev => [...prev, achievement]);
    }
  };
  
  const clearAchievement = (achievementId: string) => {
    setAchievements(prev => prev.filter(a => a.id !== achievementId));
    clearUploadAchievement(achievementId);
  };
  
  const clearAllAchievements = () => {
    setAchievements([]);
    
    newAchievements.forEach(achievement => {
      clearUploadAchievement(achievement.id);
    });
  };
  
  const value = {
    showAchievement,
    achievements,
    clearAchievement,
    clearAllAchievements
  };
  
  return (
    <AchievementContext.Provider value={value}>
      {children}
    </AchievementContext.Provider>
  );
}; 