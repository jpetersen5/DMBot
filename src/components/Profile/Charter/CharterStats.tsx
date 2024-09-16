import React, { useEffect, useState } from "react";
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
  const [chartColor, setChartColor] = useState("rgba(255, 255, 255, 0.6)");
  const [chartBorderColor, setChartBorderColor] = useState("rgba(255, 255, 255, 1)");

  useEffect(() => {
    const updateColors = () => {
      const theme = localStorage.getItem("theme") || "light";
      setChartColor(theme === "light" ? "rgba(32, 32, 32, 0.6)" : "rgba(255, 255, 255, 0.6)");
      setChartBorderColor(theme === "light" ? "rgba(32, 32, 32, 1)" : "rgba(255, 255, 255, 1)");
    };
    updateColors();
  }, []);

  if (!stats) return (
    <div className="charter-stats">
      <h2>Charter Stats</h2>
      <div className="last-updated">
        {"Something went wrong. Check back later."}
      </div>
    </div>
  )
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
          <DifficultyChart
            data={stats.difficulty_distribution}
            chartColor={chartColor}
            chartBorderColor={chartBorderColor}
          />
        </div>
        <div className="distribution-block">
          <h3>Genre Distribution</h3>
          <DistributionChart data={stats.genre_distribution} />
        </div>
        <div className="distribution-block">
          <h3>Year Distribution</h3>
          <YearChart
            data={stats.year_distribution}
            chartBorderColor={chartBorderColor}
          />
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
  chartColor?: string;
  chartBorderColor?: string;
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

const DifficultyChart: React.FC<DistributionChartProps> = ({ data, chartColor, chartBorderColor }) => {
  const sortedData = Object.entries(data).sort((a, b) => Number(a[0]) - Number(b[0]));
  const chartData = {
    labels: sortedData.map(([key]) => key),
    datasets: [
      {
        label: "Number of Charts",
        data: sortedData.map(([, value]) => value),
        backgroundColor: chartColor,
        borderColor: chartBorderColor,
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

const YearChart: React.FC<DistributionChartProps> = ({ data, chartBorderColor }) => {
  const sortedData = Object.entries(data).sort((a, b) => Number(a[0]) - Number(b[0]));
  const chartData = {
    labels: sortedData.map(([key]) => key),
    datasets: [
      {
        label: "Number of Charts",
        data: sortedData.map(([, value]) => value),
        fill: false,
        borderColor: chartBorderColor,
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