import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TableControls, Pagination } from "../../SongList/TableControls";
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

const UserScores: React.FC<UserScoresProps> = ({ userId }) => {
  const { songId } = useParams<{ songId: string }>();
  const navigate = useNavigate();

  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [inputPage, setInputPage] = useState(page.toString());
  const [totalScores, setTotalScores] = useState(0);
  const [perPage, setPerPage] = useState(10);
  const [sortBy, setSortBy] = useState("posted");
  const [sortOrder, setSortOrder] = useState("desc");

  const [showUnknown, setShowUnknown] = useState(false);
  const [selectedUnknownScore, setSelectedUnknownScore] = useState<UnknownScore | null>(null);

  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const totalPages = Math.ceil(totalScores / perPage);

  useEffect(() => {
    fetchScores();
  }, [userId, page, perPage, sortBy, sortOrder, showUnknown]);

  async function fetchScores() {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString(),
        sort_by: sortBy,
        sort_order: sortOrder,
        unknown: showUnknown.toString()
      });
      const response = await fetch(`${API_URL}/api/user/${userId}/scores?${queryParams}`);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data = await response.json();
      setScores(data.scores);
      setTotalScores(data.total);
    } catch (error) {
      console.error("Error fetching scores:", error);
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
    const currentScoreIndex = scores.findIndex(score => score.identifier === songId);
    if (currentScoreIndex === -1) return { prevSongIds: [], nextSongIds: [] };
    const prevSongIds = scores.slice(Math.max(0, currentScoreIndex - perPage), currentScoreIndex).map(score => score.identifier);
    const nextSongIds = scores.slice(currentScoreIndex + 1, currentScoreIndex + perPage).map(score => score.identifier);
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
        <h2>User Scores</h2>
        <div className="control-bar">
          <TableControls perPage={perPage} setPerPage={setPerPage} setPage={setPage} />
          <Pagination
            page={page}
            totalPages={totalPages}
            inputPage={inputPage}
            setPage={setPage}
            setInputPage={setInputPage}
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
            {!loading && scores.length === 0 && (
              <tr>
                <td colSpan={Object.keys(SCORE_TABLE_HEADERS).length}>No scores found</td>
              </tr>
            )}
            {!loading && scores.length > 0 && (
              scores.map((score, index) => (
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