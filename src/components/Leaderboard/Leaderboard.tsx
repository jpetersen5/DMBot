import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../../App";
import { useAuth } from "../../context/AuthContext";
import "./Leaderboard.scss";

import { Table, Column } from "../Table";
import { TableToolbar } from "../Table/TableControls";
import { useTableData } from "../../hooks/useTableData";
import { cellRenderers } from "../Table/TableCells";

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

const Leaderboard: React.FC<LeaderboardProps> = ({ songId }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const {
    page,
    setPage: originalSetPage,
    inputPage,
    setInputPage: originalSetInputPage,
    perPage,
    setPerPage: originalSetPerPage,
    filteredData,
    totalPages
  } = useTableData<LeaderboardEntry>({
    data: entries,
    defaultSortKey: "rank",
    defaultSortOrder: "asc",
    defaultPerPage: 50
  });

  const setPage = useCallback((value: React.SetStateAction<number>) => {
    const newPage = typeof value === "function" ? value(page) : value;
    originalSetPage(newPage);
  }, [originalSetPage, page]);

  const setInputPage = useCallback((value: React.SetStateAction<string>) => {
    const newInputPage = typeof value === "function" ? value(inputPage) : value;
    originalSetInputPage(newInputPage);
  }, [originalSetInputPage, inputPage]);

  const setPerPage = useCallback((value: React.SetStateAction<number>) => {
    const newPerPage = typeof value === "function" ? value(perPage) : value;
    originalSetPerPage(newPerPage);
  }, [originalSetPerPage, perPage]);

  useEffect(() => {
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

  const handleRowClick = (entry: LeaderboardEntry) => {
    navigate(`/user/${entry.user_id}`);
  };

  const isSelectedRow = (entry: LeaderboardEntry) => {
    return user?.id === entry.user_id;
  };

  const columns: Column<LeaderboardEntry>[] = [
    {
      key: "rank",
      header: "#",
      className: "rank column-number",
      renderCell: (entry) => cellRenderers.text(entry.rank),
      sortable: true
    },
    {
      key: "username",
      header: "Player",
      className: "username",
      renderCell: (entry) => cellRenderers.text(entry.username),
      sortable: true
    },
    {
      key: "score",
      header: "Score",
      className: "score column-number",
      renderCell: (entry) => cellRenderers.number(entry.score),
      sortable: true
    },
    {
      key: "percent",
      header: "Percent",
      className: "percent column-percent",
      renderCell: (entry) => entry.is_fc ? cellRenderers.fc(entry.percent) : cellRenderers.percent(entry.percent),
      sortable: true,
      sortFn: (a, b, direction) => {
        // FC"s take priority over non-FC"s
        const aValue = a.is_fc ? 101 : a.percent;
        const bValue = b.is_fc ? 101 : b.percent;
        return direction === "asc" ? aValue - bValue : bValue - aValue;
      }
    },
    {
      key: "speed",
      header: "Speed",
      className: "speed column-percent",
      renderCell: (entry) => cellRenderers.percent(entry.speed),
      sortable: true
    },
    {
      key: "play_count",
      header: "Plays",
      className: "play-count column-number",
      renderCell: (entry) => cellRenderers.text(entry.play_count || "N/A"),
      sortable: true
    },
    {
      key: "posted",
      header: "Posted",
      className: "posted",
      renderCell: (entry) => cellRenderers.timestamp(entry.posted),
      sortable: true
    }
  ];

  return (
    <div className="leaderboard">
      <Table
        data={filteredData}
        columns={columns}
        keyExtractor={(entry) => entry.user_id}
        defaultSortKey="rank"
        defaultSortOrder="asc"
        loading={loading}
        loadingMessage="Loading leaderboard..."
        emptyMessage="No entries found"
        onRowClick={handleRowClick}
        isSelectedRow={isSelectedRow}
        pagination={{
          page,
          setPage,
          inputPage,
          setInputPage,
          itemsPerPage: perPage
        }}
      />
      
      {totalPages > 1 && (
        <div className="page-controls">
          <TableToolbar
            pagination={{
              page,
              totalPages,
              inputPage,
              setPage,
              setInputPage
            }}
            perPage={{
              perPage,
              setPerPage,
              setPage
            }}
          />
        </div>
      )}
    </div>
  );
};

export default Leaderboard;