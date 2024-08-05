import React, { useState, useEffect } from "react";
import { API_URL } from "../../App";
import "./SongList.scss";

interface Song {
  id: number;
  md5: string;
  artist: string;
  name: string;
  album: string;
  track: string;
  year: string;
  genre: string;
  difficulty: string;
  song_length: number;
  charter: string;
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

  useEffect(() => {
    fetchSongs();
  }, [page, perPage, sortBy, sortOrder]);

  async function fetchSongs() {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/songs?page=${page}&per_page=${perPage}&sort_by=${sortBy}&sort_order=${sortOrder}`
      );
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

  const totalPages = Math.ceil(totalSongs / perPage);

  const handlePrevPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (page < totalPages) setPage(page + 1);
  };

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputPage(e.target.value);
  };

  const handlePageInputUpdate = () => {
    const newPage = parseInt(inputPage, 10);
    if (!isNaN(newPage) && newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    } else {
      setInputPage(page.toString());
    }
  };

  const handlePageInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handlePageInputUpdate();
    }
  };

  useEffect(() => {
    setInputPage(page.toString());
  }, [page]);

  const handlePerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPerPage(parseInt(e.target.value));
    setPage(1);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  if (loading) {
    return <div>Loading songs...</div>;
  }

  return (
    <div className="song-list">
      <h1>Song List</h1>
      <div className="table-controls">
        <div>
          <label htmlFor="per-page">Songs per page:</label>
          <select id="per-page" value={perPage} onChange={handlePerPageChange}>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            {Object.entries(TABLE_HEADERS).map(([key, value]) => (
              <SongListHeader
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
            <tr key={song.id}>
              <td>{song.name}</td>
              <td>{song.artist}</td>
              <td>{song.album}</td>
              <td>{song.year}</td>
              <td>{song.genre}</td>
              <td>{song.difficulty}</td>
              <td>{new Date(song.song_length).toISOString().substr(11, 8)}</td>
              <td>{song.charter}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pagination">
        <button onClick={handlePrevPage} disabled={page === 1}>Previous</button>
        <span>
          Page <input 
            type="number" 
            value={inputPage} 
            onChange={handlePageInputChange}
            onBlur={handlePageInputUpdate}
            onKeyDown={handlePageInputKeyPress}
            min={1} 
            max={totalPages} 
          /> of {totalPages}
        </span>
        <button onClick={handleNextPage} disabled={page === totalPages}>Next</button>
      </div>
    </div>
  );
};

interface SongListHeaderProps {
  onClick: () => void;
  content: string;
  sort: boolean;
  sortOrder: string;
}

const SongListHeader: React.FC<SongListHeaderProps> = ({ onClick, content, sort, sortOrder }) => (
  <th onClick={onClick}>
  {content}
  {sort && <span className="sort-arrow">{sortOrder === "asc" ? " ▲" : " ▼"}</span>}
  </th>
);

export default SongList;