import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { API_URL } from "../../../App";
import SongModal from "../../SongList/SongModal";
import { useCharterData } from "../../../context/CharterContext";
import { useSongCache } from "../../../context/SongContext";
import { Song, SONG_TABLE_HEADERS, getSurroundingSongIds, msToTime } from "../../../utils/song";
import "./CharterSongs.scss";

import Table, { Column } from "../../Table/Table";
import { TableToolbar } from "../../Table/TableControls";
import { useTableData } from "../../../hooks/useTableData";
import { cellRenderers } from "../../Table/TableCells";

interface CharterSongsProps {
  charterId: string;
  charterSongIds: number[];
}

const filterOptions = [
  { value: "name", label: "Name" },
  { value: "artist", label: "Artist" },
  { value: "album", label: "Album" },
  { value: "year", label: "Year" },
  { value: "genre", label: "Genre" },
  { value: "loading_phrase", label: "Loading Phrase" },
  { value: "playlist_path", label: "Playlist" }
];

const CharterSongs: React.FC<CharterSongsProps> = ({ charterId, charterSongIds }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId, songId } = useParams<{ userId: string; songId: string }>();
  
  const [songs, setSongs] = useState<Song[]>([]);
  const [songsLoading, setSongsLoading] = useState<boolean>(true);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const { isLoading: chartersLoading } = useCharterData();
  const { getCachedResult, setCachedResult } = useSongCache();

  const {
    page,
    setPage,
    inputPage,
    setInputPage,
    perPage,
    setPerPage,
    search,
    setSearch,
    filters,
    setFilters,
    filteredData,
    totalPages
  } = useTableData<Song>({
    data: songs,
    defaultSortKey: "last_update",
    defaultSortOrder: "desc",
    defaultPerPage: 50,
    getFilterableFields: (song: Song) => ({
      name: song.name,
      artist: song.artist,
      album: song.album,
      year: song.year,
      genre: song.genre,
      loading_phrase: song.loading_phrase,
      playlist_path: song.playlist_path
    })
  });

  useEffect(() => {
    fetchSongs();
  }, [charterId, charterSongIds]);

  useEffect(() => {
    if (songId) {
      fetchSong(songId);
    } else {
      setSelectedSong(null);
    }
  }, [songId]);

  const getCacheKey = () => {
    return `charter_songs_${charterId}`;
  };

  async function fetchSongs() {
    setSongsLoading(true);
    const cacheKey = getCacheKey();
    const cachedResult = getCachedResult(cacheKey);

    if (cachedResult) {
      setSongs(cachedResult.songs);
      setSongsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/songs-by-ids`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: charterSongIds,
        }),
      });
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data: Song[] = await response.json();
      setSongs(data);
      setCachedResult(cacheKey, { songs: data, total: data.length, timestamp: Date.now() });
    } catch (error) {
      console.error("Error fetching songs:", error);
    } finally {
      setSongsLoading(false);
    }
  }
  
  async function fetchSong(id: string) {
    setModalLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/songs/${id}`);
      if (!response.ok) throw new Error("Failed to fetch song");
      const song = await response.json();
      setSelectedSong(song);
    } catch (error) {
      console.error("Error fetching song:", error);
      setSelectedSong(null);
    } finally {
      setModalLoading(false);
    }
  }

  const handleRowClick = (song: Song) => {
    setSelectedSong(song);
    
    if (location.pathname.includes("/user/") && userId) {
      navigate(`/user/${userId}/charter-songs/${song.id}`, { replace: true });
    } else {
      navigate(`/charter/${charterId}/${song.id}`, { replace: true });
    }
  };

  const handleModalClose = () => {
    setSelectedSong(null);
    
    if (location.pathname.includes("/user/") && userId) {
      navigate(`/user/${userId}/charter-songs`, { replace: true });
    } else {
      navigate(`/charter/${charterId}`, { replace: true });
    }
  };

  const { prevSongIds, nextSongIds } = useMemo(() => {
    return getSurroundingSongIds(filteredData, selectedSong?.id.toString() || "");
  }, [filteredData, selectedSong]);

  const loading = songsLoading || chartersLoading;

  const columns: Column<Song>[] = [
    {
      key: "name",
      header: SONG_TABLE_HEADERS.name,
      className: "name",
      renderCell: (song) => cellRenderers.html(song.name || ""),
      sortable: true
    },
    {
      key: "artist",
      header: SONG_TABLE_HEADERS.artist,
      className: "artist",
      renderCell: (song) => cellRenderers.text(song.artist || ""),
      sortable: true
    },
    {
      key: "album",
      header: SONG_TABLE_HEADERS.album,
      className: "album",
      renderCell: (song) => cellRenderers.text(song.album || ""),
      sortable: true
    },
    {
      key: "year",
      header: SONG_TABLE_HEADERS.year,
      className: "year column-number",
      renderCell: (song) => cellRenderers.text(song.year?.toString() || "N/A"),
      sortable: true
    },
    {
      key: "genre",
      header: SONG_TABLE_HEADERS.genre,
      className: "genre",
      renderCell: (song) => cellRenderers.text(song.genre || ""),
      sortable: true
    },
    {
      key: "song_length",
      header: SONG_TABLE_HEADERS.song_length,
      className: "song-length column-number",
      renderCell: (song) => cellRenderers.text(song.song_length != null ? msToTime(song.song_length) : "??:??:??"),
      sortable: true
    },
    {
      key: "charter",
      header: SONG_TABLE_HEADERS.charter,
      className: "charter",
      renderCell: (song) => cellRenderers.charter(song.charter_refs ? song.charter_refs.join(", ") : "Unknown Author"),
      sortable: true
    },
    {
      key: "scores_count",
      header: SONG_TABLE_HEADERS.scores_count,
      className: "scores-count column-number",
      renderCell: (song) => cellRenderers.text(song.scores_count?.toString() || "0"),
      sortable: true
    },
    {
      key: "last_update",
      header: SONG_TABLE_HEADERS.last_update,
      className: "last-update",
      renderCell: (song) => cellRenderers.timestamp(song.last_update),
      sortable: true
    }
  ];

  return (
    <div className="charter-songs">
      <div className="charter-songs-header">
        <h2>Charter Songs</h2>
        <div className="control-bar">
          <TableToolbar
            search={{
              search,
              setSearch: setSearch as React.Dispatch<React.SetStateAction<string>>,
              filters,
              setFilters: setFilters as React.Dispatch<React.SetStateAction<string[]>>,
              filterOptions,
              placeholder: "Search songs..."
            }}
          />
        </div>
      </div>
      
      <Table
        data={filteredData}
        columns={columns}
        keyExtractor={(song) => song.id.toString()}
        defaultSortKey="last_update"
        defaultSortOrder="desc"
        loading={loading}
        loadingMessage="Loading songs..."
        emptyMessage="No songs found"
        onRowClick={handleRowClick}
        pagination={{
          page,
          setPage: setPage as React.Dispatch<React.SetStateAction<number>>,
          inputPage,
          setInputPage: setInputPage as React.Dispatch<React.SetStateAction<string>>,
          itemsPerPage: perPage
        }}
      />
      
      <div className="pagination-container">
        <TableToolbar
          pagination={{
            page,
            totalPages,
            inputPage,
            setPage: setPage as React.Dispatch<React.SetStateAction<number>>,
            setInputPage: setInputPage as React.Dispatch<React.SetStateAction<string>>
          }}
          perPage={{
            perPage,
            setPerPage: setPerPage as React.Dispatch<React.SetStateAction<number>>,
            setPage: setPage as React.Dispatch<React.SetStateAction<number>>
          }}
        />
      </div>
      
      {(selectedSong || modalLoading) && (
        <SongModal 
          show={true}
          onHide={handleModalClose} 
          initialSong={selectedSong}
          loading={modalLoading}
          previousSongIds={prevSongIds}
          nextSongIds={nextSongIds}
        />
      )}
    </div>
  );
};

export default CharterSongs;