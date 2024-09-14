import React from "react";
import { Bar, Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend } from "chart.js";
import TooltipWrapper from "../../../utils/Tooltip/Tooltip";
import { CharterStatsData } from "../../../utils/charter";
import { msToHourMinSec, formatTimeDifference, formatExactTime } from "../../../utils/song";
import "./CharterStats.scss";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend);

interface CharterStatsProps {
  stats: CharterStatsData;
}

ChartJS.defaults.color = "#858585";

const CharterStats: React.FC<CharterStatsProps> = ({ stats }) => {
  return (
    <div className="charter-stats">
      <h2>Charter Stats</h2>
      <div className="last-updated">
        {"(Updated "}
        <TooltipWrapper text={formatExactTime(stats.last_updated)}>
          {formatTimeDifference(stats.last_updated)}
        </TooltipWrapper>
        {")"}
      </div>
      <div className="stats-grid">
        <StatItem label="Total Songs Charted" value={stats.total_songs} />
        <StatItem label="Total Charts Length" value={msToHourMinSec(stats.total_length)} />
        <StatItem label="Average Chart Length" value={msToHourMinSec(stats.avg_length)} />
        <StatItem label="Total User Scores" value={stats.total_scores.toLocaleString()} />
        <StatItem label="Average Scores per Chart" value={stats.avg_scores.toFixed(2)} />
        <StatItem label="Most Charted Artist" value={stats.most_common_artist} />
      </div>
      <div className="distributions">
        <div className="distribution-block">
          <h3>Difficulty Distribution</h3>
          <DifficultyChart data={stats.difficulty_distribution} />
        </div>
        <div className="distribution-block">
          <h3>Genre Distribution</h3>
          <DistributionChart data={stats.genre_distribution} />
        </div>
        <div className="distribution-block">
          <h3>Year Distribution</h3>
          <YearChart data={stats.year_distribution} />
        </div>
      </div>
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

interface DistributionChartProps {
  data: { [key: string]: number };
}

const DistributionChart: React.FC<DistributionChartProps> = ({ data }) => {
  const sortedData = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = Object.values(data).reduce((sum, value) => sum + value, 0);

  return (
    <div className="distribution-chart">
      {sortedData.map(([key, value]) => (
        <div key={key} className="chart-bar"  data-full-label={key}>
          <div className="bar-label">{key}</div>
          <div className="bar-container">
            <div className="bar" style={{ width: `${(value / total) * 100}%` }}></div>
          </div>
          <div className="bar-value">{value}</div>
        </div>
      ))}
    </div>
  );
};

const DifficultyChart: React.FC<DistributionChartProps> = ({ data }) => {
  const sortedData = Object.entries(data).sort((a, b) => Number(a[0]) - Number(b[0]));
  const chartData = {
    labels: sortedData.map(([key]) => key),
    datasets: [
      {
        label: "Number of Charts",
        data: sortedData.map(([, value]) => value),
        backgroundColor: "rgba(32, 32, 32, 0.6)",
        borderColor: "rgba(32, 32, 32, 1)",
        borderWidth: 1,
      },
    ],
  };

  const options = {
    scales: {
      y: {
        beginAtZero: true
      }
    },
  };

  return <Bar data={chartData} options={options} />;
};

const YearChart: React.FC<DistributionChartProps> = ({ data }) => {
  const sortedData = Object.entries(data).sort((a, b) => Number(a[0]) - Number(b[0]));
  const chartData = {
    labels: sortedData.map(([key]) => key),
    datasets: [
      {
        label: "Number of Charts",
        data: sortedData.map(([, value]) => value),
        fill: false,
        borderColor: "rgb(32, 32, 32)",
        tension: 0.1,
      },
    ],
  };

  const options = {
    scales: {
      y: {
        beginAtZero: true
      }
    },
  };

  return <Line data={chartData} options={options} />;
};

export default CharterStats;