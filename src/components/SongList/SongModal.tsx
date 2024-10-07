import React, { useState, useEffect, useMemo } from "react";
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

interface RelatedSongs {
  album_songs: Song[];
  artist_songs: Song[];
  genre_songs: Song[];
  charter_songs: Song[];
}

enum RelatedSongsType {
  album = "album",
  artist = "artist",
  genre = "genre",
  charter = "charter"
}

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
  const [relatedSongs, setRelatedSongs] = useState<RelatedSongs>({
    album_songs: [],
    artist_songs: [],
    genre_songs: [],
    charter_songs: []
  });
  const [relationType, setRelationType] = useState<RelatedSongsType>(RelatedSongsType.album);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const { getCachedResult, setCachedResult } = useSongCache();

  // related songs pagination
  const [page, setPage] = useState(1);
  const [inputPage, setInputPage] = useState("1");
  const perPage = 8;

  useEffect(() => {
    if (initialSong) {
      setCurrentSong(initialSong);

      const params = new URLSearchParams(location.search);
      const initialRelationType = params.get("relation") as RelatedSongsType || RelatedSongsType.album;
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

  const getCacheKey = (type: RelatedSongsType) => {
    if (currentSong) {
      if (type === RelatedSongsType.charter) {
        if (currentSong.charter_refs === null) {
          currentSong.charter_refs = ["Unknown Author"];
        }
        return `related_charter_${currentSong.charter_refs.join(",")}`;
      }
      if (type === RelatedSongsType.album) {
        return `related_album_${currentSong.album || "Unknown Album"}`;
      }
      if (type === RelatedSongsType.artist) {
        return `related_artist_${currentSong.artist || "Unknown Artist"}`;
      }
      if (type === RelatedSongsType.genre) {
        return `related_genre_${currentSong.genre || "Unknown Genre"}`;
      }
    }
    return "";
  };

  const fetchRelatedSongs = async () => {
    if (!currentSong) return;
    setRelatedLoading(true);
    const cacheKey = getCacheKey(relationType);
    const cachedResult = getCachedResult(cacheKey);
    if (cachedResult) {
      const relatedSongsNew = { ...relatedSongs };
      relatedSongsNew[`${relationType}_songs`] = cachedResult.songs;
      setRelatedSongs(relatedSongsNew);
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
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch related songs");
      const data: RelatedSongs = await response.json();
      const relatedSongsNew = { ...relatedSongs };
      relatedSongsNew[`${relationType}_songs`] = data[`${relationType}_songs`];
      setRelatedSongs(relatedSongsNew);
      setCachedResult(cacheKey, { songs: data[`${relationType}_songs`], total: data[`${relationType}_songs`].length, timestamp: Date.now() });
    } catch (error) {
      console.error("Error fetching related songs:", error);
    } finally {
      setRelatedLoading(false);
    }
  };

  const paginatedRelatedSongs = useMemo(() => {
    return relatedSongs[`${relationType}_songs`].slice((page - 1) * perPage, page * perPage);
  }, [relatedSongs, relationType, page]);

  const totalPages = Math.ceil(relatedSongs[`${relationType}_songs`].length / perPage);

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
      case RelatedSongsType.album:
        columns = ["#", "Name", "Length"];
        break;
      case RelatedSongsType.artist:
        columns = ["Name", "Album", "Length"];
        break;
      case RelatedSongsType.genre:
      case RelatedSongsType.charter:
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
          {!relatedLoading && paginatedRelatedSongs.map((relatedSong) => (
            <tr key={relatedSong.id} onClick={() => handleRelatedSongClick(relatedSong)}>
              {relationType === RelatedSongsType.album && <SongTableCell content={relatedSong.track?.toString() || "N/A"} />}
              <SongTableCell content={relatedSong.name} />
              {relationType === RelatedSongsType.artist && <SongTableCell content={relatedSong.album} />}
              {(relationType === RelatedSongsType.genre || relationType === RelatedSongsType.charter) && <SongTableCell content={relatedSong.artist} />}
              <SongTableCell content={msToTime(relatedSong.song_length || 0)} />
            </tr>
          ))}
          {!relatedLoading && paginatedRelatedSongs.length === 0 && (
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
            <SongInfoLine label="Difficulty" value={currentSong.difficulties ? Object.values(currentSong.difficulties).join(", ") : "Unknown"} />
            <SongInfoLine label="Length" value={msToTime(currentSong.song_length || 0)} />
            <SongInfoLine label="Charter" value={currentSong.charter_refs ? currentSong.charter_refs.join(", ") : "Unknown Author"} />
            <SongInfoLine label="MD5" value={currentSong.md5} />
          </div>
          <div className="related-songs">
            <h5>Related Songs</h5>
            <div className="related-songs-topbar">
              <Nav variant="tabs" activeKey={relationType} onSelect={(k) => setRelationType(k as RelatedSongsType)}>
                <Nav.Item>
                  <Nav.Link eventKey={RelatedSongsType.album}>Album</Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey={RelatedSongsType.artist}>Artist</Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey={RelatedSongsType.genre}>Genre</Nav.Link>
                </Nav.Item>
                {numCharters > 0 && (
                  <Nav.Item>
                    <Nav.Link eventKey={RelatedSongsType.charter}>{`Charter${numCharters > 1 ? "s" : ""}`}</Nav.Link>
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