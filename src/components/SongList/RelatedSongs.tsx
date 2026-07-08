import React, { useState, useEffect, useEffectEvent, useMemo } from "react";
import { Nav } from "react-bootstrap";
import { API_URL } from "../../App";
import { useSongCache, SongCacheItem } from "../../context/SongContext";
import { Song, msToTime } from "../../utils/song";
import "./RelatedSongs.scss";

import { Table, Column, cellRenderers } from "../Table";

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

const getCacheKey = (song: Song, type: RelatedSongsType) => {
  if (type === RelatedSongsType.charter) {
    const charterRefs = song.charter_refs ?? ["Unknown Author"];
    return `related_charter_${charterRefs.join(",")}`;
  }
  if (type === RelatedSongsType.album) {
    return `related_album_${song.album || "Unknown Album"}`;
  }
  if (type === RelatedSongsType.artist) {
    return `related_artist_${song.artist || "Unknown Artist"}`;
  }
  if (type === RelatedSongsType.genre) {
    return `related_genre_${song.genre || "Unknown Genre"}`;
  }
  return "";
};

const RelatedSongs: React.FC<RelatedSongsProps> = ({
  currentSong,
  handleRelatedSongClick
}) => {
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
  const [inputPage, setInputPage] = useState("1");
  const perPage = 50;

  const readSongCache = useEffectEvent((key: string) => getCachedResult(key));
  const writeSongCache = useEffectEvent((key: string, item: SongCacheItem) => setCachedResult(key, item));

  useEffect(() => {
    if (!currentSong) return;
    const song = currentSong;
    const type = relationType;

    const fetchRelatedSongs = async () => {
      setRelatedLoading(true);
      const cacheKey = getCacheKey(song, type);
      const cachedResult = readSongCache(cacheKey);
      if (cachedResult) {
        setRelatedSongs(prev => ({ ...prev, [`${type}_songs`]: cachedResult.songs }));
        setRelatedLoading(false);
        return;
      }

      try {
        let url = `${API_URL}/api/related-songs?${type}=`;
        if (type === "charter") {
          const charterRefs = song.charter_refs ?? ["Unknown Author"];
          url += encodeURIComponent(charterRefs.join(","));
        } else {
          url += encodeURIComponent(song[type] || `Unknown ${type}`);
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch related songs");
        const data: RelatedSongs = await response.json();
        setRelatedSongs(prev => ({ ...prev, [`${type}_songs`]: data[`${type}_songs`] }));
        writeSongCache(cacheKey, { songs: data[`${type}_songs`], total: data[`${type}_songs`].length, timestamp: Date.now() });
      } catch (error) {
        console.error("Error fetching related songs:", error);
      } finally {
        setRelatedLoading(false);
      }
    };
    fetchRelatedSongs();
  }, [currentSong, relationType]);

  const handleRelationTypeChange = (type: RelatedSongsType) => {
    setRelationType(type);
    setPage(1);
    setInputPage("1");
  };

  const processedData = useMemo(() => {
    const sortedSongs = relatedSongs[`${relationType}_songs`];
    if (!sortedSongs || sortedSongs.length === 0) return [];

    return [...sortedSongs];
  }, [relatedSongs, relationType]);

  const numCharters = currentSong.charter_refs?.length || 0;

  const getColumns = (): Column<Song>[] => {
    switch (relationType) {
      case RelatedSongsType.album:
        return [
          {
            key: "track",
            header: "#",
            className: "track column-number",
            renderCell: (song) => cellRenderers.text(song.track?.toString() || ""),
            sortable: false,
            sortFn: (a, b, direction) => {
              const aTrack = a.track || 0;
              const bTrack = b.track || 0;
              return direction === "asc" ? aTrack - bTrack : bTrack - aTrack;
            }
          },
          {
            key: "name",
            header: "Name",
            className: "name",
            renderCell: (song) => cellRenderers.html(song.name),
            sortable: false
          },
          {
            key: "song_length",
            header: "Length",
            className: "song-length column-number",
            renderCell: (song) => cellRenderers.text(msToTime(song.song_length || 0)),
            sortable: false
          }
        ];
      case RelatedSongsType.artist:
        return [
          {
            key: "name",
            header: "Name",
            className: "name",
            renderCell: (song) => cellRenderers.html(song.name),
            sortable: false
          },
          {
            key: "album",
            header: "Album",
            className: "album",
            renderCell: (song) => cellRenderers.text(song.album),
            sortable: false
          },
          {
            key: "song_length",
            header: "Length",
            className: "song-length column-number",
            renderCell: (song) => cellRenderers.text(msToTime(song.song_length || 0)),
            sortable: false
          }
        ];
      case RelatedSongsType.genre:
      case RelatedSongsType.charter:
      default:
        return [
          {
            key: "name",
            header: "Name",
            className: "name",
            renderCell: (song) => cellRenderers.html(song.name),
            sortable: false
          },
          {
            key: "artist",
            header: "Artist",
            className: "artist",
            renderCell: (song) => cellRenderers.text(song.artist),
            sortable: false
          },
          {
            key: "song_length",
            header: "Length",
            className: "song-length column-number",
            renderCell: (song) => cellRenderers.text(msToTime(song.song_length || 0)),
            sortable: false
          }
        ];
    }
  };

  const isSelectedRow = (song: Song) => {
    return currentSong.id === song.id;
  };

  const getDefaultSortConfig = () => {
    switch (relationType) {
      case RelatedSongsType.album:
        return {
          key: "track",
          order: "asc" as "asc" | "desc"
        };
      default:
        return {
          key: "last_update",
          order: "desc" as "asc" | "desc"
        };
    }
  };

  const sortConfig = getDefaultSortConfig();

  return (
    <div className="related-songs">
      <h5>Related Songs</h5>
      <div className="related-songs-topbar">
        <Nav variant="tabs" activeKey={relationType} onSelect={(k) => handleRelationTypeChange(k as RelatedSongsType)}>
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

      <Table
        data={processedData}
        columns={getColumns()}
        keyExtractor={(song) => song.id}
        defaultSortKey={sortConfig.key}
        defaultSortOrder={sortConfig.order}
        loading={relatedLoading}
        loadingMessage="Loading related songs..."
        emptyMessage={`No related songs from ${relationType}`}
        onRowClick={handleRelatedSongClick}
        isSelectedRow={isSelectedRow}
        pagination={{
          page,
          setPage,
          inputPage,
          setInputPage,
          itemsPerPage: perPage
        }}
      />
    </div>
  );
};

export default RelatedSongs;