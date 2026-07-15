import React, { useState } from "react";
import { EloHistory, UserStats } from "../../utils/user";
import EloModal from "./EloModal";
import "./ProfileStats.scss";

import Icon from "../Extras/Icon";
import historyIcon from "../../assets/history.svg?react";

interface ProfileStatsProps {
  userStats?: UserStats;
  elo?: number;
  eloHistory?: EloHistory[];
}

const ProfileStats: React.FC<ProfileStatsProps> = ({ userStats, elo, eloHistory }) => {
  const [showEloModal, setShowEloModal] = useState(false);

  return (
    <div className="profile-stats">
      <div className="stats-header">
        <h2>User Stats</h2>
        <h2>{`Rank: #${userStats?.rank}`}</h2>
        <div className="elo-container">
          <h2>{`Elo: ${elo}`}</h2>
          <button className="see-history-btn" onClick={() => setShowEloModal(true)}>
            <span>See History</span><Icon as={historyIcon} title="History" />
          </button>
        </div>
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

      <EloModal
        show={showEloModal}
        onHide={() => setShowEloModal(false)}
        eloHistory={eloHistory}
        elo={elo}
      />
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
