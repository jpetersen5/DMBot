import React from "react";
import "./CharterStats.scss";

interface CharterStatsProps {
  userId: string;
}

const CharterStats: React.FC<CharterStatsProps> = ({ userId }) => {
  return (
    <div className="charter-stats">
      <h2>Charter Stats</h2>
      <p>Charter stats will be implemented here.</p>
    </div>
  );
};

export default CharterStats;