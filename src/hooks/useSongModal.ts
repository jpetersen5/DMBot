import { useState, useEffect, useCallback } from "react";
import { API_URL } from "../App";
import { Song } from "../utils/song";

export const useSongModal = (songId: string | undefined) => {
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);

  const fetchSong = useCallback(async (id: string) => {
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
  }, []);

  useEffect(() => {
    const syncSong = async () => {
      if (songId) {
        await fetchSong(songId);
      } else {
        setSelectedSong(null);
      }
    };
    syncSong();
  }, [songId, fetchSong]);

  return { selectedSong, setSelectedSong, modalLoading, fetchSong };
};
