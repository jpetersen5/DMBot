import React, { useState, useEffect } from "react";
import { Modal, Button, Nav } from "react-bootstrap";
import { API_URL } from "../../App";
import LoadingSpinner from "../Loading/LoadingSpinner";
import { renderSafeHTML, processColorTags } from "../../utils/safeHTML";
import { Song, msToTime } from "../../utils/song";
import "./SongModal.scss";

interface SongModalProps {
  show: boolean;
  onHide: () => void;
  song: Song | null;
}

const SongModal: React.FC<SongModalProps> = ({ show, onHide, song }) => {
  const [relatedSongs, setRelatedSongs] = useState<Song[]>([]);
  const [relationType, setRelationType] = useState<"album" | "artist" | "genre" | "charter">("album");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (song) {
      fetchRelatedSongs();
    }
  }, [song, relationType]);

  const fetchRelatedSongs = async () => {
    if (!song) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/related-songs?${relationType}=${song[relationType]}`);
      if (!response.ok) throw new Error("Failed to fetch related songs");
      const data = await response.json();
      setRelatedSongs(data.songs);
    } catch (error) {
      console.error("Error fetching related songs:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!song) return null;

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
          {loading && <tr><td colSpan={columns.length}><LoadingSpinner /></td></tr>}
          {!loading && relatedSongs.map((relatedSong, index) => (
            <tr key={relatedSong.id} onClick={() => onHide()}>
              {relationType === "album" && <td>{index + 1}</td>}
              <td>{relatedSong.name}</td>
              {relationType === "artist" && <td>{relatedSong.album}</td>}
              {(relationType === "genre" || relationType === "charter") && <td>{relatedSong.artist}</td>}
              <td>{msToTime(relatedSong.song_length || 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" dialogClassName="song-modal">
      <Modal.Header closeButton>
        <Modal.Title>{song.name}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="song-details">
          <div className="artist-info">
            <SongInfoLine label="Artist" value={song.artist} />
            <SongInfoLine label="Album" value={song.album} />
            <SongInfoLine label="Year" value={song.year} />
            <SongInfoLine label="Genre" value={song.genre} />
            <SongInfoLine label="Difficulty" value={song.difficulty} />
            <SongInfoLine label="Length" value={msToTime(song.song_length || 0)} />
            <SongInfoLine label="Charter" value={song.charter} />
            <SongInfoLine label="MD5" value={song.md5} />
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
              <Nav.Item>
                <Nav.Link eventKey="charter">Charter</Nav.Link>
              </Nav.Item>
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
  const processedValue = typeof value === "string" 
    ? processColorTags(value)
    : String(value);
  return (
    <p><strong>{label}:</strong> <span dangerouslySetInnerHTML={renderSafeHTML(processedValue)} /></p>
  );
};

export default SongModal;