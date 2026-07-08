import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Modal } from "react-bootstrap";
import { API_URL } from "../../App";
import LoadingSpinner from "../Loading/LoadingSpinner";
import RelatedSongs from "./RelatedSongs";
import SongInfo from "./SongInfo";
import { renderSafeHTML } from "../../utils/safeHTML";
import { Song } from "../../utils/song";
import { useAuth } from "../../context/AuthContext";
import "./SongModal.scss";
import Leaderboard from "../Leaderboard/Leaderboard";
import ModalCloseButton from "../Extras/ModalCloseButton";

interface SongModalProps {
  show: boolean;
  onHide: () => void;
  song: Song | null;
  loading: boolean;
  previousSongIds: string[];
  nextSongIds: string[];
  songPath: (songId: string | number) => string;
  onSongUpdate: (song: Song) => void;
}

const SongModal: React.FC<SongModalProps> = ({
  show,
  onHide,
  song,
  loading,
  previousSongIds,
  nextSongIds,
  songPath,
  onSongUpdate
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [previousSongIdStack, setPreviousSongIdStack] = useState<string[]>([]);

  if (loading) {
    return (
      <Modal show={show} onHide={onHide} size="xl" dialogClassName="song-modal loading">
        <Modal.Header>
          <Modal.Title>{"Loading..."}</Modal.Title>
          <ModalCloseButton onClick={onHide} />
        </Modal.Header>
        <Modal.Body>
          <LoadingSpinner message="Loading song details..." />
        </Modal.Body>
      </Modal>
    );
  }

  if (!song) return null;

  const navigateToSong = (songId: number | string) => {
    const params = new URLSearchParams(location.search);
    navigate(`${songPath(songId)}?${params.toString()}`);
  };

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

  const handleRelatedSongClick = (relatedSong: Song) => {
    if (song.id === relatedSong.id) return;
    setPreviousSongIdStack(prev => [...prev, song.id.toString()]);
    navigateToSong(relatedSong.id);
  };

  const handleBack = () => {
    if (previousSongIdStack.length > 0) {
      const lastSongId = previousSongIdStack[previousSongIdStack.length - 1];
      setPreviousSongIdStack(prev => prev.slice(0, -1));
      navigateToSong(lastSongId);
    } else {
      onHide();
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" dialogClassName="song-modal">
      <Modal.Header>
        {previousSongIdStack.length > 0 && (
          <button onClick={handleBack} className="back-button">
            ←
          </button>
        )}
        <Modal.Title>
          <span dangerouslySetInnerHTML={renderSafeHTML(song.name || "")} />
        </Modal.Title>
        <ModalCloseButton onClick={onHide} />
      </Modal.Header>
      <Modal.Body>
        <AdminControls currentSong={song} onSongUpdate={onSongUpdate} onHide={onHide} />
        <div className="song-details">
          <SongInfo song={song} key={song.id.toString()} />
          <RelatedSongs
            currentSong={song}
            handleRelatedSongClick={handleRelatedSongClick}
          />
        </div>
        <Leaderboard songId={song.id.toString()} key={song.id.toString()} />
      </Modal.Body>
      <Modal.Footer>
        <button className="close-button" onClick={onHide}>Close</button>
      </Modal.Footer>
      <button
        onClick={handlePrevSong}
        disabled={previousSongIds.length === 0}
        className="nav-button prev-button"
      >
        {"←"}
      </button>
      <button
        onClick={handleNextSong}
        disabled={nextSongIds.length === 0}
        className="nav-button next-button"
      >
        {"→"}
      </button>
    </Modal>
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