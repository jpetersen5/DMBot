import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SongModal from "../../SongList/SongModal";
import UnknownSongModal from "./UnknownSongModal";
import { API_URL } from "../../../App";
import {
  Score,
  Scores,
  UnknownScore,
  formatRank
} from "../../../utils/score";
import { Song } from "../../../utils/song";
import "./UserScores.scss";

import { Table, Column } from "../../Table";
import { TableToolbar } from "../../Table/TableControls";
import { useTableData } from "../../../hooks/useTableData";
import { cellRenderers } from "../../Table/TableCells";

interface UserScoresProps {
  userId: string;
}

const filterOptions = [
  { value: "song_name", label: "Name" },
  { value: "artist", label: "Artist" },
  { value: "score", label: "Score" },
  { value: "identifier", label: "Identifier" }
];

const UserScores: React.FC<UserScoresProps> = ({ userId }) => {
  const { songId } = useParams<{ songId: string }>();
  const navigate = useNavigate();

  const [scores, setScores] = useState<Scores>({ scores: [], unknown_scores: [] });
  const [loading, setLoading] = useState<boolean>(true);
  const [showUnknown, setShowUnknown] = useState<boolean>(false);
  
  const [selectedUnknownScore, setSelectedUnknownScore] = useState<UnknownScore | null>(null);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);

  const {
    page,
    setPage: originalSetPage,
    inputPage,
    setInputPage: originalSetInputPage,
    perPage,
    setPerPage: originalSetPerPage,
    search,
    setSearch: originalSetSearch,
    filters,
    setFilters: originalSetFilters,
    filteredData,
    totalPages
  } = useTableData<Score | UnknownScore>({
    data: showUnknown ? scores.unknown_scores : scores.scores,
    defaultSortKey: "posted",
    defaultSortOrder: "desc",
    defaultPerPage: 100,
    getFilterableFields: (item) => ({
      song_name: item.song_name,
      artist: item.artist,
      score: item.score,
      identifier: item.identifier
    })
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

  const setSearch = useCallback((value: React.SetStateAction<string>) => {
    const newSearch = typeof value === "function" ? value(search) : value;
    originalSetSearch(newSearch);
  }, [originalSetSearch, search]);

  const setFilters = useCallback((value: React.SetStateAction<string[]>) => {
    const newFilters = typeof value === "function" ? value(filters) : value;
    originalSetFilters(newFilters);
  }, [originalSetFilters, filters]);

  useEffect(() => {
    fetchScores();
    const handleScoresRefresh = () => {
      fetchScores();
    };

    window.addEventListener("scoresNeedRefresh", handleScoresRefresh);
    return () => {
      window.removeEventListener("scoresNeedRefresh", handleScoresRefresh);
    };
  }, [userId]);

  useEffect(() => {
    setPage(1);
    setInputPage("1");
  }, [showUnknown]);

  async function fetchScores() {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/user/${userId}/scores`);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data: Scores = await response.json();
      setScores(data);
    } catch (error) {
      console.error("Error fetching scores:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleToggleUnknown = () => {
    setShowUnknown(prev => !prev);
  };

  useEffect(() => {
    if (songId) {
      fetchSong(songId);
    } else {
      setSelectedSong(null);
    }
  }, [songId]);

  const fetchSong = async (id: string) => {
    setModalLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/songs/${id}`);
      if (!response.ok) throw new Error("Failed to fetch song");
      const song = await response.json();
      setSelectedSong(song);
    } catch (error) {
      console.error("Error fetching song:", error);
      setSelectedSong(null);
    } finally {
      setModalLoading(false);
    }
  };

  const handleModalClose = () => {
    setSelectedSong(null);
    navigate(`/user/${userId}/scores`, { replace: true });
  };

  const handleUnknownModalClose = () => {
    setSelectedUnknownScore(null);
  };

  const getSurroundingSongIds = () => {
    const currentScoreIndex = filteredData.findIndex(score => score.identifier === songId);
    if (currentScoreIndex === -1) return { prevSongIds: [], nextSongIds: [] };
    const prevSongIds = filteredData.slice(0, currentScoreIndex).map(score => score.identifier);
    const nextSongIds = filteredData.slice(currentScoreIndex + 1).map(score => score.identifier);
    return { prevSongIds, nextSongIds };
  };

  const handleRowClick = (score: Score | UnknownScore) => {
    if (showUnknown) {
      setSelectedUnknownScore(score as UnknownScore);
    } else {
      navigate(`/user/${userId}/scores/${score.identifier}`);
    }
  };

  const columns: Column<Score | UnknownScore>[] = [
    {
      key: "song_name",
      header: "Song",
      className: "name",
      renderCell: (score) => cellRenderers.html(score.song_name),
      sortable: true
    },
    {
      key: "artist",
      header: "Artist",
      className: "artist",
      renderCell: (score) => cellRenderers.text(score.artist),
      sortable: true
    },
    {
      key: "score",
      header: "Score",
      className: "score column-number",
      renderCell: (score) => cellRenderers.number(score.score),
      sortable: true
    },
    {
      key: "percent",
      header: "Percent",
      className: "percent column-percent",
      renderCell: (score) => score.is_fc ? cellRenderers.fc(score.percent) : cellRenderers.percent(score.percent),
      sortable: true,
      sortFn: (a, b, direction) => {
        // FC's take priority over non-FC's
        const aValue = a.is_fc ? 101 : a.percent;
        const bValue = b.is_fc ? 101 : b.percent;
        return direction === "asc" ? aValue - bValue : bValue - aValue;
      }
    },
    {
      key: "speed",
      header: "Speed",
      className: "speed column-percent",
      renderCell: (score) => cellRenderers.percent(score.speed),
      sortable: true
    },
    {
      key: "play_count",
      header: "Plays",
      className: "play-count column-number",
      renderCell: (score) => cellRenderers.text(score.play_count || "N/A"),
      sortable: true
    },
    {
      key: "posted",
      header: "Posted",
      className: "posted",
      renderCell: (score) => cellRenderers.timestamp(score.posted),
      sortable: true,
      sortFn: (a, b, direction) => {
        const aValue = a.posted ? a.posted : new Date(0).toISOString();
        const bValue = b.posted ? b.posted : new Date(0).toISOString();
        return direction === "asc" 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }
    },
    {
      key: "rank",
      header: "Rank",
      className: "rank column-rank",
      renderCell: (score) => cellRenderers.text(formatRank(score.rank)),
      sortable: true,
      sortFn: (a, b, direction) => {
        // Handle special cases for ranks
        const aRank = a.rank || (direction === "asc" ? 1000000 : 0);
        const bRank = b.rank || (direction === "asc" ? 1000000 : 0);
        return direction === "asc" ? aRank - bRank : bRank - aRank;
      }
    }
  ];

  return (
    <>
      <div className="user-scores">
        <div className="user-scores-header">
          <h2>{`${showUnknown ? "Unknown" : ""} User Scores`}</h2>
          <div className="control-bar">
            <TableToolbar
              search={{
                search,
                setSearch,
                filters,
                setFilters,
                filterOptions,
                placeholder: "Search scores..."
              }}
            />
            <div className="toggle-container">
              <label htmlFor="show-unknown" className="toggle-label" onClick={handleToggleUnknown}>
                Show Unknown Scores
              </label>
              <div className="toggle-switch" onClick={handleToggleUnknown}>
                <input
                  id="show-unknown"
                  type="checkbox"
                  checked={showUnknown}
                  onChange={handleToggleUnknown}
                  className="toggle-input"
                />
                <span className="toggle-slider"></span>
              </div>
            </div>
          </div>
        </div>
        
        <Table
          data={filteredData}
          columns={columns}
          keyExtractor={(score) => `${score.identifier}-${score.score}`}
          defaultSortKey="posted"
          defaultSortOrder="desc"
          loading={loading}
          loadingMessage="Loading scores..."
          emptyMessage={`No ${showUnknown ? "unknown" : ""} scores found`}
          onRowClick={handleRowClick}
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
        
        {(selectedSong || modalLoading) && (
          <SongModal
            show={true}
            onHide={handleModalClose}
            initialSong={selectedSong}
            loading={modalLoading}
            previousSongIds={getSurroundingSongIds().prevSongIds}
            nextSongIds={getSurroundingSongIds().nextSongIds}
          />
        )}
        
        {selectedUnknownScore && showUnknown && (
          <UnknownSongModal
            show={true}
            onHide={handleUnknownModalClose}
            score={selectedUnknownScore}
          />
        )}
      </div>
    </>
  );
};

export default UserScores;