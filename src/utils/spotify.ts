const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const clientSecret = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET;

const getSpotifyAccessToken = async (): Promise<string | null> => {
    try {
        const response = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": "Basic " + btoa(`${clientId}:${clientSecret}`)
            },
            body: "grant_type=client_credentials"
        });

        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error("Error fetching Spotify access token:", error);
        return null;
    }
};

export const fetchSongArt = async (artist: string | null, title: string | null, album: string | null): Promise<string | null> => {
    const accessToken = await getSpotifyAccessToken();
    if (!accessToken) return null;

    if (!artist) {
        artist = "";
    }
    if (!title) {
        title = "";
    }
    if (!album) {
        album = "";
    }

    try {
        const response = await fetch(`https://api.spotify.com/v1/search?q=artist:${artist} track:${title} album:${album}&type=track`, {
            headers: {
                "Authorization": `Bearer ${accessToken}`
            }
        });

        const data = await response.json();
        const tracks = data.tracks.items;
        if (tracks && tracks.length > 0) {
            const track = tracks[0];
            return track.album.images[0].url;
        }
    } catch (error) {
        console.error("Error fetching song art from Spotify:", error);
    }
    return null;
};