import { API_URL } from "../App";

let spotifyAccessToken: string | null = null;

const getSpotifyAccessToken = async (): Promise<string | null> => {
    const response = await fetch(`${API_URL}/api/spotify/get_access_token`);
    const data = await response.json();
    return data.access_token || null;
};

export const fetchSongArt = async (
    artist: string | null,
    title: string | null,
    album: string | null
): Promise<string | null> => {
    if (!spotifyAccessToken) {
        spotifyAccessToken = await getSpotifyAccessToken();
    }

    artist = artist || "";
    title = title || "";
    album = album || "";

    try {
        const response = await fetch(`${API_URL}/api/spotify/fetch_song_art?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}&album=${encodeURIComponent(album)}&access_token=${spotifyAccessToken}`);
        
        if (!response.ok) {
            throw new Error("Failed to fetch song art");
        }

        const data = await response.json();
        return data.image_url || null;
    } catch (error) {
        console.error("Error fetching song art:", error);
        return null;
    }
};