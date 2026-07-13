import { get, set, del } from "idb-keyval";
import { Song } from "./song";

/** bump version when song shape changes incompatibly with cached data */
export const SCHEMA_VERSION = 1;

const SONGS_KEY = "songs";
const CURSOR_KEY = "cursor";
const VERSION_KEY = "version";

export interface StoredSongs {
  songs: Song[];
  cursor: string;
}

/** load persisted songs + cursor */
export async function loadSongs(): Promise<StoredSongs | null> {
  try {
    const version = await get<number>(VERSION_KEY);
    if (version !== SCHEMA_VERSION) {
      await clearSongs();
      return null;
    }
    const songs = await get<Song[]>(SONGS_KEY);
    const cursor = await get<string>(CURSOR_KEY);
    if (!songs || !cursor) return null;
    return { songs, cursor };
  } catch (error) {
    console.warn("Failed to load songs from IndexedDB:", error);
    return null;
  }
}

/** persist the full song array and the delta cursor (server_time) */
export async function saveSongs(songs: Song[], cursor: string): Promise<void> {
  await set(SONGS_KEY, songs);
  await set(CURSOR_KEY, cursor);
  await set(VERSION_KEY, SCHEMA_VERSION);
}

async function clearSongs(): Promise<void> {
  await Promise.all([del(SONGS_KEY), del(CURSOR_KEY), del(VERSION_KEY)]);
}
