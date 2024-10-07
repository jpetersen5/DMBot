import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Modal } from "react-bootstrap";
import { API_URL } from "../../App";
import LoadingSpinner from "../Loading/LoadingSpinner";
import CharterName from "./CharterName";
import RelatedSongs from "./RelatedSongs";
import { renderSafeHTML, processColorTags } from "../../utils/safeHTML";
import { Song, msToTime } from "../../utils/song";
import { useAuth } from "../../context/AuthContext";
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

  useEffect(() => {
    if (initialSong) {
      setCurrentSong(initialSong);
    }
  }, [initialSong, location.search]);

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
          <SongInfo song={currentSong} />
          <RelatedSongs
            currentSong={currentSong}
            handleRelatedSongClick={handleRelatedSongClick}
          />
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


interface SongInfoProps {
  song: Song;
}

const SongInfo: React.FC<SongInfoProps> = ({ song }) => {
  return (
    <div className="song-info">
      <SongInfoLine label="Artist" value={song.artist} />
      <SongInfoLine label="Album" value={song.album} />
      <SongInfoLine label="Year" value={song.year} />
      <SongInfoLine label="Genre" value={song.genre} />
      <SongInfoLine label="Difficulty" value={song.difficulties ? Object.values(song.difficulties).join(", ") : "Unknown"} />
      <SongInfoLine label="Length" value={msToTime(song.song_length || 0)} />
      <SongInfoLine label="Charter" value={song.charter_refs ? song.charter_refs.join(", ") : "Unknown Author"} />
      <SongInfoLine label="MD5" value={song.md5} />
    </div>
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