import React, { useState, useEffect } from "react";
import LoadingSpinner from "../../Loading/LoadingSpinner";
import { Achievement, AchievementCategory, getCategoryName } from "../../../utils/achievement";
import AchievementIcon from "./AchievementIcon";
import { API_URL } from "../../../App";
import "./UserAchievements.scss";

interface UserAchievementsProps {
  userId: string;
}

const UserAchievements: React.FC<UserAchievementsProps> = ({ userId }) => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeCategory, setActiveCategory] = useState<AchievementCategory | "all">("all");
  
  useEffect(() => {
    fetchAchievements();
  }, [userId]);

  const fetchAchievements = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/user/${userId}/achievements`);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data = await response.json();
      setAchievements(data.achievements || []);
    } catch (error) {
      console.error("Error fetching achievements:", error);
    } finally {
      setLoading(false);
    }
  };

  const achievementsByCategory = achievements.reduce((acc, achievement) => {
    const category = achievement.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(achievement);
    return acc;
  }, {} as Record<AchievementCategory, Achievement[]>);

  const filteredAchievements = activeCategory === "all" 
    ? achievements 
    : achievementsByCategory[activeCategory] || [];

  return (
    <div className="user-achievements">
      <div className="achievements-header">
        <h2>User Achievements</h2>
        <div className="category-tabs">
          <button 
            className={`category-tab ${activeCategory === "all" ? "active" : ""}`}
            onClick={() => setActiveCategory("all")}
          >
            All
          </button>
          {Object.values(AchievementCategory).map(category => (
            <button 
              key={category}
              className={`category-tab ${activeCategory === category ? "active" : ""}`}
              onClick={() => setActiveCategory(category)}
            >
              {getCategoryName(category)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading achievements..." />
      ) : filteredAchievements.length === 0 ? (
        <div className="no-achievements">
          <p>No achievements found in this category.</p>
          {activeCategory === "all" && achievements.length === 0 && (
            <>
              <p>Play songs and upload your scores to earn achievements</p>
              <p>Think you're missing some? Try reuploading!</p>
            </>
          )}
        </div>
      ) : (
        <div className="achievements-grid">
          {activeCategory === "all" ? (
            Object.entries(achievementsByCategory).map(([category, categoryAchievements]) => (
              <div key={category} className="category-section">
                <h3>{getCategoryName(category as AchievementCategory)}</h3>
                <div className="achievement-items">
                  {categoryAchievements.map(achievement => (
                    <AchievementIcon 
                      key={achievement.id}
                      achievement={achievement}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="achievement-items">
              {filteredAchievements.map(achievement => (
                <AchievementIcon 
                  key={achievement.id}
                  achievement={achievement}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserAchievements; 