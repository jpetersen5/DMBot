import React, { useState, useEffect } from "react";
import { API_URL } from "../../App";
import LoadingSpinner from "../Loading/LoadingSpinner";
import "./ProfileStats.scss";

interface ProfileStatsProps {
  userId: string;
}

interface UserStats {
  total_fcs: number;
  avg_percent: number;
  total_score: number;
  total_scores: number;
}

const ProfileStats: React.FC<ProfileStatsProps> = ({ userId }) => {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_URL}/api/user/${userId}/stats`);
        if (response.ok) {
          const data: UserStats = await response.json();
          setStats(data);
        } else {
          setStats(null);
          console.error("Error fetching user stats:", response.statusText);
        }
      } catch (error) {
        console.error("Error fetching user stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [userId]);

  return (
    <div className="profile-stats">
      <h2>User Stats</h2>
      {loading && <LoadingSpinner />}
      {!loading && !stats && <p>No stats available. If you have scores, reupload your scoredata.bin file to update!</p>}
      {stats && !loading && (
        <div className="stats-grid">
          <StatItem label="Total FCs" value={stats.total_fcs?.toLocaleString()} />
          <StatItem label="Average Percent" value={`${stats.avg_percent?.toFixed(2)}%`} />
          <StatItem label="Overall Score" value={stats.total_score?.toLocaleString()} />
          <StatItem label="Number of Scores" value={stats.total_scores?.toLocaleString()} />
        </div>
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