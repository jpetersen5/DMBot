export interface Song {
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

export const SONG_TABLE_HEADERS = {
  name: "Name",
  artist: "Artist",
  album: "Album",
  year: "Year",
  genre: "Genre",
  difficulty: "Difficulty",
  song_length: "Length",
  charter: "Charter",
};

export const msToTime = (duration: number) => {
  return new Date(duration).toISOString().substring(11, 19);
}