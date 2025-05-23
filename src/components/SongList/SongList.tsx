import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";

import { API_URL } from "../../App";
import {
  TableControls,
  Pagination,
  Search,
  MultiSelectDropdown
} from "./TableControls";
import { TableHeader, SongTableCell } from "../Extras/Tables";
import SongModal from "./SongModal";
import LoadingSpinner from "../Loading/LoadingSpinner";
import { UserAvatar } from "../UserList/UserList";
import ScrollableTable from "../Extras/ScrollableTable";

import { useCharterData } from "../../context/CharterContext";
import { useSongCache } from "../../context/SongContext";
import { useKeyPress } from "../../hooks/useKeyPress";
import { User } from "../../utils/user";
import {
  Song,
  SONG_TABLE_HEADERS,
  msToTime,
  getSurroundingSongIds,
  getSortValues
} from "../../utils/song";

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

  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const { isLoading: chartersLoading } = useCharterData();

  const [leftUser, setLeftUser] = useState<User | null>(null);
  const [rightUser, setRightUser] = useState<User | null>(null);

  useEffect(() => {
    if (songs.length > 0) {
      return;
    }
    fetchSongs();
  }, [location.state]);

  useEffect(() => {
    if (location.state?.leftUser) {
      setLeftUser(location.state.leftUser);
    } else if (queryParams.get("left_user")) {
      fetchUser(queryParams.get("left_user") || "").then(user => setLeftUser(user));
    }
    if (location.state?.rightUser) {
      setRightUser(location.state.rightUser);
    } else if (queryParams.get("right_user")) {
      fetchUser(queryParams.get("right_user") || "").then(user => setRightUser(user));
    }
  }, [location.state, queryParams.get("left_user"), queryParams.get("right_user")]);

  useEffect(() => {
    updateURL();
  }, [
    page, 
    perPage, 
    sortBy, 
    sortOrder, 
    secondarySortBy, 
    secondarySortOrder, 
    filters, 
    selectedInstruments, 
    selectedDifficulties,
    leftUser,
    rightUser
  ]);

  useEffect(() => {
    if (page === 1) {
      updateURL();
    } else {
      setPage(1);
    }
  }, [search, filters, sortBy, sortOrder, secondarySortBy, secondarySortOrder]);

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
  };

  async function fetchSongs() {
    setSongsLoading(true);
    const cachedSongs = getCachedResult("all_songs");
    if (cachedSongs) {
      setSongs(cachedSongs.songs);
      setSongsLoading(false);
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/songs`);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data: Song[] = await response.json();
      setSongs(data);
      setCachedResult("all_songs", { songs: data, total: data.length, timestamp: Date.now() });
    } catch (error) {
      console.error("Error fetching songs:", error);
    } finally {
      setSongsLoading(false);
    }
  }

  // async function fetchSongsByIds(ids: number[] | string[]) {
  //   setSongsLoading(true);
  //   try {
  //     const response = await fetch(`${API_URL}/api/songs-by-ids`, {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //       },
  //       body: JSON.stringify({
  //         ids: ids,
  //       }),
  //     });
  //     if (!response.ok) {
  //       throw new Error("Network response was not ok");
  //     }
  //     const data: Song[] = await response.json();
  //     setSongs(data);
  //   } catch (error) {
  //     console.error("Error fetching songs:", error);
  //   } finally {
  //     setSongsLoading(false);
  //   }
  // }

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

  async function fetchUser(id: string) {
    const response = await fetch(`${API_URL}/api/user/${id}`);
    if (!response.ok) throw new Error("Failed to fetch user");
    return await response.json();
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
            filters.includes("charter") && song.charter_refs?.some(charter => charter.toLowerCase().includes(term)) ||
            filters.includes("loading_phrase") && song.loading_phrase?.toLowerCase().includes(term) ||
            filters.includes("playlist_path") && song.playlist_path?.toLowerCase().includes(term)
          )
        }
      });
    } else {
      // I don't know why this is necessary, but it is
      filteredSongs = filteredSongs.filter(song => {
        return song;
      });
    }

    if (selectedInstruments.length > 0 || selectedDifficulties.length > 0) {
      filteredSongs = filteredSongs.filter(song => {
        const hasInstrument = selectedInstruments.length === 0 || 
          selectedInstruments.every(instrument => song.instruments?.includes(instrument));
        
        const hasDifficulty = selectedDifficulties.length === 0 || 
          selectedDifficulties.every(difficulty => 
            song.note_counts?.some(nc => 
              nc.difficulty === difficulty && 
              (selectedInstruments.length === 0 || 
                selectedInstruments.includes(nc.instrument))
            )
          );

        return hasInstrument && hasDifficulty;
      });
    }

    const sortedSongs = filteredSongs.sort((a, b) => {
      if (sortBy === "score_difference") {
        const leftScoreA = a.leaderboard?.find(entry => entry.user_id === leftUser?.id)?.score;
        const rightScoreA = a.leaderboard?.find(entry => entry.user_id === rightUser?.id)?.score;
        const leftScoreB = b.leaderboard?.find(entry => entry.user_id === leftUser?.id)?.score;
        const rightScoreB = b.leaderboard?.find(entry => entry.user_id === rightUser?.id)?.score;
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

    return sortedSongs;
  }, [
    songs, 
    search, 
    filters, 
    sortBy, 
    sortOrder, 
    secondarySortBy, 
    secondarySortOrder, 
    selectedInstruments, 
    selectedDifficulties
  ]);

  const paginatedSongs = useMemo(() => {
    const startIndex = (page - 1) * perPage;
    return filteredAndSortedSongs.slice(startIndex, startIndex + perPage);
  }, [filteredAndSortedSongs, page, perPage]);

  const totalPages = Math.ceil(filteredAndSortedSongs.length / perPage);

  const { prevSongIds, nextSongIds } = useMemo(() => {
    return getSurroundingSongIds(filteredAndSortedSongs, selectedSong?.id.toString() || "");
  }, [filteredAndSortedSongs, selectedSong]);

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
          clearLabel="Any instrument"/>
        <MultiSelectDropdown
          options={["expert", "hard", "medium", "easy"]}
          selectedOptions={selectedDifficulties}
          setSelectedOptions={setSelectedDifficulties}
          label="Difficulties"
          clearLabel="Any difficulty"/>
        <Search
          search={search}
          filters={filters}
          filterOptions={filterOptions}
          setSearch={setSearch}
          setFilters={setFilters}
          submitSearch={() => {}}/>
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
              {paginatedSongs.length > 0 && (
                paginatedSongs.map((song) => (
                  <SongTableRow 
                    key={song.id} 
                    song={song} 
                    onClick={() => handleRowClick(song)}
                    leftUser={leftUser}
                    rightUser={rightUser}/>
                ))
              )}
            </tbody>
          </table>
        )}
      </ScrollableTable>
      {totalPages > 1 && (
        <div className="page-controls">
          <TableControls perPage={perPage} setPerPage={setPerPage} setPage={setPage} />
          <Pagination
            page={page}
            totalPages={totalPages}
            inputPage={inputPage}
            setPage={setPage}
            setInputPage={setInputPage}/>
        </div>
      )}
      {(selectedSong || modalLoading) && (
        <SongModal 
          show={true}
          onHide={handleModalClose} 
          initialSong={selectedSong}
          loading={modalLoading}
          previousSongIds={prevSongIds}
          nextSongIds={nextSongIds}/>
      )}
    </div>
  );
};

interface SongTableRowProps {
  song: Song;
  onClick: () => void;
  leftUser?: User | null;
  rightUser?: User | null;
}

export const SongTableRow: React.FC<SongTableRowProps> = ({ song, onClick, leftUser, rightUser }) => {
  const leftScore = leftUser ? song.leaderboard?.find(entry => entry.user_id === leftUser.id) : null;
  const rightScore = rightUser ? song.leaderboard?.find(entry => entry.user_id === rightUser.id) : null;
  const scoreDifference = leftScore && rightScore ? leftScore.score - rightScore.score : null;

  return (
    <tr onClick={onClick} style={{ cursor: "pointer" }}>
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
};

export default SongList;