import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_URL } from "../../../App";
import { TableControls, Pagination, Search } from "../../SongList/TableControls";
import SongModal from "../../SongList/SongModal";
import { TableHeader } from "../../Extras/Tables";
import { SongTableRow } from "../../SongList/SongList";
import LoadingSpinner from "../../Loading/LoadingSpinner";
import { useCharterData } from "../../../context/CharterContext";
import { useSongCache } from "../../../context/SongContext";
import { useKeyPress } from "../../../hooks/useKeyPress";
import {
  Song,
  SONG_TABLE_HEADERS,
  getSurroundingSongIds,
  getSortValues
} from "../../../utils/song";
import "./CharterSongs.scss";

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
  const { songId } = useParams<{ songId: string }>();
  const navigate = useNavigate();

  const [songs, setSongs] = useState<Song[]>([]);
  const [songsLoading, setSongsLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [inputPage, setInputPage] = useState<string>(page.toString());
  const [sortBy, setSortBy] = useState<string>("last_update");
  const [secondarySortBy, setSecondarySortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [secondarySortOrder, setSecondarySortOrder] = useState<"asc" | "desc">("desc");
  const shiftPressed = useKeyPress("Shift");
  const [search, setSearch] = useState<string>("");
  const [filters, setFilters] = useState<string[]>([]);
  const perPage = 50;

  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const { isLoading: chartersLoading } = useCharterData();
  const { getCachedResult, setCachedResult } = useSongCache();

  useEffect(() => {
    fetchSongs();
  }, [charterId, charterSongIds]);

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
  
  useEffect(() => {
    if (songId) {
      fetchSong(songId);
    } else {
      setSelectedSong(null);
    }
  }, [songId]);

  useEffect(() => {
    setPage(1);
  }, [search, filters]);

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

  const filteredAndSortedSongs = useMemo(() => {
    let filteredSongs = songs;
    if (!filteredSongs) return [];

    if (search) {
      const searchTermsLower = search.toLowerCase().split(" ");
      filteredSongs = filteredSongs.filter(song => {
        if (filters.length === 0) {
          return searchTermsLower.every(term => 
            Object.values(song).some(value => 
              (typeof value === "string" || typeof value === "number") && value.toString().toLowerCase().includes(term)
            )
          );
        } else {
          return searchTermsLower.every(term => 
            filters.includes("name") && song.name?.toLowerCase().includes(term) ||
            filters.includes("artist") && song.artist?.toLowerCase().includes(term) ||
            filters.includes("album") && song.album?.toLowerCase().includes(term) ||
            filters.includes("year") && song.year?.toString().includes(term) ||
            filters.includes("genre") && song.genre?.toLowerCase().includes(term) ||
            filters.includes("loading_phrase") && song.loading_phrase?.toLowerCase().includes(term) ||
            filters.includes("playlist_path") && song.playlist_path?.toLowerCase().includes(term)
          );
        }
      });
    } else {
      // I don't know why this is necessary, but it is
      filteredSongs = filteredSongs.filter(song => {
        return song;
      });
    }

    const sortedSongs = filteredSongs.sort((a, b) => {
      const [aValue, bValue] = getSortValues(a, b, sortBy);
      if (aValue == null || bValue == null) return 0;
      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      if (secondarySortBy) {
        const [aSecondaryValue, bSecondaryValue] = getSortValues(a, b, secondarySortBy);
        if (aSecondaryValue == null || bSecondaryValue == null) return 0;
        if (aSecondaryValue < bSecondaryValue) return secondarySortOrder === "asc" ? -1 : 1;
        if (aSecondaryValue > bSecondaryValue) return secondarySortOrder === "asc" ? 1 : -1;
      }
      return 0;
    });

    return sortedSongs;
  }, [songs, search, filters, sortBy, sortOrder, secondarySortBy, secondarySortOrder]);

  const paginatedSongs = useMemo(() => {
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    return filteredAndSortedSongs.slice(startIndex, endIndex);
  }, [filteredAndSortedSongs, page, perPage]);

  const totalPages = Math.ceil(filteredAndSortedSongs.length / perPage);

  const { prevSongIds, nextSongIds } = useMemo(() => {
    return getSurroundingSongIds(filteredAndSortedSongs, selectedSong?.id.toString() || "");
  }, [filteredAndSortedSongs, selectedSong]);

  const handleSort = (column: string) => {
    if (!shiftPressed) {
      setSecondarySortBy(null);
      setSecondarySortOrder("desc");
      if (sortBy === column) {
        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
      } else {
        setSortBy(column);
        setSortOrder("desc");
      }
    } else {
      if (secondarySortBy === column) {
        setSecondarySortOrder(secondarySortOrder === "asc" ? "desc" : "asc");
      } else {
        setSecondarySortBy(column);
        setSecondarySortOrder("desc");
      }
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
      <div className="charter-songs-header">
        <h2>Charter Songs</h2>
        <div className="control-bar">
          <Search
            search={search}
            filters={filters}
            filterOptions={filterOptions}
            setSearch={setSearch}
            setFilters={setFilters}
            submitSearch={() => {}}
          />
        </div>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              {Object.entries(SONG_TABLE_HEADERS).map(([key, value]) => (
                <TableHeader
                  key={key}
                  className={key.replace(/_/g, "-")}
                  content={value}
                  onClick={() => handleSort(key)}
                  sort={sortBy === key || secondarySortBy === key}
                  sortOrder={sortBy === key ? sortOrder : secondarySortOrder}
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
            {!loading && paginatedSongs.length === 0 && (
              <tr>
                <td colSpan={Object.keys(SONG_TABLE_HEADERS).length}>No songs found</td>
              </tr>
            )}
            {!loading && paginatedSongs.length > 0 && (
              paginatedSongs.map((song) => (
                <SongTableRow 
                  key={song.id} 
                  song={song} 
                  onClick={() => handleRowClick(song)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
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
          previousSongIds={prevSongIds}
          nextSongIds={nextSongIds}
        />
      )}
    </div>
  );
};

export default CharterSongs;