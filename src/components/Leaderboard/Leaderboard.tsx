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
  posted: string | null;
  rank: number;
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
  const [perPage, setPerPage] = useState(50);
  const [sortBy, setSortBy] = useState("rank");
  const [sortOrder, setSortOrder] = useState("asc");
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
            entries.map((entry) => (
              <LeaderboardTableRow 
                key={entry.user_id} 
                entry={entry}
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
  onClick: () => void;
}

const LeaderboardTableRow: React.FC<LeaderboardTableRowProps> = ({ entry, onClick }) => (
  <tr onClick={onClick} style={{ cursor: "pointer" }}>
    <td>{entry.rank}</td>
    <td>{entry.username}</td>
    <td>{entry.score.toLocaleString()}</td>
    <td>{entry.percent}%</td>
    <td>{entry.speed}%</td>
    <td>{entry.is_fc ? "Yes" : "No"}</td>
    <td>{entry.play_count ? entry.play_count : "N/A"}</td>
    <td>
      {entry.posted ? (
        <Tooltip text={formatExactTime(entry.posted)}>
          {formatTimeDifference(entry.posted)}
        </Tooltip>
      ) : (
        "N/A"
      )}
    </td>
  </tr>
);

export default Leaderboard;