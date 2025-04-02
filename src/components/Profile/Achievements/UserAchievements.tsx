import React, { useState, useEffect } from "react";
import LoadingSpinner from "../../Loading/LoadingSpinner";
import { 
  Achievement, 
  AchievementCategory, 
  AchievementGroup,
  getCategoryName, 
  getGroupName,
  inferAchievementGroup
} from "../../../utils/achievement";
import AchievementIcon from "./AchievementIcon";
import { API_URL } from "../../../App";
import "./UserAchievements.scss";

interface UserAchievementsProps {
  userId: string;
}

interface AchievementCounts {
  achieved: number;
  total: number;
}

interface CategoryCounts {
  [key: string]: AchievementCounts;
}

interface GroupCounts {
  [category: string]: {
    [group: string]: AchievementCounts;
  };
}

const UserAchievements: React.FC<UserAchievementsProps> = ({ userId }) => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeCategory, setActiveCategory] = useState<AchievementCategory | "all">("all");
  const [viewMode, setViewMode] = useState<"compact" | "list">("list");
  const [showOnlyAchieved, setShowOnlyAchieved] = useState<boolean>(false);
  const [totalCounts, setTotalCounts] = useState<AchievementCounts>({ achieved: 0, total: 0 });
  const [categoryCounts, setCategoryCounts] = useState<CategoryCounts>({});
  const [groupCounts, setGroupCounts] = useState<GroupCounts>({});
  
  useEffect(() => {
    fetchAchievements();
  }, [userId]);

  useEffect(() => {
    if (achievements.length > 0) {
      calculateCounts();
    }
  }, [achievements]);

  const fetchAchievements = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/user/${userId}/achievements`);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data = await response.json();
      
      const processedAchievements = (data.achievements || []).map((achievement: Achievement) => ({
        ...achievement,
        group: achievement.group || inferAchievementGroup(achievement)
      }));
      
      setAchievements(processedAchievements);
    } catch (error) {
      console.error("Error fetching achievements:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateCounts = () => {
    const achieved = achievements.filter(a => a.achieved).length;
    const total = achievements.length;
    setTotalCounts({ achieved, total });

    const tempCategoryCounts: CategoryCounts = {};
    Object.values(AchievementCategory).forEach(category => {
      const categoryAchievements = achievements.filter(a => a.category === category);
      const categoryAchieved = categoryAchievements.filter(a => a.achieved).length;
      tempCategoryCounts[category] = {
        achieved: categoryAchieved,
        total: categoryAchievements.length
      };
    });
    setCategoryCounts(tempCategoryCounts);

    const tempGroupCounts: GroupCounts = {};
    Object.values(AchievementCategory).forEach(category => {
      if (!tempGroupCounts[category]) {
        tempGroupCounts[category] = {};
      }

      const categoryAchievements = achievements.filter(a => a.category === category);
      const groups = [...new Set(categoryAchievements.map(a => a.group || inferAchievementGroup(a)))];
      
      groups.forEach(group => {
        const groupAchievements = categoryAchievements.filter(a => (a.group || inferAchievementGroup(a)) === group);
        const groupAchieved = groupAchievements.filter(a => a.achieved).length;
        tempGroupCounts[category][group] = {
          achieved: groupAchieved,
          total: groupAchievements.length
        };
      });
    });
    setGroupCounts(tempGroupCounts);
  };

  const renderCountBadge = (counts: AchievementCounts) => {
    const { achieved, total } = counts;
    if (achieved === total && total > 0) {
      return <span className="achievement-count complete">👑</span>;
    }
    return <span className="achievement-count">{achieved}/{total}</span>;
  };

  const filterRankedAchievements = (achievements: Achievement[]): Achievement[] => {
    const achievementGroups: { [key: string]: Achievement[] } = {};
    
    achievements.forEach(achievement => {
      if (achievement.group === AchievementGroup.Score || 
          achievement.group === AchievementGroup.FullCombo ||
          achievement.group === AchievementGroup.Charter || 
          achievement.group === AchievementGroup.Special) {
        return;
      }
      
      let baseName = achievement.name;
      const rankMatch = achievement.name.match(/ (I|II|III|IV)$/);
      if (rankMatch) {
        baseName = achievement.name.substring(0, achievement.name.length - rankMatch[0].length);
      }
      
      const identifier = `${achievement.category}_${achievement.group}_${baseName}`;
      
      if (!achievementGroups[identifier]) {
        achievementGroups[identifier] = [];
      }
      achievementGroups[identifier].push(achievement);
    });
    
    const result: Achievement[] = [];
    
    achievements.forEach(achievement => {
      if (achievement.group === AchievementGroup.Score || 
          achievement.group === AchievementGroup.FullCombo ||
          achievement.group === AchievementGroup.Charter || 
          achievement.group === AchievementGroup.Special) {
        result.push(achievement);
      }
    });
    
    Object.values(achievementGroups).forEach(group => {
      const sortedGroup = [...group].sort((a, b) => a.rank - b.rank);
      
      const highestAchieved = [...sortedGroup]
        .filter(a => a.achieved)
        .sort((a, b) => b.rank - a.rank)[0];
      
      if (highestAchieved) {
        result.push(highestAchieved);
      } else {
        const lowestRank = sortedGroup[0];
        result.push(lowestRank);
      }
    });
    
    return result;
  };

  const filteredAchievements = React.useMemo(() => {
    let filtered = achievements;
    if (activeCategory !== "all") {
      filtered = filtered.filter(achievement => achievement.category === activeCategory);
    }
    
    if (showOnlyAchieved) {
      filtered = filtered.filter(achievement => achievement.achieved);
    }
    
    filtered = filterRankedAchievements(filtered);
    
    return filtered;
  }, [achievements, activeCategory, showOnlyAchieved]);

  const achievementsByCategory = React.useMemo(() => {
    return filteredAchievements.reduce((acc, achievement) => {
      const category = achievement.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(achievement);
      return acc;
    }, {} as Record<AchievementCategory, Achievement[]>);
  }, [filteredAchievements]);

  const renderAchievementListItem = (achievement: Achievement) => {
    const date = achievement.timestamp 
      ? new Date(achievement.timestamp).toLocaleDateString() 
      : "";
    
    return (
      <div key={achievement.id} className={`achievement-list-item ${achievement.achieved ? "achieved" : "locked"}`}>
        <div className="achievement-icon-container">
          <AchievementIcon achievement={achievement} />
        </div>
        <div className="achievement-details">
          <h4 className="achievement-title">{achievement.name}</h4>
          <p className="achievement-description">{achievement.description}</p>
          {date && <p className="achievement-date">Achieved on {date}</p>}
        </div>
      </div>
    );
  };

  const renderCompactView = () => {
    return (
      <div className="achievements-grid">
        {activeCategory === "all" ? (
          Object.entries(achievementsByCategory).map(([category, categoryAchievements]) => (
            <div key={category} className="category-section">
              <h3>
                {getCategoryName(category as AchievementCategory)}
                {categoryCounts[category] && renderCountBadge(categoryCounts[category])}
              </h3>
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
    );
  };

  const renderListView = () => {
    if (activeCategory === "all") {
      return (
        <div className="achievements-list">
          {Object.entries(achievementsByCategory).map(([category, categoryAchievements]) => {
            const categoryEnum = category as AchievementCategory;
            
            const achievementsByGroup = categoryAchievements.reduce((groups, achievement) => {
              const group = achievement.group || inferAchievementGroup(achievement);
              if (!groups[group]) {
                groups[group] = [];
              }
              groups[group].push(achievement);
              return groups;
            }, {} as Record<AchievementGroup, Achievement[]>);
            
            return (
              <div key={category} className="category-section">
                <h3>
                  {getCategoryName(categoryEnum)}
                  {categoryCounts[category] && renderCountBadge(categoryCounts[category])}
                </h3>
                
                {Object.entries(achievementsByGroup).map(([groupKey, groupAchievements]) => {
                  const group = groupKey as AchievementGroup;
                  
                  const sortedAchievements = [...groupAchievements].sort((a, b) => {
                    if (a.achieved && !b.achieved) return -1;
                    if (!a.achieved && b.achieved) return 1;
                    
                    if (a.level !== b.level) {
                      return (a.level || 0) - (b.level || 0);
                    }
                    
                    return a.rank - b.rank;
                  });
                  
                  const groupCountsData = groupCounts[category]?.[group];
                  
                  return (
                    <div key={`${category}-${groupKey}`} className="achievement-subgroup">
                      <h4>
                        {getGroupName(group)}
                        {groupCountsData && renderCountBadge(groupCountsData)}
                      </h4>
                      <div className="achievement-list-grid">
                        {sortedAchievements.map(renderAchievementListItem)}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      );
    } else {
      const achievementsByGroup = filteredAchievements.reduce((groups, achievement) => {
        const group = achievement.group || inferAchievementGroup(achievement);
        if (!groups[group]) {
          groups[group] = [];
        }
        groups[group].push(achievement);
        return groups;
      }, {} as Record<AchievementGroup, Achievement[]>);
      
      return (
        <div className="achievements-list">
          {Object.entries(achievementsByGroup).map(([groupKey, groupAchievements]) => {
            const group = groupKey as AchievementGroup;
            
            const sortedAchievements = [...groupAchievements].sort((a, b) => {
              if (a.achieved && !b.achieved) return -1;
              if (!a.achieved && b.achieved) return 1;
              
              if (a.level !== b.level) {
                return (a.level || 0) - (b.level || 0);
              }
              
              return a.rank - b.rank;
            });
            
            const groupCountsData = groupCounts[activeCategory]?.[group];
            
            return (
              <div key={`${activeCategory}-${groupKey}`} className="achievement-subgroup">
                <h4>
                  {getGroupName(group)}
                  {groupCountsData && renderCountBadge(groupCountsData)}
                </h4>
                <div className="achievement-list-grid">
                  {sortedAchievements.map(renderAchievementListItem)}
                </div>
              </div>
            );
          })}
        </div>
      );
    }
  };

  return (
    <div className="user-achievements">
      <div className="achievements-header">
        <div className="header-row">
          <h2>
            User Achievements
            {!loading && renderCountBadge(totalCounts)}
          </h2>
          <div className="view-controls">
            <div className="view-toggle">
              <button 
                className={`view-mode-btn ${viewMode === "list" ? "active" : ""}`} 
                onClick={() => setViewMode("list")}
                title="List View"
              >
                <span>List</span>
              </button>
              <button 
                className={`view-mode-btn ${viewMode === "compact" ? "active" : ""}`} 
                onClick={() => setViewMode("compact")}
                title="Compact View"
              >
                <span>Grid</span>
              </button>
            </div>
            <div className="filter-toggle">
              <button 
                className={`filter-btn ${showOnlyAchieved ? "active" : ""}`}
                onClick={() => setShowOnlyAchieved(!showOnlyAchieved)}
                title={showOnlyAchieved ? "Show All Achievements" : "Show Only Achieved"}
              >
                {showOnlyAchieved ? "Show All" : "Show Achieved"}
              </button>
            </div>
          </div>
        </div>
        <div className="category-tabs">
          <button 
            className={`category-tab ${activeCategory === "all" ? "active" : ""}`}
            onClick={() => setActiveCategory("all")}
          >
            All
            {!loading && renderCountBadge(totalCounts)}
          </button>
          {Object.values(AchievementCategory).map(category => (
            <button 
              key={category}
              className={`category-tab ${activeCategory === category ? "active" : ""}`}
              onClick={() => setActiveCategory(category)}
            >
              {getCategoryName(category)}
              {categoryCounts[category] && renderCountBadge(categoryCounts[category])}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading achievements..." />
      ) : filteredAchievements.length === 0 ? (
        <div className="no-achievements">
          {showOnlyAchieved ? (
            <p>No achievements unlocked in this category yet. Keep playing to earn achievements!</p>
          ) : (
            <p>No achievements found in this category.</p>
          )}
        </div>
      ) : (
        viewMode === "compact" ? renderCompactView() : renderListView()
      )}
    </div>
  );
};

export default UserAchievements; 