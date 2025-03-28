import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../../App";
import { TableControls, Pagination } from "../SongList/TableControls";
import { TableHeader, SongTableCell } from "../Extras/Tables";
import LoadingSpinner from "../Loading/LoadingSpinner";
import { useKeyPress } from "../../hooks/useKeyPress";
import { useAuth } from "../../context/AuthContext";
import ScrollableTable from "../Extras/ScrollableTable";
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
  rank: "#",
  username: "Player",
  score: "Score",
  percent: "Percent",
  speed: "Speed",
  // is_fc: "FC",
  play_count: "Plays",
  posted: "Posted",
};

const Leaderboard: React.FC<LeaderboardProps> = ({ songId }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [inputPage, setInputPage] = useState<string>(page.toString());
  const [perPage, setPerPage] = useState<number>(50);
  const [sortBy, setSortBy] = useState<string>("rank");
  const [secondarySortBy, setSecondarySortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [secondarySortOrder, setSecondarySortOrder] = useState<"asc" | "desc">("desc");
  const shiftPressed = useKeyPress("Shift");
  const navigate = useNavigate();

  useEffect(() => {
    setPage(1);
    setInputPage("1");
    fetchLeaderboard();
  }, [songId]);

  async function fetchLeaderboard() {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/leaderboard/${songId}`);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const { leaderboard } = await response.json();
      setEntries(leaderboard ? leaderboard : []);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  }

  function getSortValues(a: LeaderboardEntry, b: LeaderboardEntry, sortKey: string) {
    let aValue = a[sortKey as keyof LeaderboardEntry];
    let bValue = b[sortKey as keyof LeaderboardEntry];
    if (typeof aValue === "string") {
      aValue = aValue.toLowerCase();
    }
    if (typeof bValue === "string") {
      bValue = bValue.toLowerCase();
    }
    if (sortKey === "percent") { // FC's take priority over non-FC's
      aValue = a.is_fc ? 101 : aValue;
      bValue = b.is_fc ? 101 : bValue;
    }
    return [aValue, bValue];
  }

  const sortedEntries = useMemo(() => {
    let sortedEntries = entries;
    if (!sortedEntries) return [];

    // I don't know why this is necessary, but it is
    sortedEntries = sortedEntries.filter(entry => entry);

    sortedEntries = sortedEntries.sort((a, b) => {
      const [aValue, bValue] = getSortValues(a, b, sortBy);
      if (aValue === null || bValue === null) return 0;
      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      if (secondarySortBy) {
        const [aSecondaryValue, bSecondaryValue] = getSortValues(a, b, secondarySortBy);
        if (aSecondaryValue === null || bSecondaryValue === null) return 0;
        if (aSecondaryValue < bSecondaryValue) return secondarySortOrder === "asc" ? -1 : 1;
        if (aSecondaryValue > bSecondaryValue) return secondarySortOrder === "asc" ? 1 : -1;
      }
      return 0;
    });

    return sortedEntries;
  }, [entries, sortBy, sortOrder, secondarySortBy, secondarySortOrder]);

  const paginatedEntries = useMemo(() => {
    const startIndex = (page - 1) * perPage;
    return sortedEntries.slice(startIndex, startIndex + perPage);
  }, [sortedEntries, page, perPage]);

  const totalPages = Math.ceil(sortedEntries.length / perPage);

  const handleSort = (column: string) => {
    if (!shiftPressed) {
      setSecondarySortBy(null);
      setSecondarySortOrder("desc");
      if (sortBy === column) {
        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
      } else {
        setSortBy(column);
        setSortOrder("desc");
      }
    } else {
      if (secondarySortBy === column) {
        setSecondarySortOrder(secondarySortOrder === "asc" ? "desc" : "asc");
      } else {
        setSecondarySortBy(column);
        setSecondarySortOrder("desc");
      }
    }
  };

  const handleRowClick = (userId: string) => {
    navigate(`/user/${userId}`);
  };

  return (
    <div className="leaderboard">
      <ScrollableTable>
        {loading && (
          <LoadingSpinner message="Loading leaderboard..." />
        )}
        {!loading && (
          <table>
            <thead>
              <tr>
                {Object.entries(LEADERBOARD_TABLE_HEADERS).map(([key, value]) => (
                  <TableHeader
                    key={key}
                    className={key.replace(/_/g, "-")}
                    content={value}
                    onClick={() => handleSort(key)}
                    sort={sortBy === key || secondarySortBy === key}
                    sortOrder={sortBy === key ? sortOrder : secondarySortOrder}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedEntries.length === 0 && (
                <tr>
                  <td colSpan={Object.keys(LEADERBOARD_TABLE_HEADERS).length}>No entries found</td>
                </tr>
              )}
              {paginatedEntries.length > 0 && (
                paginatedEntries.map((entry) => (
                  <LeaderboardTableRow 
                    key={entry.user_id} 
                    entry={entry}
                    onClick={() => handleRowClick(entry.user_id)}
                  />
                ))
              )}
            </tbody>
          </table>
        )}
      </ScrollableTable>
      {totalPages > 1 && (
        <div className="page-controls">
          <TableControls perPage={perPage} setPerPage={setPerPage} setPage={setPage} />
          <Pagination
            page={page}
            totalPages={totalPages}
            inputPage={inputPage}
            setPage={setPage}
            setInputPage={setInputPage} />
        </div>
      )}
    </div>
  );
};

interface LeaderboardTableRowProps {
  entry: LeaderboardEntry;
  onClick: () => void;
}

const LeaderboardTableRow: React.FC<LeaderboardTableRowProps> = ({ entry, onClick }) => {
  const { user } = useAuth();
  const isCurrentUser = user?.id === entry.user_id;

  return (
    <tr onClick={onClick} className={isCurrentUser ? "selected-row" : ""} style={{ cursor: "pointer" }}>
      <SongTableCell className="rank" content={entry.rank.toString()} />
      <SongTableCell className="username" content={entry.username} />
      <SongTableCell className="score" content={entry.score.toLocaleString()} />
      <SongTableCell className="percent" content={entry.percent.toString()} special={entry.is_fc ? "fc_percent" : "percent"} />
      <SongTableCell className="speed" content={entry.speed.toString()} special="percent" />
      {/* <SongTableCell className="is-fc" content={entry.is_fc ? "Yes" : "No"} /> */}
      <SongTableCell className="play-count" content={entry.play_count ? entry.play_count.toString() : "N/A"} />
      <SongTableCell className="posted" content={entry.posted} special="last_update" />
    </tr>
  );
};

export default Leaderboard;