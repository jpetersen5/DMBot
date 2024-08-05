import React, { useState, useEffect } from "react";
import { API_URL } from "../../App";
import { renderSafeHTML } from "../../utils/safeHTML";
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
    ? content.replace(/<color=(#[0-9A-Fa-f]{3,6})>(.*?)<\/color>/g, (match, color, text) => {
        console.log(match, color, text);
        const fullColor = color.length === 4 
          ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}` 
          : color;
        return `<span style="color:${fullColor}">${text}</span>`;
      })
    : String(content);

    if (content.includes("color=")) {
      console.log(processedContent);
    }

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
    <SongTableCell content={song.difficulty} />
    <SongTableCell content={song.song_length != null ? new Date(song.song_length).toISOString().substr(11, 8) : null} />
    <SongTableCell content={song.charter} />
  </tr>
);

export default SongList;