import React, { useState, useEffect } from "react";
import { Modal, Button, Nav } from "react-bootstrap";
import { API_URL } from "../../App";
import LoadingSpinner from "../Loading/LoadingSpinner";
import CharterName from "./CharterName";
import { renderSafeHTML, processColorTags } from "../../utils/safeHTML";
import { Song, msToTime } from "../../utils/song";
import { Pagination } from "./TableControls";
import "./SongModal.scss";

interface SongModalProps {
  show: boolean;
  onHide: () => void;
  initialSong: Song | null;
}

const SongModal: React.FC<SongModalProps> = ({ show, onHide, initialSong }) => {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [previousSongs, setPreviousSongs] = useState<Song[]>([]);
  const [relatedSongs, setRelatedSongs] = useState<Song[]>([]);
  const [relationType, setRelationType] = useState<"album" | "artist" | "genre" | "charter">("album");
  const [loading, setLoading] = useState(false);

  // related songs pagination
  const [page, setPage] = useState(1);
  const [totalRelatedSongs, setTotalRelatedSongs] = useState(0);
  const [inputPage, setInputPage] = useState("1");
  const perPage = 10;
  const totalPages = Math.ceil(totalRelatedSongs / perPage);

  useEffect(() => {
    if (initialSong) {
      setCurrentSong(initialSong);
      setPreviousSongs([]);
      setPage(1);
      setInputPage("1");
    }
  }, [initialSong]);

  useEffect(() => {
    if (currentSong) {
      fetchRelatedSongs();
    }
  }, [currentSong, relationType, page]);

  useEffect(() => {
    setPage(1);
    setInputPage("1");
  }, [relationType]);

  const fetchRelatedSongs = async () => {
    if (!currentSong) return;
    setLoading(true);
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
    } catch (error) {
      console.error("Error fetching related songs:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!currentSong) return null;

  const handleRelatedSongClick = (song: Song) => {
    if (currentSong === song) return;
    setPreviousSongs([...previousSongs, currentSong]);
    setCurrentSong(song);
  }

  const handleBack = () => {
    if (previousSongs.length > 0) {
      const lastSong = previousSongs[previousSongs.length - 1];
      setCurrentSong(lastSong);
      setPreviousSongs(prev => prev.slice(0, -1));
    } else {
      onHide();
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
      <>
        <Pagination
          page={page}
          totalPages={totalPages}
          inputPage={inputPage}
          setInputPage={setInputPage}
          setPage={setPage}
        />
        <table className="related-songs-table">
          <thead>
            <tr>
              {columns.map(col => <th key={col}>{col}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={columns.length}><LoadingSpinner /></td></tr>}
            {!loading && relatedSongs.map((relatedSong) => (
              <tr key={relatedSong.id} onClick={() => handleRelatedSongClick(relatedSong)}>
                {relationType === "album" && <td>{relatedSong.track || "N/A"}</td>}
                <td>{relatedSong.name}</td>
                {relationType === "artist" && <td>{relatedSong.album}</td>}
                {(relationType === "genre" || relationType === "charter") && <td>{relatedSong.artist}</td>}
                <td>{msToTime(relatedSong.song_length || 0)}</td>
              </tr>
            ))}
            {!loading && relatedSongs.length === 0 && (
              <tr><td colSpan={columns.length}>{`No related songs from ${relationType}`}</td></tr>
            )}
          </tbody>
        </table>
      </>
    );
  };

  const numCharters = currentSong.charter_refs?.length || 0;

  return (
    <Modal show={show} onHide={onHide} size="xl" dialogClassName="song-modal">
      <Modal.Header>
        <Button onClick={handleBack} className="back-button">
          {previousSongs.length > 0 ? "←" : "X"}
        </Button>
        <Modal.Title>{currentSong.name}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
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
            {renderRelatedSongsTable()}
          </div>
        </div>
        <div className="leaderboard">
          <h5>Leaderboard</h5>
          <p>Leaderboard to be implemented in the future.</p>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Close</Button>
      </Modal.Footer>
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
    return <p><strong>{label}:</strong> <CharterName names={value as string} /></p>
  }
  const processedValue = typeof value === "string" 
    ? processColorTags(value)
    : String(value);
  return (
    <p><strong>{label}:</strong> <span dangerouslySetInnerHTML={renderSafeHTML(processedValue)} /></p>
  );
};

export default SongModal;