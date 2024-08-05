import React, { useState, useEffect } from 'react';
import { API_URL } from '../../App';
import './SongList.scss';

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

const SongList: React.FC = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalSongs, setTotalSongs] = useState(0);
  const [perPage] = useState(50);

  useEffect(() => {
    fetchSongs(page);
  }, [page]);

  async function fetchSongs(pageNum: number) {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/songs?page=${pageNum}&per_page=${perPage}`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      setSongs(data.songs);
      setTotalSongs(data.total);
    } catch (error) {
      console.error('Error fetching songs:', error);
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

  if (loading) {
    return <div>Loading songs...</div>;
  }

  return (
    <div className="song-list">
      <h1>Song List</h1>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Artist</th>
            <th>Album</th>
            <th>Year</th>
            <th>Genre</th>
            <th>Difficulty</th>
            <th>Length</th>
            <th>Charter</th>
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
        <span>Page {page} of {totalPages}</span>
        <button onClick={handleNextPage} disabled={page === totalPages}>Next</button>
      </div>
    </div>
  );
};

export default SongList;