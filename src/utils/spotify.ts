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

export const fetchSongArt = async (
    artist: string | null,
    title: string | null,
    album: string | null
): Promise<string | null> => {
    const accessToken = await getSpotifyAccessToken();
    if (!accessToken) return null;

    artist = artist || "";
    title = title || "";
    album = album || "";

    try {
        const trackResponse = await fetch(`https://api.spotify.com/v1/search?q=artist:${artist} track:${title} album:${album}&type=track`, {
            headers: {
                "Authorization": `Bearer ${accessToken}`
            }
        });

        const trackData = await trackResponse.json();
        const tracks = trackData.tracks.items;

        if (tracks && tracks.length > 0) {
            return tracks[0].album.images[0].url;
        }

        const albumResponse = await fetch(`https://api.spotify.com/v1/search?q=artist:${artist} album:${album}&type=album`, {
            headers: {
                "Authorization": `Bearer ${accessToken}`
            }
        });
      
        const albumData = await albumResponse.json();
        const albums = albumData.albums.items;
        
        if (albums && albums.length > 0) {
            return albums[0].images[0].url;
        }
    } catch (error) {
        console.error("Error fetching song art from Spotify:", error);
    }
    return null;
};