import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../../App";
import { TableControls, Pagination } from "../SongList/TableControls";
import LoadingSpinner from "../Loading/LoadingSpinner";
import { formatExactTime, formatTimeDifference } from "../../utils/song";
import Tooltip from "../../utils/Tooltip/Tooltip";
import "./Leaderboard.scss";

interface LeaderboardEntry {
  is_fc: boolean;
  score: number;
  speed: number;
  percent: number;
  user_id: string;
  username: string;
  play_count: number;
  posted: string;
}

interface LeaderboardProps {
  songId: string;
  key: string;
}

const LEADERBOARD_TABLE_HEADERS = {
  rank: "Rank",
  username: "Player",
  score: "Score",
  percent: "Percent",
  speed: "Speed",
  is_fc: "FC",
  play_count: "Plays",
  posted: "Posted",
};

const Leaderboard: React.FC<LeaderboardProps> = ({ songId }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [inputPage, setInputPage] = useState(page.toString());
  const [totalEntries, setTotalEntries] = useState(0);
  const [perPage, setPerPage] = useState(10);
  const [sortBy, setSortBy] = useState("score");
  const [sortOrder, setSortOrder] = useState("desc");
  const navigate = useNavigate();

  const totalPages = Math.ceil(totalEntries / perPage);

  useEffect(() => {
    setPage(1);
    setInputPage("1");
    fetchLeaderboard();
  }, [songId]);

  useEffect(() => {
    fetchLeaderboard();
  }, [songId, page, perPage, sortBy, sortOrder]);

  async function fetchLeaderboard() {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString(),
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      const response = await fetch(`${API_URL}/api/leaderboard/${songId}?${queryParams}`);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data = await response.json();
      if (!data.entries) {
        setEntries([]);
        setTotalEntries(0);
      } else {
        setEntries(data.entries);
        setTotalEntries(data.total);
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const handleRowClick = (userId: string) => {
    navigate(`/user/${userId}`);
  };

  return (
    <div className="leaderboard">
      <h5>Leaderboard</h5>
      <div className="control-bar">
        <TableControls perPage={perPage} setPerPage={setPerPage} setPage={setPage} />
        <Pagination
          page={page}
          totalPages={totalPages}
          inputPage={inputPage}
          setPage={setPage}
          setInputPage={setInputPage}
        />
      </div>
      <table>
        <thead>
          <tr>
            {Object.entries(LEADERBOARD_TABLE_HEADERS).map(([key, value]) => (
              <LeaderboardTableHeader
                key={key}
                content={value}
                onClick={() => handleSort(key)}
                sort={sortBy === key}
                sortOrder={sortOrder}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={Object.keys(LEADERBOARD_TABLE_HEADERS).length}>
                <LoadingSpinner message="Loading leaderboard..." />
              </td>
            </tr>
          )}
          {!loading && entries.length === 0 && (
            <tr>
              <td colSpan={Object.keys(LEADERBOARD_TABLE_HEADERS).length}>No entries found</td>
            </tr>
          )}
          {!loading && entries.length > 0 && (
            entries.map((entry, index) => (
              <LeaderboardTableRow 
                key={entry.user_id} 
                entry={entry}
                rank={(page - 1) * perPage + index + 1}
                onClick={() => handleRowClick(entry.user_id)}
              />
            ))
          )}
        </tbody>
      </table>
      <Pagination
        page={page}
        totalPages={totalPages}
        inputPage={inputPage}
        setPage={setPage}
        setInputPage={setInputPage}
      />
    </div>
  );
};

interface LeaderboardTableHeaderProps {
  onClick: () => void;
  content: string;
  sort: boolean;
  sortOrder: string;
}

const LeaderboardTableHeader: React.FC<LeaderboardTableHeaderProps> = ({ onClick, content, sort, sortOrder }) => (
  <th onClick={onClick}>
    <div className="header-content">
      <span className="header-text">{content}</span>
      {sort && <span className="sort-arrow">{sortOrder === "asc" ? "▲" : "▼"}</span>}
    </div>
  </th>
);

interface LeaderboardTableRowProps {
  entry: LeaderboardEntry;
  rank: number;
  onClick: () => void;
}

const LeaderboardTableRow: React.FC<LeaderboardTableRowProps> = ({ entry, rank, onClick }) => (
  <tr onClick={onClick} style={{ cursor: "pointer" }}>
    <td>{rank}</td>
    <td>{entry.username}</td>
    <td>{entry.score.toLocaleString()}</td>
    <td>{entry.percent}%</td>
    <td>{entry.speed}%</td>
    <td>{entry.is_fc ? "Yes" : "No"}</td>
    <td>{entry.play_count}</td>
    <td>
      <Tooltip text={formatExactTime(entry.posted)}>
        {formatTimeDifference(entry.posted)}
      </Tooltip>
    </td>
  </tr>
);

export default Leaderboard;