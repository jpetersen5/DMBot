import React, { useState } from "react";
import { Modal } from "react-bootstrap";
import LoadingSpinner from "../../Loading/LoadingSpinner";
import { API_URL } from "../../../App";
import { Score } from "../../../utils/score";
import { formatExactTime, formatTimeDifference } from "../../../utils/song";
import Tooltip from "../../../utils/Tooltip/Tooltip";
import "./UnknownSongModal.scss";

interface UnknownSongModalProps {
  show: boolean;
  onHide: () => void;
  score: Score & { filepath: string | null };
}

const UnknownSongModal: React.FC<UnknownSongModalProps> = ({ show, onHide, score }) => {
  const [isUploadingCache, setIsUploadingCache] = useState(false);
  const [isUploadingIni, setIsUploadingIni] = useState(false);

  const handleSongcacheUpload = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".bin";
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
  
        try {
          setIsUploadingCache(true);
          const response = await fetch(`${API_URL}/api/upload_songcache`, {
            method: "POST",
            body: formData,
            headers: {
              "Authorization": `Bearer ${localStorage.getItem("auth_token")}`
            }
          });
  
          const result = await response.json();
  
          if (response.ok) {
            alert(`Songcache processed successfully. Updated ${result.updated_scores} scores. Refresh the page to see the updated filepaths.`);
            onHide();
          } else {
            alert(result.error || "An error occurred while processing the songcache");
          }
        } catch (error) {
          alert("An error occurred while uploading the songcache");
        } finally {
          setIsUploadingCache(false);
        }
      }
    };
    input.click();
  };

  const handleSongIniUpload = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".ini";
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("identifier", score.identifier);

        try {
          setIsUploadingIni(true);
          const response = await fetch(`${API_URL}/api/songs/upload_ini`, {
            method: "POST",
            body: formData,
            headers: {
              "Authorization": `Bearer ${localStorage.getItem("auth_token")}`
            }
          });

          const result = await response.json();

          if (response.ok) {
            alert(`Song.ini processed successfully. New song added to the database.`);
            onHide();
          } else {
            alert(result.error || "An error occurred while processing the song.ini");
          }
        } catch (error) {
          alert("An error occurred while uploading the song.ini");
        } finally {
          setIsUploadingIni(false);
        }
      }
    };
    input.click();
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" dialogClassName="unknown-song-modal">
      <Modal.Header closeButton>
        <Modal.Title>{score.song_name}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="unknown-song-details">
          <p><strong>Artist:</strong> {score.artist}</p>
          <p><strong>Score:</strong> {score.score.toLocaleString()}</p>
          <p><strong>Percent:</strong> {score.percent}%</p>
          <p><strong>Speed:</strong> {score.speed}%</p>
          <p><strong>FC:</strong> {score.is_fc ? "Yes" : "No"}</p>
          <p><strong>Play Count:</strong> {score.play_count}</p>
          <p><strong>Posted:</strong> {score.posted ? (
            <Tooltip text={formatExactTime(score.posted)}>
              {formatTimeDifference(score.posted)}
            </Tooltip>
          ) : "N/A"}</p>
          <p><strong>Identifier:</strong> {score.identifier}</p>
          <p><strong>Filepath:</strong> {score.filepath ? score.filepath : "Not yet found"}</p>
        </div>
        <div className="unknown-song-actions">
          {!score.filepath && (
            <button className="action-button" onClick={handleSongcacheUpload} disabled={isUploadingCache}>
              {isUploadingCache ? <LoadingSpinner message="Processing..." timeout={0} /> : "Upload songcache.bin to find this song's filepath"}
            </button>
          )}
          <button className="action-button" onClick={handleSongIniUpload} disabled={true}>
            {isUploadingIni ? <LoadingSpinner message="Processing..." timeout={0} /> : "Know this song? Upload its song.ini!"}
          </button>
          <h3>NOTICE: Uploading song.ini is currently disabled while things are updated to use the new song structure.</h3>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default UnknownSongModal;