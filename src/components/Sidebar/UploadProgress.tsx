import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { useUploadProgress } from "../../hooks/useUploadProgress";
import Draggable from "../../utils/Draggable";
import { processColorTags, renderSafeHTML } from "../../utils/safeHTML";

import "./UploadProgress.scss";
import Icon from "../Extras/Icon";
import closeIcon from "../../assets/close.svg?react";

const UploadProgress: React.FC = () => {
  const {
    isProcessing,
    isUploading,
    message,
    progress,
    completed,
    userId,
    resetUploadState,
    achievementErrors,
    warnings,
    buggedScores,
    status,
    clearAllNotifications,
  } = useUploadProgress();

  const [dismissed, setDismissed] = useState<boolean>(false);
  const [prevFlags, setPrevFlags] = useState({ isUploading, isProcessing, completed });
  const location = useLocation();
  const navigate = useNavigate();

  if (
    prevFlags.isUploading !== isUploading ||
    prevFlags.isProcessing !== isProcessing ||
    prevFlags.completed !== completed
  ) {
    setPrevFlags({ isUploading, isProcessing, completed });
    setDismissed(false);
  }

  const isVisible = (isUploading || isProcessing || completed) && !dismissed;

  const isOnProfilePage = userId && location.pathname.includes(`/user/${userId}`);

  useEffect(() => {
    if (completed && status !== "error" && isOnProfilePage) {
      window.dispatchEvent(new CustomEvent("scoresNeedRefresh"));
    }
  }, [completed, status, isOnProfilePage]);

  const handleClose = () => {
    if (completed) {
      clearAllNotifications();
      resetUploadState();
    }
    setDismissed(true);
  };

  const handleGoToProfile = () => {
    if (userId) {
      navigate(`/user/${userId}/scores`);
      handleClose();
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Draggable handleSelector=".drag-handle">
      <div className={`upload-progress status-${status}`}>
        <div className="drag-handle">
          <h3>{isUploading ? "Uploading..." : isProcessing ? "Processing..." : "Upload Complete"}</h3>
        </div>
        <p>{message}</p>
        {(isUploading || isProcessing) && <progress value={progress} max="100" />}

        {completed && warnings && warnings.length > 0 && (
          <div className="upload-warnings">
            <ul>
              {warnings.map((warning) => (
                <li key={warning}>⚠️ {warning}</li>
              ))}
            </ul>
          </div>
        )}

        {completed && buggedScores.length > 0 && (
          <div className="bugged-scores">
            <h4>Scores not posted</h4>
            <ul>
              {buggedScores.map((bugged) => (
                <li key={bugged.identifier}>
                  <span dangerouslySetInnerHTML={renderSafeHTML(processColorTags(bugged.song_name))} />
                  {" – "}
                  <span dangerouslySetInnerHTML={renderSafeHTML(processColorTags(bugged.artist))} />
                  {`: ${bugged.score.toLocaleString()} (optimal ${bugged.optimal_score.toLocaleString()})`}
                </li>
              ))}
            </ul>
            <p className="bugged-scores-note">
              These scores look affected by Clone Hero's solo-after-online scoring bug, so they weren't posted. To clear one, open the song in Clone Hero, choose Delete Score in its song options, then play it again.
            </p>
          </div>
        )}

        {completed && achievementErrors && achievementErrors.length > 0 && (
          <div className="achievement-errors">
            <h4>Achievement Processing Issues:</h4>
            <ul>
              {achievementErrors.map((err) => (
                <li key={err.id} title={`Error: ${err.error}`}>
                  ⚠️ {err.name} ({err.id})
                </li>
              ))}
            </ul>
          </div>
        )}

        {completed && status !== "error" && !isOnProfilePage && userId && (
          <button className="profile-button" onClick={handleGoToProfile}>
            Go to Profile
          </button>
        )}

        <button className="close-button" onClick={handleClose}>
          <Icon as={closeIcon} title="Close" />
        </button>
      </div>
    </Draggable>
  );
};

export default UploadProgress;