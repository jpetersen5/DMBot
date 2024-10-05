import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TableControls, Pagination, Search } from "../../SongList/TableControls";
import SongModal from "../../SongList/SongModal";
import LoadingSpinner from "../../Loading/LoadingSpinner";
import UnknownSongModal from "./UnknownSongModal";
import { SongTableCell } from "../../SongList/SongList";
import { API_URL } from "../../../App";
import { Song } from "../../../utils/song";
import "./UserScores.scss";

export interface Score {
  is_fc: boolean;
  score: number;
  speed: number;
  artist: string;
  percent: number;
  song_name: string;
  identifier: string;
  play_count: number;
  posted: string;
}

interface UnknownScore extends Score {
  filepath: string | null;
}

export interface Scores {
  scores: Score[];
  unknown_scores: UnknownScore[];
}

interface UserScoresProps {
  userId: string;
}

const SCORE_TABLE_HEADERS = {
  song_name: "Song",
  artist: "Artist",
  score: "Score",
  percent: "Percent",
  speed: "Speed",
  is_fc: "FC",
  play_count: "Plays",
  posted: "Posted"
};

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
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [inputPage, setInputPage] = useState(page.toString());
  const [perPage, setPerPage] = useState(10);
  const [sortBy, setSortBy] = useState("posted");
  const [sortOrder, setSortOrder] = useState("desc");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<string[]>([]);

  const [showUnknown, setShowUnknown] = useState(false);
  const [selectedUnknownScore, setSelectedUnknownScore] = useState<UnknownScore | null>(null);

  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    fetchScores();
  }, [userId]);

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
      let aValue = a[sortBy as keyof Score];
      let bValue = b[sortBy as keyof Score];
      if (typeof aValue === "string") {
        aValue = aValue.toLowerCase();
      }
      if (typeof bValue === "string") {
        bValue = bValue.toLowerCase();
      }
      if (sortBy === "percent") { // FC's take priority over non-FC's
        aValue = a.is_fc ? 101 : aValue;
        bValue = b.is_fc ? 101 : bValue;
      }
      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [scores, showUnknown, sortBy, sortOrder, search, filters]);

  const paginatedScores = useMemo(() => {
    const startIndex = (page - 1) * perPage;
    return filteredAndSortedScores.slice(startIndex, startIndex + perPage);
  }, [filteredAndSortedScores, page, perPage]);

  const totalPages = Math.ceil(filteredAndSortedScores.length / perPage);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
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
                  sort={sortBy === key}
                  sortOrder={sortOrder}
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
    </tr>
  );
};

export default UserScores;