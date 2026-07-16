import { API_URL } from "../App";

export const fetchAlbumArt = async (songId: number): Promise<string | null> => {
    try {
        const response = await fetch(`${API_URL}/api/spotify/album_art/${songId}`);
        if (!response.ok) {
            throw new Error("Failed to fetch album art");
        }
        const data = await response.json();
        return data.image_url || null;
    } catch (error) {
        console.error("Error fetching album art:", error);
        return null;
    }
};
