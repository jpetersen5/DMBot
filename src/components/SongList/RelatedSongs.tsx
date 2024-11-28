import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Nav } from "react-bootstrap";
import { API_URL } from "../../App";
import { SimpleTableHeader, SongTableCell } from "../Extras/Tables";
import LoadingSpinner from "../Loading/LoadingSpinner";
import { useSongCache } from "../../context/SongContext";
import { Song, msToTime } from "../../utils/song";
import "./RelatedSongs.scss";

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

interface RelatedSongsProps {
  currentSong: Song;
  handleRelatedSongClick: (song: Song) => void;
}

const RelatedSongs: React.FC<RelatedSongsProps> = ({
  currentSong,
  handleRelatedSongClick
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [relatedSongs, setRelatedSongs] = useState<RelatedSongs>({
    album_songs: [],
    artist_songs: [],
    genre_songs: [],
    charter_songs: []
  });
  const [relationType, setRelationType] = useState<RelatedSongsType>(RelatedSongsType.album);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const { getCachedResult, setCachedResult } = useSongCache();

  const [page, setPage] = useState(1);
  const perPage = 50;

  const updateURL = () => {
    if (!currentSong) return;
    const params = new URLSearchParams(location.search);
    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
  };

  useEffect(() => {
    if (currentSong) {
      fetchRelatedSongs();
      updateURL();
    }
  }, [currentSong, relationType]);

  useEffect(() => {
    setPage(1);
  }, [relationType]);

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
    let sortedSongs = relatedSongs[`${relationType}_songs`];
    if (relationType === RelatedSongsType.album) {
      sortedSongs = sortedSongs.sort((a, b) => {
        const aTrack = a.track ? a.track : 0;
        const bTrack = b.track ? b.track : 0;
        return aTrack - bTrack;
      });
    } else {
      sortedSongs = sortedSongs.sort((a, b) => {
        const aLastUpdate = new Date(a.last_update);
        const bLastUpdate = new Date(b.last_update);
        return bLastUpdate.getTime() - aLastUpdate.getTime();
      });
    }
    return sortedSongs.slice((page - 1) * perPage, page * perPage);
  }, [relatedSongs, relationType, page]);

  const numCharters = currentSong.charter_refs?.length || 0;

  // TODO: reconcile with Tables.tsx
  const renderRelatedSongsTable = () => {
    let RELATED_SONGS_TABLE_HEADERS;
    let columns;
    switch (relationType) {
      case RelatedSongsType.album:
        RELATED_SONGS_TABLE_HEADERS = {
          "#": "Track",
          Name: "Name",
          Length: "Length"
        };
        columns = ["#", "Name", "Length"];
        break;
      case RelatedSongsType.artist:
        RELATED_SONGS_TABLE_HEADERS = {
          Name: "Name",
          Artist: "Artist",
          Length: "Length"
        };
        columns = ["Name", "Album", "Length"];
        break;
      case RelatedSongsType.genre:
      case RelatedSongsType.charter:
        RELATED_SONGS_TABLE_HEADERS = {
          Name: "Name",
          Artist: "Artist",
          Length: "Length"
        };
        columns = ["Name", "Artist", "Length"];
        break;
    }

    return (
      <div className="table-container">
        <table>
          <thead>
            <tr>
              {Object.entries(RELATED_SONGS_TABLE_HEADERS).map(([key, value]) => (
                <SimpleTableHeader
                  key={key}
                  className={key.replace(/_/g, "-")}
                  content={value}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {relatedLoading && <tr><td colSpan={Object.keys(RELATED_SONGS_TABLE_HEADERS).length}><LoadingSpinner /></td></tr>}
            {!relatedLoading && paginatedRelatedSongs.map((relatedSong) => (
              <tr key={relatedSong.id} className={currentSong.id == relatedSong.id ? "selected-row" : ""} onClick={() => handleRelatedSongClick(relatedSong)}>
                {relationType === RelatedSongsType.album && <SongTableCell className="track" content={relatedSong.track?.toString() || ""} />}
                <SongTableCell className="name" content={relatedSong.name} />
                {relationType === RelatedSongsType.artist && <SongTableCell className="album" content={relatedSong.album} />}
                {(relationType === RelatedSongsType.genre || relationType === RelatedSongsType.charter) && <SongTableCell className="artist" content={relatedSong.artist} />}
                <SongTableCell className="song-length" content={msToTime(relatedSong.song_length || 0)} />
              </tr>
            ))}
            {!relatedLoading && paginatedRelatedSongs.length === 0 && (
              <tr><td colSpan={columns.length}>{`No related songs from ${relationType}`}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
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
      </div>
      <div className="table-container">
        {renderRelatedSongsTable()}
      </div>
    </div>
  );
};

export default RelatedSongs;