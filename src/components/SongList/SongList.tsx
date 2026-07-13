import React, { useState, useEffect, useEffectEvent, useMemo, useDeferredValue, useCallback } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";

import { API_URL } from "../../App";
import {
  Search,
  MultiSelectDropdown,
  TableToolbar
} from "../Table/TableControls";
import { TableHeader, SongTableCell } from "../Extras/Tables";
import SongModal from "./SongModal";
import LoadingSpinner from "../Loading/LoadingSpinner";
import { UserAvatar } from "../UserList/UserList";
import ScrollableTable from "../Extras/ScrollableTable";

import { useCharterData } from "../../context/CharterContext";
import { useSongCache, SongCacheItem } from "../../context/SongContext";
import { useKeyPress } from "../../hooks/useKeyPress";
import { useSongModal } from "../../hooks/useSongModal";
import { User } from "../../utils/user";
import { Score } from "../../utils/score";
import {
  Song,
  SongDelta,
  SONG_TABLE_HEADERS,
  msToTime,
  mergeSongs,
  songMatchesInstrumentDifficulty,
  getSurroundingSongIds,
  getSortValues,
  buildSongSearchString,
  songSearchStringMatches
} from "../../utils/song";
import { loadSongs, saveSongs, StoredSongs } from "../../utils/songStore";

import "./SongList.scss";

import VS from "../../assets/vs.png";

const filterOptions = [
  { value: "name", label: "Name" },
  { value: "artist", label: "Artist" },
  { value: "album", label: "Album" },
  { value: "year", label: "Year" },
  { value: "genre", label: "Genre" },
  { value: "charter", label: "Charter" },
  { value: "loading_phrase", label: "Loading Phrase" },
  { value: "playlist_path", label: "Playlist" }
];

async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`${API_URL}/api/user/${id}`);
  if (!response.ok) throw new Error("Failed to fetch user");
  return await response.json();
}

async function fetchUserScores(id: string): Promise<Map<string, number>> {
  const response = await fetch(`${API_URL}/api/user/${id}/scores`);
  if (!response.ok) return new Map();
  const data: { scores: Score[] } = await response.json();
  return new Map(data.scores.map(score => [score.identifier, score.score]));
}

