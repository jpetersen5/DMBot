import React, { useState, useEffect } from "react";
import { Modal, Button, Nav } from "react-bootstrap";
import { API_URL } from "../../App";
import { renderSafeHTML, processColorTags } from "../../utils/safeHTML";
import { Song } from "../../utils/song";

interface SongModalProps {
  show: boolean;
  onHide: () => void;
  song: Song | null;
}

const SongModal: React.FC<SongModalProps> = ({ show, onHide, song }) => {
  const [relatedSongs, setRelatedSongs] = useState<Song[]>([]);
  const [relationType, setRelationType] = useState<"album" | "artist" | "genre">("album");

  useEffect(() => {
    if (song) {
      fetchRelatedSongs();
    }
  }, [song, relationType]);

  const fetchRelatedSongs = async () => {
    if (!song) return;
    try {
      const response = await fetch(`${API_URL}/api/related-songs?${relationType}=${song[relationType]}`);
      if (!response.ok) throw new Error("Failed to fetch related songs");
      const data = await response.json();
      setRelatedSongs(data.songs);
    } catch (error) {
      console.error("Error fetching related songs:", error);
    }
  };

  if (!song) return null;

  return (
    <Modal show={show} onHide={onHide} size="xl">
      <Modal.Header closeButton>
        <Modal.Title>{song.name}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p><strong>Artist:</strong> {song.artist}</p>
        <p><strong>Album:</strong> {song.album}</p>
        <p><strong>Year:</strong> {song.year}</p>
        <p><strong>Genre:</strong> {song.genre}</p>
        <p><strong>Difficulty:</strong> {song.difficulty}</p>
        <p><strong>Length:</strong> {new Date(song.song_length || 0).toISOString().substr(11, 8)}</p>
        <p><strong>Charter:</strong> <span dangerouslySetInnerHTML={renderSafeHTML(processColorTags(song.charter || ""))} /></p>
        <p><strong>MD5:</strong> {song.md5}</p>
        
        <h5>Related Songs</h5>
        <Nav variant="tabs" activeKey={relationType} onSelect={(k) => setRelationType(k as "album" | "artist" | "genre")}>
          <Nav.Item>
            <Nav.Link eventKey="album">Same Album</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="artist">Same Artist</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="genre">Same Genre</Nav.Link>
          </Nav.Item>
        </Nav>
        <ul>
          {relatedSongs.map((relatedSong) => (
            <li key={relatedSong.id} onClick={() => onHide()}>
              {relatedSong.name} - {relatedSong.artist}
            </li>
          ))}
        </ul>

        <h5>Leaderboard</h5>
        <p>Leaderboard to be implemented in the future.</p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default SongModal;