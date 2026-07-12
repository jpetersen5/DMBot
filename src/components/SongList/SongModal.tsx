import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { API_URL } from "../../App";
import RelatedSongs from "./RelatedSongs";
import RelatedSongsSkeleton from "./RelatedSongsSkeleton";
import SongInfo from "./SongInfo";
import SongInfoSkeleton from "./SongInfoSkeleton";
import { renderSafeHTML } from "../../utils/safeHTML";
import { Song } from "../../utils/song";
import { useAuth } from "../../context/AuthContext";
import Modal from "../ui/Modal/Modal";
import Skeleton from "../ui/Skeleton/Skeleton";
import "./SongModal.scss";
import Leaderboard from "../Leaderboard/Leaderboard";
import LeaderboardSkeleton from "../Leaderboard/LeaderboardSkeleton";

interface SongModalProps {
  show: boolean;
  onHide: () => void;
  song: Song | null;
  loading: boolean;
  songId?: string;
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
  songId,
  previousSongIds,
  nextSongIds,
  songPath,
  onSongUpdate
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [previousSongIdStack, setPreviousSongIdStack] = useState<string[]>([]);

  if (!song && !loading) return null;

  const routeIdIsNumeric = songId != null && /^\d+$/.test(songId);
  const leaderboardSongId = routeIdIsNumeric ? songId : song?.id?.toString();

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
    if (!song || song.id === relatedSong.id) return;
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
    <Modal
      show={show}
      onHide={onHide}
      size="xl"
      dialogClassName="song-modal"
      title={
        song
          ? <span dangerouslySetInnerHTML={renderSafeHTML(song.name || "")} />
          : <Skeleton width={280} height={24} />
      }
      headerStart={
        previousSongIdStack.length > 0 && (
          <button onClick={handleBack} className="back-button">
            ←
          </button>
        )
      }
      footer={
        <button className="close-button" onClick={onHide}>Close</button>
      }
      extras={
        <>
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
        </>
      }
    >
      {song && <AdminControls currentSong={song} onSongUpdate={onSongUpdate} onHide={onHide} />}
      <div className="song-details">
        {song
          ? <SongInfo song={song} key={song.id.toString()} />
          : <SongInfoSkeleton />}
        {song
          ? <RelatedSongs currentSong={song} handleRelatedSongClick={handleRelatedSongClick} />
          : <RelatedSongsSkeleton />}
      </div>
      {leaderboardSongId
        ? <Leaderboard songId={leaderboardSongId} key={leaderboardSongId} />
        : <LeaderboardSkeleton />}
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