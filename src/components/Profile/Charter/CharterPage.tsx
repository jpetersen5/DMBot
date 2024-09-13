import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import LoadingSpinner from "../../Loading/LoadingSpinner";
import CharterStats from "./CharterStats";
import CharterSongs from "./CharterSongs";
import { Charter } from "../../../utils/charter";
import { renderSafeHTML } from "../../../utils/safeHTML";
import { API_URL } from "../../../App";
import "./CharterPage.scss";

const CharterPage: React.FC = () => {
  const { charterId } = useParams<{ charterId: string }>();
  const [charter, setCharter] = useState<Charter | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchCharter = async () => {
      if (charterId) {
        try {
          const response = await fetch(`${API_URL}/api/charter/${charterId}`);
          if (response.ok) {
            const charterData: Charter = await response.json();
            setCharter(charterData);
          } else {
            console.error("Error fetching charter:", response.statusText);
          }
        } catch (error) {
          console.error("Error fetching charter data:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchCharter();
  }, [charterId]);

  return (
    <div className="charter-page">
      <h1>Charter Profile</h1>
      {loading && <LoadingSpinner />}
      {!charter && !loading && <p>Charter not found.</p>}
      {charter && !loading && (
        <>
          <div className="charter-header">
            <h2>
              <span
                dangerouslySetInnerHTML={renderSafeHTML(charter.colorized_name || charter.name)}
              />
            </h2>
          </div>
          <CharterStats stats={charter.charter_stats} />
          <CharterSongs charterId={charterId!} charterSongIds={charter.charter_songs} />
        </>
      )}
    </div>
  );
};

export default CharterPage;