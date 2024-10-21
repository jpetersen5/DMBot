import { API_URL } from "../App";

export type SongData = {
    image_url: string;
    tempo?: number | null;
    time_signature?: number | null;
    tempo_confidence?: number | null;
    time_signature_confidence?: number | null;
    danceability?: number | null;
    energy?: number | null;
    valence?: number | null;
    loudness?: number | null;
    genres: string[];
};

let spotifyAccessToken: string | null = null;

const getSpotifyAccessToken = async (): Promise<string | null> => {
    const response = await fetch(`${API_URL}/api/spotify/get_access_token`);
    const data = await response.json();
    return data.access_token || null;
};

export const fetchSongData = async (
    artist: string | null,
    title: string | null,
    album: string | null
): Promise<SongData | null> => {
    if (!spotifyAccessToken) {
        spotifyAccessToken = await getSpotifyAccessToken();
    }

    artist = artist || "";
    title = title || "";
    album = album || "";

    try {
        const response = await fetch(`${API_URL}/api/spotify/fetch_song_data?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}&album=${encodeURIComponent(album)}&access_token=${spotifyAccessToken}`);
        
        if (!response.ok) {
            throw new Error("Failed to fetch song data");
        }

        const data = await response.json();
        console.log(data);
        return data as SongData;
    } catch (error) {
        console.error("Error fetching song data:", error);
        return null;
    }
};