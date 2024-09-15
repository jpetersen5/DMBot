import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Modal, Nav } from "react-bootstrap";
import { API_URL } from "../../App";
import LoadingSpinner from "../Loading/LoadingSpinner";
import CharterName from "./CharterName";
import { SongTableCell } from "./SongList";
import { renderSafeHTML, processColorTags } from "../../utils/safeHTML";
import { Song, msToTime } from "../../utils/song";
import { Pagination } from "./TableControls";
import { useAuth } from "../../context/AuthContext";
import { useSongCache } from "../../context/SongContext";
import "./SongModal.scss";
import Leaderboard from "../Leaderboard/Leaderboard";

interface SongModalProps {
  show: boolean;
  onHide: () => void;
  initialSong: Song | null;
  loading: boolean;
  previousSongIds: string[];
  nextSongIds: string[];
}

const SongModal: React.FC<SongModalProps> = ({ 
  show, 
  onHide, 
  initialSong, 
  loading, 
  previousSongIds, 
  nextSongIds 
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [previousSongs, setPreviousSongs] = useState<Song[]>([]);
  const [relatedSongs, setRelatedSongs] = useState<Song[]>([]);
  const [relationType, setRelationType] = useState<"album" | "artist" | "genre" | "charter">("album");
  const [relatedLoading, setRelatedLoading] = useState(false);
  const { getCachedResult, setCachedResult } = useSongCache();

  // related songs pagination
  const [page, setPage] = useState(1);
  const [totalRelatedSongs, setTotalRelatedSongs] = useState(0);
  const [inputPage, setInputPage] = useState("1");
  const perPage = 8;
  const totalPages = Math.ceil(totalRelatedSongs / perPage);

  useEffect(() => {
    if (initialSong) {
      setCurrentSong(initialSong);

      const params = new URLSearchParams(location.search);
      const initialRelationType = params.get("relation") as "album" | "artist" | "genre" | "charter" || "album";
      setRelationType(initialRelationType);
    }
  }, [initialSong, location.search]);

  const navigateToSong = (songId: number | string) => {
    const params = new URLSearchParams(location.search);
    navigate(`${location.pathname.split("/").slice(0, -1).join("/")}/${songId}?${params.toString()}`);
  }

  const handlePrevSong = () => {
    if (previousSongIds.length > 0) {
      const prevSongId = previousSongIds[previousSongIds.length - 1];
      navigateToSong(prevSongId);
    }
  };

  const handleNextSong = () => {
    if (nextSongIds.length > 0) {
      const nextSongId = nextSongIds[0];
      navigateToSong(nextSongId);
    }
  };

  useEffect(() => {
    if (currentSong) {
      fetchRelatedSongs();
      updateURL();
    }
  }, [currentSong, relationType, page]);

  useEffect(() => {
    setPage(1);
    setInputPage("1");
  }, [relationType]);

  const updateURL = () => {
    if (!currentSong) return;
    const params = new URLSearchParams(location.search);
    params.set("relation", relationType);
    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
  };

  const getCacheKey = () => {
    if (relationType === "album") return `related_${relationType}_${currentSong?.album}_${page}_${perPage}`;
    if (relationType === "artist") return `related_${relationType}_${currentSong?.artist}_${page}_${perPage}`;
    if (relationType === "genre") return `related_${relationType}_${currentSong?.genre}_${page}_${perPage}`;
    if (relationType === "charter") return `related_${relationType}_${currentSong?.charter_refs?.join(",")}_${page}_${perPage}`;
    return "";
  };

  const fetchRelatedSongs = async () => {
    if (!currentSong) return;
    setRelatedLoading(true);
    const cacheKey = getCacheKey();
    const cachedResult = getCachedResult(cacheKey);

    if (cachedResult) {
      setRelatedSongs(cachedResult.songs);
      setTotalRelatedSongs(cachedResult.total);
      setRelatedLoading(false);
      return;
    }

    try {
      let url = `${API_URL}/api/related-songs?${relationType}=`;
      if (currentSong.charter_refs === null) {
        currentSong.charter_refs = ["Unknown Author"];
      }
      if (relationType === "charter") {
        url += encodeURIComponent(currentSong.charter_refs.join(","));
      } else {
        url += encodeURIComponent(currentSong[relationType] || `Unknown ${relationType}`);
      }
      url += `&page=${page}&per_page=${perPage}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch related songs");
      const data = await response.json();
      setRelatedSongs(data.songs);
      setTotalRelatedSongs(data.total);
      setCachedResult(cacheKey, { songs: data.songs, total: data.total, timestamp: Date.now() });
    } catch (error) {
      console.error("Error fetching related songs:", error);
    } finally {
      setRelatedLoading(false);
    }
  };

  if (loading) {
    return (
      <Modal show={show} onHide={onHide} size="xl" dialogClassName="song-modal loading">
        <Modal.Header>
          <button onClick={onHide} className="back-button">
            &times;
          </button>
          <Modal.Title>{"Loading..."}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <LoadingSpinner message="Loading song details..." />
        </Modal.Body>
      </Modal>
    );
  }

  if (!currentSong) return null;

  const handleRelatedSongClick = (song: Song) => {
    if (currentSong.id === song.id) return;
    setPreviousSongs([...previousSongs, currentSong]);
    setCurrentSong(song);
    navigateToSong(song.id);
  };

  const handleSongUpdate = (song: Song) => {
    setCurrentSong(song);
  };

  const handleBack = () => {
    if (previousSongs.length > 0) {
      const lastSong = previousSongs[previousSongs.length - 1];
      setCurrentSong(lastSong);
      setPreviousSongs(prev => prev.slice(0, -1));
      navigateToSong(lastSong.id);
    } else {
      onHide();
      setPreviousSongs([]);
    }
  };

  const renderRelatedSongsTable = () => {
    let columns;
    switch (relationType) {
      case "album":
        columns = ["#", "Name", "Length"];
        break;
      case "artist":
        columns = ["Name", "Album", "Length"];
        break;
      case "genre":
      case "charter":
        columns = ["Name", "Artist", "Length"];
        break;
    }

    return (
      <table className="related-songs-table">
        <thead>
          <tr>
            {columns.map(col => <th key={col}>{col}</th>)}
          </tr>
        </thead>
        <tbody>
          {relatedLoading && <tr><td colSpan={columns.length}><LoadingSpinner /></td></tr>}
          {!relatedLoading && relatedSongs.map((relatedSong) => (
            <tr key={relatedSong.id} onClick={() => handleRelatedSongClick(relatedSong)}>
              {relationType === "album" && <SongTableCell content={relatedSong.track || "N/A"} />}
              <SongTableCell content={relatedSong.name} />
              {relationType === "artist" && <SongTableCell content={relatedSong.album} />}
              {(relationType === "genre" || relationType === "charter") && <SongTableCell content={relatedSong.artist} />}
              <SongTableCell content={msToTime(relatedSong.song_length || 0)} />
            </tr>
          ))}
          {!relatedLoading && relatedSongs.length === 0 && (
            <tr><td colSpan={columns.length}>{`No related songs from ${relationType}`}</td></tr>
          )}
        </tbody>
      </table>
    );
  };

  const numCharters = currentSong.charter_refs?.length || 0;

  return (
    <Modal show={show} onHide={onHide} size="xl" dialogClassName="song-modal">
      <Modal.Header>
        <button onClick={handleBack} className="back-button">
          {previousSongs.length > 0 ? "←" : "×"}
        </button>
        <Modal.Title>
          <span dangerouslySetInnerHTML={renderSafeHTML(currentSong.name || "")} />
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <AdminControls currentSong={currentSong} onSongUpdate={handleSongUpdate} onHide={onHide} />
        <div className="song-details">
          <div className="artist-info">
            <SongInfoLine label="Artist" value={currentSong.artist} />
            <SongInfoLine label="Album" value={currentSong.album} />
            <SongInfoLine label="Year" value={currentSong.year} />
            <SongInfoLine label="Genre" value={currentSong.genre} />
            <SongInfoLine label="Difficulty" value={currentSong.difficulty} />
            <SongInfoLine label="Length" value={msToTime(currentSong.song_length || 0)} />
            <SongInfoLine label="Charter" value={currentSong.charter_refs ? currentSong.charter_refs.join(", ") : "Unknown Author"} />
            <SongInfoLine label="MD5" value={currentSong.md5} />
          </div>
          <div className="related-songs">
            <h5>Related Songs</h5>
            <div className="related-songs-topbar">
              <Nav variant="tabs" activeKey={relationType} onSelect={(k) => setRelationType(k as "album" | "artist" | "genre" | "charter")}>
                <Nav.Item>
                  <Nav.Link eventKey="album">Album</Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey="artist">Artist</Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey="genre">Genre</Nav.Link>
                </Nav.Item>
                {numCharters > 0 && (
                  <Nav.Item>
                    <Nav.Link eventKey="charter">{`Charter${numCharters > 1 ? "s" : ""}`}</Nav.Link>
                  </Nav.Item>
                )}
              </Nav>
              <div className="pagination-container">
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  inputPage={inputPage}
                  setInputPage={setInputPage}
                  setPage={setPage}
                  size="sm"
                />
              </div>
            </div>
            {renderRelatedSongsTable()}
          </div>
        </div>
        <Leaderboard songId={currentSong.id.toString()} key={currentSong.id.toString()} />
      </Modal.Body>
      <Modal.Footer>
        <button className="close-button" onClick={onHide}>Close</button>
      </Modal.Footer>
      <button
        onClick={handlePrevSong}
        disabled={previousSongIds.length === 0}
        className="nav-button prev-button"
      >
        {"<"}
      </button>
      <button
        onClick={handleNextSong}
        disabled={nextSongIds.length === 0}
        className="nav-button next-button"
      >
        {">"}
      </button>
    </Modal>
  );
};

interface SongInfoLineProps {
  label: string;
  value: string | number | null;
}

const SongInfoLine: React.FC<SongInfoLineProps> = ({ label, value }) => {
  if (value == null) {
    return <p><strong>{label}:</strong>  N/A</p>
  }
  else if (label === "MD5") {
    return <p><strong>{label}:</strong> <code>{value}</code></p>
  }
  else if (label === "Charter") {
    return <div className="charter"><p><strong>{label}:</strong></p> <CharterName names={value as string} /></div>
  }
  const processedValue = typeof value === "string" 
    ? processColorTags(value)
    : String(value);
  return (
    <p><strong>{label}:</strong> <span dangerouslySetInnerHTML={renderSafeHTML(processedValue)} /></p>
  );
};

interface AdminControlsProps {
  currentSong: Song;
  onSongUpdate: (song: Song) => void;
  onHide: () => void;
}

const AdminControls: React.FC<AdminControlsProps> = ({ currentSong, onSongUpdate, onHide }) => {
  const { isAdmin } = useAuth();
  const isUnverified = currentSong.name?.includes("(Unverified)") || false;

  if (!isAdmin) return null;

  const handleAdminAction = async (action: "verify" | "remove") => {
    try {
      const response = await fetch(`${API_URL}/api/songs/${currentSong.id}/admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("auth_token")}`
        },
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        throw new Error("Failed to perform admin action");
      }

      const result = await response.json();

      if (action === "verify") {
        const updatedSong: Song = {
          ...currentSong,
          name: currentSong.name?.replace(" (Unverified)", "") || ""
        };
        onSongUpdate(updatedSong);
      } else if (action === "remove") {
        onHide();
      }

      alert(result.message);
    } catch (error) {
      console.error("Error performing admin action:", error);
      alert("An error occurred while performing the action");
    }
  };

  return (
    <div className="admin-controls">
      {isUnverified && (
        <button className="verify-button" onClick={() => handleAdminAction("verify")}>
          Verify
        </button>
      )}
      <button className="remove-button" onClick={() => {
        if (window.confirm("Are you sure you want to remove this song?")) {
          handleAdminAction("remove");
        }
      }}>
        Remove
      </button>
    </div>
  );
};

export default SongModal;