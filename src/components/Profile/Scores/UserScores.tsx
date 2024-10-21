import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TableControls, Pagination, Search } from "../../SongList/TableControls";
import SongModal from "../../SongList/SongModal";
import LoadingSpinner from "../../Loading/LoadingSpinner";
import UnknownSongModal from "./UnknownSongModal";
import { SongTableCell } from "../../SongList/SongList";
import { API_URL } from "../../../App";
import { useKeyPress } from "../../../hooks/useKeyPress";
import {
  Score,
  Scores,
  UnknownScore,
  SCORE_TABLE_HEADERS,
  formatRank
} from "../../../utils/score";
import { Song } from "../../../utils/song";
import "./UserScores.scss";

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
  const [page, setPage] = useState<number>(1);
  const [inputPage, setInputPage] = useState<string>(page.toString());
  const [perPage, setPerPage] = useState<number>(10);
  const [sortBy, setSortBy] = useState<string>("posted");
  const [secondarySortBy, setSecondarySortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [secondarySortOrder, setSecondarySortOrder] = useState<"asc" | "desc">("desc");
  const shiftPressed = useKeyPress("Shift");
  const [search, setSearch] = useState<string>("");
  const [filters, setFilters] = useState<string[]>([]);

  const [showUnknown, setShowUnknown] = useState<boolean>(false);
  const [selectedUnknownScore, setSelectedUnknownScore] = useState<UnknownScore | null>(null);

  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchScores();
  }, [userId]);

  useEffect(() => {
    setPage(1);
    setInputPage("1");
  }, [search, filters]);

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

  function getSortValues(a: Score, b: Score, sortKey: string) {
    let aValue = a[sortKey as keyof Score];
    let bValue = b[sortKey as keyof Score];
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
    if (sortKey === "rank" && sortOrder === "asc") {
      aValue = a.rank ? aValue : 1000000;
      bValue = b.rank ? bValue : 1000000;
    } else if (sortKey === "rank" && sortOrder === "desc") {
      aValue = a.rank ? aValue : 0;
      bValue = b.rank ? bValue : 0;
    }
    if (sortKey === "posted") {
      aValue = a.posted ? aValue : new Date(0).toISOString();
      bValue = b.posted ? bValue : new Date(0).toISOString();
    }
    return [aValue, bValue];
  }

  const filteredAndSortedScores = useMemo(() => {
    let filteredScores = showUnknown ? scores.unknown_scores : scores.scores;
    if (!filteredScores) return [];

    if (search) {
      const searchTermsLower = search.toLowerCase().split(" ");
      filteredScores = filteredScores.filter(score => {
        if (filters.length === 0) {
          return searchTermsLower.every(term => 
            score.score.toString().includes(term) ||
            score.song_name.toLowerCase().includes(term) ||
            score.artist.toLowerCase().includes(term) ||
            score.identifier.toLowerCase().includes(term)
          )
        } else {
          return searchTermsLower.every(term => 
            filters.includes("score") && score.score.toString().includes(term) ||
            filters.includes("song_name") && score.song_name.toLowerCase().includes(term) ||
            filters.includes("artist") && score.artist.toLowerCase().includes(term) ||
            filters.includes("identifier") && score.identifier.toLowerCase().includes(term)
          )
        }
      });
    } else {
      // I don't know why this is necessary, but it is
      filteredScores = filteredScores.filter(score => {
        return score;
      });
    }

    return filteredScores.sort((a, b) => {
      const [aValue, bValue] = getSortValues(a, b, sortBy);
      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      if (secondarySortBy) {
        const [aSecondaryValue, bSecondaryValue] = getSortValues(a, b, secondarySortBy);
        if (aSecondaryValue < bSecondaryValue) return secondarySortOrder === "asc" ? -1 : 1;
        if (aSecondaryValue > bSecondaryValue) return secondarySortOrder === "asc" ? 1 : -1;
      }
      return 0;
    });
  }, [scores, showUnknown, sortBy, sortOrder, secondarySortBy, secondarySortOrder, search, filters]);

  const paginatedScores = useMemo(() => {
    const startIndex = (page - 1) * perPage;
    return filteredAndSortedScores.slice(startIndex, startIndex + perPage);
  }, [filteredAndSortedScores, page, perPage]);

  const totalPages = Math.ceil(filteredAndSortedScores.length / perPage);

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

  const handleToggleUnknown = () => {
    setShowUnknown(prev => !prev);
    setPage(1);
    setInputPage("1");
    setSortBy("posted");
    setSortOrder("desc");
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
    navigate(`/user/${userId}`);
  };

  const handleUnknownModalClose = () => {
    setSelectedUnknownScore(null);
  };

  const getSurroundingSongIds = () => {
    const currentScoreIndex = filteredAndSortedScores.findIndex(score => score.identifier === songId);
    if (currentScoreIndex === -1) return { prevSongIds: [], nextSongIds: [] };
    const prevSongIds = filteredAndSortedScores.slice(0, currentScoreIndex).map(score => score.identifier);
    const nextSongIds = filteredAndSortedScores.slice(currentScoreIndex + 1).map(score => score.identifier);
    return { prevSongIds, nextSongIds };
  };

  const handleRowClick = (score: Score | UnknownScore) => {
    if (showUnknown) {
      setSelectedUnknownScore(score as UnknownScore);
    } else {
      navigate(`/user/${userId}/${score.identifier}`);
    }
  };

  return (
    <>
      <div className="user-scores">
        <div className="user-scores-header">
          <h2>{`${showUnknown ? "Unknown" : ""} User Scores`}</h2>
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
        <div className="control-bar">
          <TableControls perPage={perPage} setPerPage={setPerPage} setPage={setPage} />
          <Pagination
            page={page}
            totalPages={totalPages}
            inputPage={inputPage}
            setPage={setPage}
            setInputPage={setInputPage}
          />
          <Search
            search={search}
            filters={filters}
            filterOptions={filterOptions}
            setSearch={setSearch}
            setFilters={setFilters}
            submitSearch={() => {}}
          />
        </div>
        <table>
          <thead>
            <tr>
              {Object.entries(SCORE_TABLE_HEADERS).map(([key, value]) => (
                <ScoreTableHeader
                  key={key}
                  content={value}
                  onClick={() => handleSort(key)}
                  sort={sortBy === key || secondarySortBy === key}
                  sortOrder={sortBy === key ? sortOrder : secondarySortOrder}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={Object.keys(SCORE_TABLE_HEADERS).length}>
                  <LoadingSpinner message="Loading scores..." />
                </td>
              </tr>
            )}
            {!loading && paginatedScores.length === 0 && (
              <tr>
                <td colSpan={Object.keys(SCORE_TABLE_HEADERS).length}>
                  {`No ${showUnknown ? "unknown" : ""} scores found`}
                </td>
              </tr>
            )}
            {!loading && paginatedScores.length > 0 && (
              paginatedScores.map((score, index) => (
                <ScoreTableRow 
                  key={index} 
                  score={score}
                  onClick={() => handleRowClick(score)}
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
    </>
  );
};

interface ScoreTableHeaderProps {
  onClick: () => void;
  content: string;
  sort: boolean;
  sortOrder: string;
}

const ScoreTableHeader: React.FC<ScoreTableHeaderProps> = ({ onClick, content, sort, sortOrder }) => (
  <th onClick={onClick}>
    <div className="header-content">
      <span className="header-text">{content}</span>
      {sort && <span className="sort-arrow">{sortOrder === "asc" ? "▲" : "▼"}</span>}
    </div>
  </th>
);

interface ScoreTableRowProps {
  score: Score;
  onClick: () => void;
}

const ScoreTableRow: React.FC<ScoreTableRowProps> = ({ score, onClick }) => {
  return (
    <tr onClick={onClick} style={{ cursor: "pointer" }}>
      <SongTableCell content={score.song_name} />
      <SongTableCell content={score.artist} />
      <SongTableCell content={score.score.toLocaleString()} />
      <SongTableCell content={score.percent.toString()} special={score.is_fc ? "fc_percent" : "percent"} />
      <SongTableCell content={score.speed.toString()} special="percent" />
      <SongTableCell content={score.is_fc ? "Yes" : "No"} />
      <SongTableCell content={score.play_count ? score.play_count.toString() : "N/A"} />
      <SongTableCell content={score.posted} special="last_update" />
      <SongTableCell content={formatRank(score.rank)} />
    </tr>
  );
};

export default UserScores;