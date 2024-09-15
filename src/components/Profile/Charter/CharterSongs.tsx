import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_URL } from "../../../App";
import { TableControls, Pagination } from "../../SongList/TableControls";
import SongModal from "../../SongList/SongModal";
import { SongTableHeader, SongTableRow } from "../../SongList/SongList";
import LoadingSpinner from "../../Loading/LoadingSpinner";
import { useCharterData } from "../../../context/CharterContext";
import { useSongCache } from "../../../context/SongContext";
import {
  Song,
  SONG_TABLE_HEADERS,
  getSurroundingSongIds
} from "../../../utils/song";
import "./CharterSongs.scss";

interface CharterSongsProps {
  charterId: string;
  charterSongIds: number[];
}

const CharterSongs: React.FC<CharterSongsProps> = ({ charterId, charterSongIds }) => {
  const { songId } = useParams<{ songId: string }>();
  const navigate = useNavigate();

  const [songs, setSongs] = useState<Song[]>([]);
  const [songsLoading, setSongsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [inputPage, setInputPage] = useState("1");
  const [totalSongs, setTotalSongs] = useState(0);
  const [perPage, setPerPage] = useState(20);
  const [sortBy, setSortBy] = useState("last_update");
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const { isLoading: chartersLoading } = useCharterData();
  const { getCachedResult, setCachedResult } = useSongCache();

  const totalPages = Math.ceil(totalSongs / perPage);

  useEffect(() => {
    fetchSongs();
  }, [page, perPage, sortBy, sortOrder, charterId, charterSongIds]);

  const getCacheKey = () => {
    return `charter_songs_${charterId}_${page}_${perPage}_${sortBy}_${sortOrder}`;
  };

  async function fetchSongs() {
    setSongsLoading(true);
    const cacheKey = getCacheKey();
    const cachedResult = getCachedResult(cacheKey);

    if (cachedResult) {
      setSongs(cachedResult.songs);
      setTotalSongs(cachedResult.total);
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
          page: page,
          per_page: perPage,
          sort_by: sortBy,
          sort_order: sortOrder,
        }),
      });
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data = await response.json();
      setSongs(data.songs);
      setTotalSongs(data.total);
      setCachedResult(cacheKey, { songs: data.songs, total: data.total, timestamp: Date.now() });
    } catch (error) {
      console.error("Error fetching songs:", error);
    } finally {
      setSongsLoading(false);
    }
  }
  
  useEffect(() => {
    if (songId) {
      fetchSong(songId);
    } else {
      setSelectedSong(null);
    }
  }, [songId]);

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

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const handleRowClick = (song: Song) => {
    setSelectedSong(song);
    navigate(`/charter/${charterId}/${song.id}`);
  };

  const handleModalClose = () => {
    setSelectedSong(null);
    navigate(`/charter/${charterId}`);
  };

  const loading = songsLoading || chartersLoading;

  return (
    <div className="charter-songs">
      <h2>Charter Songs</h2>
      <div className="control-bar">
        <TableControls perPage={perPage} setPerPage={setPerPage} setPage={setPage} />
        <Pagination
          page={page}
          totalPages={totalPages}
          inputPage={inputPage}
          setPage={setPage}
          setInputPage={setInputPage}
        />
      </div>
      <table>
        <thead>
          <tr>
            {Object.entries(SONG_TABLE_HEADERS).map(([key, value]) => (
              <SongTableHeader
                key={key}
                content={value}
                onClick={() => handleSort(key)}
                sort={sortBy === key}
                sortOrder={sortOrder}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={Object.keys(SONG_TABLE_HEADERS).length}>
                <LoadingSpinner message="Loading songs..." />
              </td>
            </tr>
          )}
          {!loading && songs.length === 0 && (
            <tr>
              <td colSpan={Object.keys(SONG_TABLE_HEADERS).length}>No songs found</td>
            </tr>
          )}
          {!loading && songs.length > 0 && (
            songs.map((song) => (
              <SongTableRow 
                key={song.id} 
                song={song} 
                onClick={() => handleRowClick(song)}
              />
            ))
          )}
        </tbody>
      </table>
      <Pagination
        page={page}
        totalPages={totalPages}
        inputPage={inputPage}
        setPage={setPage}
        setInputPage={setInputPage}
      />
      {(selectedSong || modalLoading) && (
        <SongModal 
          show={true}
          onHide={handleModalClose} 
          initialSong={selectedSong}
          loading={modalLoading}
          previousSongIds={getSurroundingSongIds(songs, selectedSong?.id.toString() || "", perPage).prevSongIds}
          nextSongIds={getSurroundingSongIds(songs, selectedSong?.id.toString() || "", perPage).nextSongIds}
        />
      )}
    </div>
  );
};

export default CharterSongs;