import React, { useState, useEffect } from "react";
import { Achievement, getRankName } from "../../utils/achievement";
import AchievementIcon from "../Profile/Achievements/AchievementIcon";
import "./AchievementToast.scss";

interface AchievementToastProps {
  achievement: Achievement;
  onClose: () => void;
  onNavigate?: (path: string) => void;
  autoClose?: boolean;
  autoCloseTime?: number;
}

const AchievementToast: React.FC<AchievementToastProps> = ({
  achievement,
  onClose,
  onNavigate,
  autoClose = true,
  autoCloseTime = 5000,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    if (autoClose) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300);
      }, autoCloseTime);
      
      return () => clearTimeout(timer);
    }
  }, [autoClose, autoCloseTime, onClose]);
  
  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };
  
  const handleClick = () => {
    if (!onNavigate) return;
    
    const userId = localStorage.getItem("user_id");
    if (userId && achievement.song_md5) {
      const songId = Array.isArray(achievement.song_md5) 
        ? achievement.song_md5[0] 
        : achievement.song_md5;
      onNavigate(`/user/${userId}/achievements/${songId}`);
    } else if (userId) {
      onNavigate(`/user/${userId}/achievements`);
    }
    handleClose();
  };
  
  const { name, rank, description } = achievement;
  const achievementName = `${name} ${getRankName(rank)}`;
  
  return (
    <div className={`achievement-toast ${isVisible ? "visible" : "hiding"}`}>
      <div 
        className="achievement-toast-content"
        onClick={onNavigate ? handleClick : undefined}
      >
        <div className="achievement-toast-icon">
          <AchievementIcon achievement={achievement} />
        </div>
        <div className="achievement-toast-info">
          <h4 className="achievement-unlocked">Achievement Unlocked!</h4>
          <h3 className="achievement-name">{achievementName}</h3>
          <p className="achievement-description">{description}</p>
        </div>
      </div>
      <button className="achievement-toast-close" onClick={handleClose}>
        ×
      </button>
    </div>
  );
};

export default AchievementToast; 