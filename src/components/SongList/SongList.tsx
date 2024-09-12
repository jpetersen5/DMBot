import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { API_URL } from "../../App";
import { TableControls, Pagination, Search } from "./TableControls";
import SongModal from "./SongModal";
import LoadingSpinner from "../Loading/LoadingSpinner";
import CharterName from "./CharterName";
import { useCharterData } from "../../context/CharterContext";
import { useSongCache } from "../../context/SongContext";
import Tooltip from "../../utils/Tooltip/Tooltip";
import { renderSafeHTML, processColorTags } from "../../utils/safeHTML";
import {
  Song,
  SONG_TABLE_HEADERS,
  msToTime,
  formatExactTime,
  formatTimeDifference,
  getSurroundingSongIds
} from "../../utils/song";
import "./SongList.scss";

const filterOptions = [
  { value: "name", label: "Name" },
  { value: "artist", label: "Artist" },
  { value: "album", label: "Album" },
  { value: "year", label: "Year" },
  { value: "genre", label: "Genre" },
  { value: "charter", label: "Charter" }
];

const SongList: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { songId } = useParams<{ songId?: string }>();
  const queryParams = new URLSearchParams(location.search);

  const [songs, setSongs] = useState<Song[]>([]);
  const [songsLoading, setSongsLoading] = useState(true);
  const [page, setPage] = useState(parseInt(queryParams.get("page") || "1"));
  const [inputPage, setInputPage] = useState(page.toString());
  const [totalSongs, setTotalSongs] = useState(0);
  const [perPage, setPerPage] = useState(parseInt(queryParams.get("per_page") || "20"));
  const [sortBy, setSortBy] = useState(queryParams.get("sort_by") || "last_update");
  const [sortOrder, setSortOrder] = useState(queryParams.get("sort_order") || "desc");
  const [search, setSearch] = useState(queryParams.get("search") || "");
  const [filters, setFilters] = useState<string[]>(queryParams.getAll("filter") || []);
  const commaSeparatedFilters = filters.sort().join(",");
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const { isLoading: chartersLoading } = useCharterData();
  const { getCachedResult, setCachedResult } = useSongCache();

  const totalPages = Math.ceil(totalSongs / perPage);

  useEffect(() => {
    fetchSongs();
  }, [location.search]);

  useEffect(() => {
    updateURL();
  }, [page, perPage, sortBy, sortOrder, filters]);

  useEffect(() => {
    if (songId) {
      fetchSong(songId);
    } else {
      setSelectedSong(null);
    }
  }, [songId]);

  const updateURL = () => {
    const params = new URLSearchParams();
    if (page !== 1) params.set("page", page.toString());
    if (perPage !== 20) params.set("per_page", perPage.toString());
    if (sortBy !== "name") params.set("sort_by", sortBy);
    if (sortOrder !== "asc") params.set("sort_order", sortOrder);
    if (search) params.set("search", search);
    if (filters.length > 0) params.set("filter", commaSeparatedFilters);

    navigate(`/songs?${params.toString()}`, { replace: true });
  };

  const getCacheKey = () => {
    return `songs_${page}_${perPage}_${sortBy}_${sortOrder}_${search}_${commaSeparatedFilters}`;
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
      const queryParams = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString(),
        sort_by: sortBy,
        sort_order: sortOrder,
        search,
        filter: commaSeparatedFilters,
      });
      const response = await fetch(`${API_URL}/api/songs?${queryParams}`);
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
      setSortOrder("asc");
    }
  };

  const handleSearchSubmit = () => {
    if (page === 1) {
      updateURL();
    } else {
      setPage(1);
    }
  };

  const handleRowClick = (song: Song) => {
    setSelectedSong(song);
    const currentParams = new URLSearchParams(location.search);
    navigate(`/songs/${song.id}?${currentParams.toString()}`, { replace: true });
  };

  const handleModalClose = () => {
    setSelectedSong(null);
    const currentParams = new URLSearchParams(location.search);
    currentParams.delete("relation");
    navigate(`/songs?${currentParams.toString()}`, { replace: true });
  };

  const loading = songsLoading || chartersLoading;

  return (
    <div className="song-list">
      <h1>Song List</h1>
      <div className="control-bar">
        <TableControls perPage={perPage} setPerPage={setPerPage} setPage={setPage} />
        <Pagination
          page={page}
          totalPages={totalPages}
          inputPage={inputPage}
          setPage={setPage}
          setInputPage={setInputPage}
        />
        <Search
          search={search}
          filters={filters}
          filterOptions={filterOptions}
          setSearch={setSearch}
          setFilters={setFilters}
          submitSearch={handleSearchSubmit}
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

interface SongTableHeaderProps {
  onClick: () => void;
  content: string;
  sort: boolean;
  sortOrder: string;
}

const SongTableHeader: React.FC<SongTableHeaderProps> = ({ onClick, content, sort, sortOrder }) => (
  <th onClick={onClick}>
    <div className="header-content">
      <span className="header-text">{content}</span>
      {sort && <span className="sort-arrow">{sortOrder === "asc" ? "▲" : "▼"}</span>}
    </div>
  </th>
);

interface SongTableCellProps {
  content: string | null | undefined;
  special?: "charter" | "last_update";
}

const SongTableCell: React.FC<SongTableCellProps> = ({ content, special }) => {
  if (content == null) {
    return <td></td>;
  }
  switch (special) {
    case "last_update":
      return <td>
        <Tooltip text={formatExactTime(content)}>
          {formatTimeDifference(content)}
        </Tooltip>
      </td>;
    case "charter":
      return <td><CharterName names={content} /></td>;
  }

  const processedContent = typeof content === "string" 
    ? processColorTags(content)
    : String(content);

  return <td dangerouslySetInnerHTML={renderSafeHTML(processedContent)} />;
};

interface SongTableRowProps {
  song: Song;
  onClick: () => void;
}

const SongTableRow: React.FC<SongTableRowProps> = ({ song, onClick }) => (
  <tr onClick={onClick} style={{ cursor: "pointer" }}>
    <SongTableCell content={song.name} />
    <SongTableCell content={song.artist} />
    <SongTableCell content={song.album} />
    <SongTableCell content={song.year} />
    <SongTableCell content={song.genre} />
    <SongTableCell content={song.difficulty || "?"} />
    <SongTableCell content={song.song_length != null ? msToTime(song.song_length) : "??:??:??"} />
    <SongTableCell content={song.charter_refs ? song.charter_refs.join(", ") : "Unknown Author"} special="charter" />
    <SongTableCell content={song.scores_count?.toString() || "0"} />
    <SongTableCell content={song.last_update} special="last_update" />
  </tr>
);

export default SongList;