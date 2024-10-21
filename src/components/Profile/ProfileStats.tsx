import React, { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import { Modal } from "react-bootstrap";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
} from "chart.js";
import "chartjs-adapter-date-fns"
import { EloHistory, UserStats } from "../../utils/user";
import "./ProfileStats.scss";

import historyIcon from "../../assets/history.svg";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale);

interface ProfileStatsProps {
  userStats?: UserStats;
  elo?: number;
  eloHistory?: EloHistory[];
}

const ProfileStats: React.FC<ProfileStatsProps> = ({ userStats, elo, eloHistory }) => {
  const [showEloModal, setShowEloModal] = useState(false);
  const [chartBorderColor, setChartBorderColor] = useState<string>("rgba(255, 255, 255, 1)");
  const [timeWindow, setTimeWindow] = useState<string>("12h");

  useEffect(() => {
    const updateColors = () => {
      const theme = localStorage.getItem("theme") || "light";
      setChartBorderColor(theme === "light" ? "rgba(32, 32, 32, 1)" : "rgba(255, 255, 255, 1)");
    };
    updateColors();
  }, []);

  const filterEloHistory = (history: EloHistory[], window: string) => {
    const now = new Date();
    const windowMs = {
      "12h": 12 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
      "all": Infinity
    }[window];
    if (!windowMs || windowMs === Infinity) return history;

    return history.filter(entry => {
      const entryDate = new Date(entry.timestamp);
      return now.getTime() - entryDate.getTime() <= windowMs;
    });
  };

  const getStartDateInterval = (timeWindow: string, filteredHistory: EloHistory[]) => {
    const now = new Date();
    let startDate: Date;
    let interval: number;

    switch (timeWindow) {
      case "12h":
        startDate = new Date(now.getTime() - 12 * 60 * 60 * 1000);
        interval = 60 * 60 * 1000; // 1 hour
        break;
      case "24h":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        interval = 60 * 60 * 1000 * 2; // 2 hours
        break;
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        interval = 12 * 60 * 60 * 1000; // 12 hours
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        interval = 24 * 60 * 60 * 1000 * 2; // 2 days
        break;
      default: // "all"
        startDate = new Date(Math.min(...filteredHistory.map(entry => new Date(entry.timestamp).getTime())));
        interval = Math.ceil((now.getTime() - startDate.getTime()) / 10);
    }

    return { startDate, interval };
  }

  const getEloChartData = () => {
    if (!eloHistory) return null;

    const filteredHistory = filterEloHistory(eloHistory, timeWindow);
    const { startDate, interval } = getStartDateInterval(timeWindow, filteredHistory);

    if (!startDate || !interval) return null;
    const now = new Date();
    const labels = [];
    const data = [];
    // data {x: timestamp, y: elo}
    let currentDate = new Date(startDate);

    while (currentDate <= now) {
      labels.push(currentDate.toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }));
      const relevantEntries = filteredHistory.filter(entry => 
        new Date(entry.timestamp) <= currentDate && 
        new Date(entry.timestamp) > new Date(currentDate.getTime() - interval)
      );
      const dataEntry = {
        x: relevantEntries.length > 0 ? new Date(relevantEntries[relevantEntries.length - 1].timestamp) : null,
        y: relevantEntries.length > 0 ? relevantEntries[relevantEntries.length - 1].elo : null
      }
      data.push(dataEntry);
      currentDate = new Date(currentDate.getTime() + interval);
    }

    return {
      labels,
      datasets: [
        {
          label: "Elo",
          data,
          fill: false,
          borderColor: chartBorderColor,
          tension: 0,
        },
      ],
    };
  };

  const eloChartOptions = {
    responsive: true,
    scales: {
      x: {
        type: "time" as const,
        time: {
          unit: timeWindow === "12h" ? "hour" as const :
                timeWindow === "24h" ? "hour" as const :
                timeWindow === "7d" ? "day" as const :
                timeWindow === "30d" ? "day" as const :
                "month" as const,
          displayFormats: {
            hour: "HH:mm",
            day: "MMM dd",
            month: "MMM YYYY",
          },
        },
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 15,
        },
        min: eloHistory ? getStartDateInterval(timeWindow, eloHistory).startDate.toISOString() : undefined,
        max: new Date().toISOString(),
      },
      y: {
        beginAtZero: false,
      },
    },
    plugins: {
      legend: {
        display: false,
      },
    },
  };

  const eloData = getEloChartData();

  return (
    <div className="profile-stats">
      <div className="stats-header">
        <h2>User Stats</h2>
        <h2>{`Rank: #${userStats?.rank}`}</h2>
        <div className="elo-container">
          <h2>{`Elo: ${elo}`}</h2>
          <button className="see-history-btn" onClick={() => setShowEloModal(true)}>
            <span>See History</span><img src={historyIcon} alt="History" />
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

      <Modal show={showEloModal} onHide={() => setShowEloModal(false)} size="lg" centered className="elo-modal">
        <Modal.Header closeButton>
          <Modal.Title>Elo History</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {eloData && (
            <div className="elo-chart">
              <div className="chart-controls">
                <select value={timeWindow} onChange={(e) => setTimeWindow(e.target.value)}>
                  <option value="12h">Last 12 Hours</option>
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                </select>
              </div>
              <Line data={eloData} options={eloChartOptions} />
            </div>
          )}
        </Modal.Body>
      </Modal>
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