const SongList: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { songId } = useParams<{ songId?: string }>();
  const queryParams = new URLSearchParams(location.search);
  const { getCachedResult, setCachedResult } = useSongCache();

  const [songs, setSongs] = useState<Song[]>([]);
  const [songsLoading, setSongsLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(parseInt(queryParams.get("page") || "1"));
  const [inputPage, setInputPage] = useState<string>(page.toString());
  const [perPage, setPerPage] = useState<number>(parseInt(queryParams.get("per_page") || "100"));
  const [sortBy, setSortBy] = useState<string>(queryParams.get("sort_by") || "last_update");
  const [secondarySortBy, setSecondarySortBy] = useState<string | null>(
    queryParams.get("secondary_sort_by") || null
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    queryParams.get("sort_order") as "asc" | "desc" || "desc"
  );
  const [secondarySortOrder, setSecondarySortOrder] = useState<"asc" | "desc">(
    queryParams.get("secondary_sort_order") as "asc" | "desc" || "desc"
  );
  const shiftPressed = useKeyPress("Shift");
  const [search, setSearch] = useState<string>(queryParams.get("search") || "");
  const [filters, setFilters] = useState<string[]>(queryParams.get("filter")?.split(",") || []);

  const [selectedInstruments, setSelectedInstruments] = useState<string[]>(
    queryParams.get("instrument")?.split(",") || []
  );
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>(
    queryParams.get("difficulty")?.split(",") || []
  );

  const { selectedSong, setSelectedSong, modalLoading } = useSongModal(songId);
  const { isLoading: chartersLoading } = useCharterData();

  const [leftUser, setLeftUser] = useState<User | null>(null);
  const [rightUser, setRightUser] = useState<User | null>(null);
  const [leftScores, setLeftScores] = useState<Map<string, number> | null>(null);
  const [rightScores, setRightScores] = useState<Map<string, number> | null>(null);

  const readSongCache = useEffectEvent((key: string) => getCachedResult(key));
  const writeSongCache = useEffectEvent((key: string, item: SongCacheItem) => setCachedResult(key, item));

  useEffect(() => {
    let cancelled = false;

    const persist = (nextSongs: Song[], cursor: string) => {
      writeSongCache("all_songs", {
        songs: nextSongs,
        total: nextSongs.length,
        timestamp: Date.now(),
        cursor
      });
      saveSongs(nextSongs, cursor).catch(err =>
        console.warn("Failed to persist songs to IndexedDB:", err)
      );
    };

    const fetchFull = async () => {
      const response = await fetch(`${API_URL}/api/songs?v=2`);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data: SongDelta = await response.json();
      if (cancelled) return;
      setSongs(data.songs);
      setSongsLoading(false);
      persist(data.songs, data.server_time);
    };

    const syncFromCache = async (stored: StoredSongs) => {
      setSongs(stored.songs);
      setSongsLoading(false);
      try {
        const response = await fetch(
          `${API_URL}/api/songs?v=2&since=${encodeURIComponent(stored.cursor)}`
        );
        if (!response.ok) {
          throw new Error(`Delta fetch failed: ${response.status}`);
        }
        const delta: SongDelta = await response.json();
        if (cancelled) return;
        const changed = delta.songs.length > 0 || delta.deleted.length > 0;
        const merged = changed ? mergeSongs(stored.songs, delta) : stored.songs;
        if (changed) setSongs(merged);
        persist(merged, delta.server_time);
      } catch (error) {
        console.warn("Song delta sync failed; showing cached songs:", error);
      }
    };

    const fetchSongs = async () => {
      setSongsLoading(true);
      const cachedSongs = readSongCache("all_songs");
      if (cachedSongs) {
        setSongs(cachedSongs.songs);
        setSongsLoading(false);
        return;
      }
      const stored = await loadSongs();
      if (cancelled) return;
      if (stored) {
        await syncFromCache(stored);
        return;
      }
      try {
        await fetchFull();
      } catch (error) {
        console.error("Error fetching songs:", error);
        if (!cancelled) setSongsLoading(false);
      }
    };

    fetchSongs();
    return () => { cancelled = true; };
  }, [location.state]);

  const leftUserParam = queryParams.get("left_user");
  const rightUserParam = queryParams.get("right_user");

  useEffect(() => {
    const applyUsers = async () => {
      if (location.state?.leftUser) {
        setLeftUser(location.state.leftUser);
      } else if (leftUserParam) {
        setLeftUser(await fetchUser(leftUserParam));
      }
      if (location.state?.rightUser) {
        setRightUser(location.state.rightUser);
      } else if (rightUserParam) {
        setRightUser(await fetchUser(rightUserParam));
      }
    };
    applyUsers();
  }, [location.state, leftUserParam, rightUserParam]);

  const [prevCriteria, setPrevCriteria] = useState({
    search, filters, sortBy, sortOrder, secondarySortBy, secondarySortOrder
  });
  if (
    prevCriteria.search !== search ||
    prevCriteria.filters !== filters ||
    prevCriteria.sortBy !== sortBy ||
    prevCriteria.sortOrder !== sortOrder ||
    prevCriteria.secondarySortBy !== secondarySortBy ||
    prevCriteria.secondarySortOrder !== secondarySortOrder
  ) {
    setPrevCriteria({ search, filters, sortBy, sortOrder, secondarySortBy, secondarySortOrder });
    if (page !== 1) {
      setPage(1);
    }
  }

  const updateURL = useEffectEvent(() => {
    const params = new URLSearchParams();
    if (page !== 1) params.set("page", page.toString());
    if (perPage !== 100) params.set("per_page", perPage.toString());
    if (sortBy !== "name") params.set("sort_by", sortBy);
    if (sortOrder !== "asc") params.set("sort_order", sortOrder);
    if (secondarySortBy !== null) params.set("secondary_sort_by", secondarySortBy);
    if (secondarySortOrder !== "desc") params.set("secondary_sort_order", secondarySortOrder);
    if (search) params.set("search", search);
    if (filters.length > 0) params.set("filter", filters.sort().join(","));
    if (selectedInstruments.length > 0) {
      params.set("instrument", selectedInstruments.sort().join(","));
    }
    if (selectedDifficulties.length > 0) {
      params.set("difficulty", selectedDifficulties.sort().join(","));
    }
    if (leftUser) params.set("left_user", leftUser.id.toString());
    if (rightUser) params.set("right_user", rightUser.id.toString());

    navigate(`/songs${songId ? `/${songId}` : ""}?${params.toString()}`, { replace: true });
  });

  useEffect(() => {
    updateURL();
  }, [
    page,
    perPage,
    sortBy,
    sortOrder,
    secondarySortBy,
    secondarySortOrder,
    search,
    filters,
    selectedInstruments,
    selectedDifficulties,
    leftUser,
    rightUser
  ]);

  const leftUserId = leftUser?.id;
  const rightUserId = rightUser?.id;

  useEffect(() => {
    if (!leftUserId) return;
    let cancelled = false;
    fetchUserScores(leftUserId).then(scores => {
      if (!cancelled) setLeftScores(scores);
    });
    return () => { cancelled = true; };
  }, [leftUserId]);

  useEffect(() => {
    if (!rightUserId) return;
    let cancelled = false;
    fetchUserScores(rightUserId).then(scores => {
      if (!cancelled) setRightScores(scores);
    });
    return () => { cancelled = true; };
  }, [rightUserId]);

  const effectiveLeftScores = leftUserId ? leftScores : null;
  const effectiveRightScores = rightUserId ? rightScores : null;

  const songSearchStrings = useMemo(() => {
    const map = new Map<number, string>();
    for (const song of songs) {
      map.set(song.id, buildSongSearchString(song));
    }
    return map;
  }, [songs]);

  const deferredSearch = useDeferredValue(search);

  const sortedSongs = useMemo(() => {
    return [...songs].sort((a, b) => {
      if (sortBy === "score_difference") {
        const leftScoreA = effectiveLeftScores?.get(a.md5);
        const rightScoreA = effectiveRightScores?.get(a.md5);
        const leftScoreB = effectiveLeftScores?.get(b.md5);
        const rightScoreB = effectiveRightScores?.get(b.md5);
        if (leftScoreA == null || rightScoreA == null) {
          return 1;
        } else if (leftScoreB == null || rightScoreB == null) {
          return -1;
        }
        const scoreDifferenceA = leftScoreA - rightScoreA;
        const scoreDifferenceB = leftScoreB - rightScoreB;
        if (scoreDifferenceA < scoreDifferenceB) return sortOrder === "asc" ? -1 : 1;
        if (scoreDifferenceA > scoreDifferenceB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      } else {
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
      }
    });
  }, [
    songs,
    sortBy,
    sortOrder,
    secondarySortBy,
    secondarySortOrder,
    effectiveLeftScores,
    effectiveRightScores
  ]);

  const filteredAndSortedSongs = useMemo(() => {
    let filteredSongs = sortedSongs;

    if (deferredSearch) {
      const searchTermsLower = deferredSearch.toLowerCase().split(" ");
      filteredSongs = filteredSongs.filter(song => {
        if (filters.length === 0) {
          const searchString = songSearchStrings.get(song.id) ?? "";
          return songSearchStringMatches(searchString, searchTermsLower);
        } else {
          const name = song.name?.toLowerCase();
          const artist = song.artist?.toLowerCase();
          const album = song.album?.toLowerCase();
          const year = song.year?.toString();
          const genre = song.genre?.toLowerCase();
          const charters = song.charter_refs?.map(charter => charter.toLowerCase());
          const loadingPhrase = song.loading_phrase?.toLowerCase();
          const playlistPath = song.playlist_path?.toLowerCase();
          return searchTermsLower.every(term =>
            filters.includes("name") && name?.includes(term) ||
            filters.includes("artist") && artist?.includes(term) ||
            filters.includes("album") && album?.includes(term) ||
            filters.includes("year") && year?.includes(term) ||
            filters.includes("genre") && genre?.includes(term) ||
            filters.includes("charter") && charters?.some(charter => charter.includes(term)) ||
            filters.includes("loading_phrase") && loadingPhrase?.includes(term) ||
            filters.includes("playlist_path") && playlistPath?.includes(term)
          )
        }
      });
    }

    if (selectedInstruments.length > 0 || selectedDifficulties.length > 0) {
      filteredSongs = filteredSongs.filter(song =>
        songMatchesInstrumentDifficulty(song, selectedInstruments, selectedDifficulties)
      );
    }

    return filteredSongs;
  }, [
    sortedSongs,
    songSearchStrings,
    deferredSearch,
    filters,
    selectedInstruments,
    selectedDifficulties
  ]);

  const paginatedSongs = useMemo(() => {
    const startIndex = (page - 1) * perPage;
    return filteredAndSortedSongs.slice(startIndex, startIndex + perPage);
  }, [filteredAndSortedSongs, page, perPage]);

  const totalPages = Math.ceil(filteredAndSortedSongs.length / perPage);

  const { prevSongIds, nextSongIds } = useMemo(() => {
    return getSurroundingSongIds(filteredAndSortedSongs, songId || "");
  }, [filteredAndSortedSongs, songId]);

  const handleSort = (column: string) => {
    if (column === "charter") {
      return;
    }
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

  const handleRowClick = useCallback((song: Song) => {
    const currentParams = new URLSearchParams(window.location.search);
    navigate(`/songs/${song.id}?${currentParams.toString()}`, { replace: true });
  }, [navigate]);

  const handleModalClose = () => {
    setSelectedSong(null);
    const currentParams = new URLSearchParams(location.search);
    navigate(`/songs?${currentParams.toString()}`, { replace: true });
  };

  const songRows = useMemo(() =>
    paginatedSongs.map(song => (
      <SongTableRow
        key={song.id}
        song={song}
        onRowClick={handleRowClick}
        leftUser={leftUser}
        rightUser={rightUser}
        leftScores={effectiveLeftScores}
        rightScores={effectiveRightScores} />
    )),
    [paginatedSongs, handleRowClick, leftUser, rightUser, effectiveLeftScores, effectiveRightScores]
  );

  const loading = songsLoading || chartersLoading;

  return (
    <div className="song-list">
      <div className="song-list-header">
        <div className="song-list-header-right">
          {leftUser && rightUser && (
            <div className="user-comparison">
              <UserAvatar user={leftUser} />
              <div className="vs">
                <img src={VS} alt="VS" className="vs-icon" />
              </div>
              <UserAvatar user={rightUser} />
            </div>
          )}
        </div>
      </div>
      <div className="search-bar">
        <MultiSelectDropdown
          options={["drums", "guitar", "rhythm", "bass", "keys",]}
          selectedOptions={selectedInstruments}
          setSelectedOptions={setSelectedInstruments}
          label="Instruments"
          clearLabel="Any instrument" />
        <MultiSelectDropdown
          options={["expert", "hard", "medium", "easy"]}
          selectedOptions={selectedDifficulties}
          setSelectedOptions={setSelectedDifficulties}
          label="Difficulties"
          clearLabel="Any difficulty" />
        <Search
          search={search}
          filters={filters}
          filterOptions={filterOptions}
          setSearch={setSearch}
          setFilters={setFilters} />
      </div>
      <ScrollableTable>
        {loading && (
          <LoadingSpinner message="Loading songs..." />
        )}
        {!loading && (
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
                {leftUser && rightUser && (
                  <TableHeader
                    key="score_difference"
                    className="score-difference"
                    content="Score Difference"
                    onClick={() => handleSort("score_difference")}
                    sort={sortBy === "score_difference" || secondarySortBy === "score_difference"}
                    sortOrder={sortBy === "score_difference" ? sortOrder : secondarySortOrder}
                  />
                )}
              </tr>
            </thead>
            <tbody>
              {paginatedSongs.length === 0 && (
                <tr>
                  <td colSpan={Object.keys(SONG_TABLE_HEADERS).length}>No songs found</td>
                </tr>
              )}
              {paginatedSongs.length > 0 && songRows}
            </tbody>
          </table>
        )}
      </ScrollableTable>
      {totalPages > 1 && (
        <div className="page-controls">
          <TableToolbar
            pagination={{ page, totalPages, inputPage, setPage, setInputPage }}
            perPage={{ perPage, setPerPage, setPage }} />
        </div>
      )}
      {(selectedSong || modalLoading) && (
        <SongModal
          show={true}
          onHide={handleModalClose}
          song={selectedSong}
          loading={modalLoading}
          songId={songId}
          previousSongIds={prevSongIds}
          nextSongIds={nextSongIds}
          songPath={(id) => `/songs/${id}`}
          onSongUpdate={setSelectedSong} />
      )}
    </div>
  );
};

interface SongTableRowProps {
  song: Song;
  onRowClick: (song: Song) => void;
  leftUser?: User | null;
  rightUser?: User | null;
  leftScores?: Map<string, number> | null;
  rightScores?: Map<string, number> | null;
}

export const SongTableRow: React.FC<SongTableRowProps> = React.memo(({ song, onRowClick, leftUser, rightUser, leftScores, rightScores }) => {
  const leftScore = leftScores?.get(song.md5);
  const rightScore = rightScores?.get(song.md5);
  const scoreDifference = leftScore != null && rightScore != null ? leftScore - rightScore : null;

  return (
    <tr onClick={() => onRowClick(song)} style={{ cursor: "pointer" }}>
      <SongTableCell className="name" content={song.name} />
      <SongTableCell className="artist" content={song.artist} />
      <SongTableCell className="album" content={song.album} />
      <SongTableCell className="year" content={song.year?.toString() || "N/A"} />
      <SongTableCell className="genre" content={song.genre} />
      <SongTableCell className="song-length" content={song.song_length != null ? msToTime(song.song_length) : "??:??:??"} />
      <SongTableCell className="charter-refs" content={song.charter_refs ? song.charter_refs.join(", ") : "Unknown Author"} special="charter" />
      <SongTableCell className="scores-count" content={song.scores_count?.toString() || "0"} />
      <SongTableCell className="last-update" content={song.last_update} special="last_update" />
      {leftUser && rightUser && (
        <SongTableCell className="score-difference" content={scoreDifference != null ? (scoreDifference > 0 ? "+" + scoreDifference.toString() : scoreDifference.toString()) : "N/A"} special="score_difference" />
      )}
    </tr>
  );
});

SongTableRow.displayName = "SongTableRow";

export default SongList;