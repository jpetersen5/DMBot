import React, { useState, useEffect } from "react";
import { API_URL } from "../../App";
import { renderSafeHTML, processColorTags } from "../../utils/safeHTML";
import { TableControls, Pagination, Search } from "./TableControls";
import "./SongList.scss";

interface Song {
  id: number;
  md5: string;
  artist: string | null;
  name: string | null;
  album: string | null;
  track: string | null;
  year: string | null;
  genre: string | null;
  difficulty: string | null;
  song_length: number | null;
  charter: string | null;
}

const TABLE_HEADERS = {
  name: "Name",
  artist: "Artist",
  album: "Album",
  year: "Year",
  genre: "Genre",
  difficulty: "Difficulty",
  song_length: "Length",
  charter: "Charter",
};

const SongList: React.FC = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [inputPage, setInputPage] = useState(page.toString());
  const [totalSongs, setTotalSongs] = useState(0);
  const [perPage, setPerPage] = useState(20);
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");

  const totalPages = Math.ceil(totalSongs / perPage);

  useEffect(() => {
    fetchSongs();
  }, [page, perPage, sortBy, sortOrder]);

  async function fetchSongs() {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString(),
        sort_by: sortBy,
        sort_order: sortOrder,
        search,
        filter,
      });
      const response = await fetch(`${API_URL}/api/songs?${queryParams}`);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data = await response.json();
      setSongs(data.songs);
      setTotalSongs(data.total);
    } catch (error) {
      console.error("Error fetching songs:", error);
    } finally {
      setLoading(false);
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
      fetchSongs();
    } else {
      setPage(1);
    }
  };

  if (loading) {
    return <div>Loading songs...</div>;
  }

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
          filter={filter}
          setSearch={setSearch}
          setFilter={setFilter}
          submitSearch={handleSearchSubmit}
        />
      </div>
      <table>
        <thead>
          <tr>
            {Object.entries(TABLE_HEADERS).map(([key, value]) => (
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
          {songs.map((song) => (
            <SongTableRow key={song.id} song={song} />
          ))}
        </tbody>
      </table>
      <Pagination
        page={page}
        totalPages={totalPages}
        inputPage={inputPage}
        setPage={setPage}
        setInputPage={setInputPage}
      />
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
}

const SongTableCell: React.FC<SongTableCellProps> = ({ content }) => {
  if (content == null) {
    return <td></td>;
  }

  const processedContent = typeof content === "string" 
    ? processColorTags(content)
    : String(content);

  return <td dangerouslySetInnerHTML={renderSafeHTML(processedContent)} />;
};

interface SongTableRowProps {
  song: Song;
}

const SongTableRow: React.FC<SongTableRowProps> = ({ song }) => (
  <tr>
    <SongTableCell content={song.name} />
    <SongTableCell content={song.artist} />
    <SongTableCell content={song.album} />
    <SongTableCell content={song.year} />
    <SongTableCell content={song.genre} />
    <SongTableCell content={song.difficulty || "?"} />
    <SongTableCell content={song.song_length != null ? new Date(song.song_length).toISOString().substring(11, 19) : null} />
    <SongTableCell content={processCharters(song.charter)} />
  </tr>
);

const processCharters = (charters: string | null) => {
  if (charters == null) {
    return "Unknown Charter";
  }
  // will be used to handle charter links in the future
  const charterList = charters.split(/\s*[,/]\s*/).map(charter => charter.trim());
  const charterDisplay = charterList.join(', ');
  return charterDisplay;
}

export default SongList;