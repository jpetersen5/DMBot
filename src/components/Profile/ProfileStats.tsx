import React from "react";
import { UserStats } from "../../utils/user";
import "./ProfileStats.scss";

interface ProfileStatsProps {
  userStats: UserStats | undefined;
  elo: number | undefined;
}

const ProfileStats: React.FC<ProfileStatsProps> = ({ userStats, elo }) => {
  return (
    <div className="profile-stats">
      <div className="stats-header">
        <h2>User Stats</h2>
        <h2>{`Rank: #${userStats?.rank}`}</h2>
        <h2>{`Elo: ${elo}`}</h2>
      </div>
      {userStats ? (
        <div className="stats-grid">
          <StatItem label="Total FCs" value={userStats.total_fcs?.toLocaleString()} />
          <StatItem label="Average Percent" value={`${userStats.avg_percent?.toFixed(2)}%`} />
          <StatItem label="Overall Score" value={userStats.total_score?.toLocaleString()} />
          <StatItem label="Number of Scores" value={userStats.total_scores?.toLocaleString()} />
        </div>
      ) : (
        <p>No stats available. If you have scores, reupload your scoredata.bin file to update!</p>
      )}
    </div>
  );
};

interface StatItemProps {
  label: string;
  value: string | number;
}

const StatItem: React.FC<StatItemProps> = ({ label, value }) => (
  <div className="stat-item">
    <span className="stat-label">{label}:</span>
    <span className="stat-value">{value}</span>
  </div>
);

export default ProfileStats;