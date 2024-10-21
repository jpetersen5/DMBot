import React, { useState, useEffect, useRef } from "react";
import { API_URL } from "../../App";
import LoadingSpinner from "../Loading/LoadingSpinner";
import CharterName from "./CharterName";
import Tooltip from "../../utils/Tooltip/Tooltip";
import { renderSafeHTML, processColorTags } from "../../utils/safeHTML";
import {
  Song,
  SongExtraData,
  NoteCount,
  MaxNps,
  NotesData,
  SONG_DIFFICULTIES,
} from "../../utils/song";
import { fetchSongData, SongData } from "../../utils/spotify";
import "./SongInfo.scss";

import IconBass from "../../assets/rb-bass.png";
import IconDrums from "../../assets/rb-drums.png";
import IconGuitar from "../../assets/rb-guitar.png";
import IconRhythm from "../../assets/rb-rhythm.png";
import IconKeys from "../../assets/rb-keys.png";
import ChevronLeft from "../../assets/chevron-left.svg";
import ChevronRight from "../../assets/chevron-right.svg";
import DefaultAlbumArt from "../../assets/default-album-art.jpg";

import { charterAvatars } from "../../assets/charter-avatars";

interface SongInfoProps {
  song: Song;
}

const SongInfo: React.FC<SongInfoProps> = ({ song }) => {
  const [extraData, setExtraData] = useState<SongExtraData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExtraData = async () => {
      try {
        const response = await fetch(`${API_URL}/api/songs/${song.md5}/extra`);
        if (!response.ok) throw new Error("Failed to fetch extra song data");
        const data = await response.json();
        setExtraData(data);
      } catch (error) {
        console.error("Error fetching extra song data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchExtraData();
  }, [song.md5]);

  if (loading) return (
    <div className="song-info">
      <LoadingSpinner message="Loading song details..." />
    </div>
  );
  if (!extraData) return (
    <div className="song-info">
      <p>No extra data available for this song.</p>
    </div>
  );

  return (
    <div className="song-info">

      <SongInfoPrimary extraData={extraData} song={song} />

      <SongInfoDifficulties song={extraData} />
      <SongInfoChartFeatures notesData={extraData.notesData} />


      {/* <SongInfoNoteCounts noteCounts={extraData.notesData?.noteCounts || []} />
      <SongInfoMaxNPS maxNps={extraData.notesData?.maxNps} /> */}
      {extraData.loading_phrase &&
        <SongInfoHeader value={extraData.loading_phrase} />
      }
      <SongInfoLine label="MD5" value={song.md5} />
    </div>
  );
};


interface SongInfoHeaderProps {
  value: string;
}

const SongInfoHeader: React.FC<SongInfoHeaderProps> = ({ value }) => {
  return (
    <Tooltip text={"This song info was included by the charter!"} position="top">
      <p className="info-header">
        <span dangerouslySetInnerHTML={renderSafeHTML(value)} />
      </p>
    </Tooltip>
  );
};

interface SongInfoPrimaryProps {
  extraData: SongExtraData;
  song: Song;
}

const SongInfoPrimary: React.FC<SongInfoPrimaryProps> = ({ extraData, song }) => {
  const [songData, setSongData] = useState<SongData | null>(null);
  const [avatarArtUrl, setAvatarArtUrl] = useState<string>("");

  useEffect(() => {
    const getAlbumArt = async () => {
      const songData: SongData | null = await fetchSongData(song.artist, song.name, song.album);
      if (songData) {
        setSongData(songData);
      } else {
        setSongData({
          image_url: DefaultAlbumArt,
          genres: [],
        });
      }

      getAvatarArt(); // prevents rendering until after artwork is loaded
    };

    const getAvatarArt = async () => {
      const icon = extraData.icon ? extraData.icon : "";
      const artUrl = icon && icon in charterAvatars ? charterAvatars[icon] : "";
      setAvatarArtUrl(artUrl);
    }

    getAlbumArt();
    
  }, [extraData.artist, song.name]);

  return (
    <div className="song-box">
      <div className="song-column">
        <div className="song-art-box">
          {songData?.image_url ? (
            <img className="song-art-image" src={songData.image_url}/>
          ) : (
            <LoadingSpinner message="" timeout={0} />
          )}
          {avatarArtUrl && (
          <div className="song-art-charter" >
            <img className="user-avatar" src={avatarArtUrl}/>
          </div>
          )}
        </div>

        <div className="song-details-box" >
          <div className="song-title info-line">{song.name}</div>
          <div className="song-artist info-line">{extraData.artist}</div>
          <div className="song-album info-line">
            <span>{extraData.album} ({extraData.year})</span>
          </div>
          
          <div className="song-genre info-line">{extraData.genre}</div>
          <SongInfoLine label="Charter" value={song.charter_refs?.join(",")} />
          
          {songData?.tempo && (
            <SongSpotifyData songData={songData} />
          )}
        </div>
      </div>
    </div>
  );
}

interface SongInfoLineProps {
  label: string;
  value: string | number | undefined;
}

const SongInfoLine: React.FC<SongInfoLineProps> = ({ label, value }) => {
  if (value === undefined || value === "") {
    return (
      <p className="info-line">
        <span className="label">{label}:</span>  N/A
      </p>
    );
  }
  else if (label === "MD5") {
    return (
      <p className="info-line">
        <span className="label">{label}:</span> <code>{value}</code>
      </p>
    );
  }
  else if (label === "Charter") {
    return (
      <div className="charter info-line">
        <CharterName names={value as string} displayBadges={true}/>
      </div>
    );
  }
  const processedValue = typeof value === "string" 
    ? processColorTags(value)
    : String(value);
  return (
    <p className="info-line">
      <span dangerouslySetInnerHTML={renderSafeHTML(processedValue)} />
    </p>
  );
};


interface SongInfoDifficultiesProps {
  song: SongExtraData;
}

const SongInfoDifficulties: React.FC<SongInfoDifficultiesProps> = ({ song }) => {
  const difficulties = [
    { name: "Guitar", value: song.diff_guitar },
    { name: "Rhythm", value: song.diff_rhythm },
    { name: "Bass", value: song.diff_bass },
    { name: "Drums", value: song.diff_drums_real !== -1 ? song.diff_drums_real : song.diff_drums },
    { name: "Keys", value: song.diff_keys },
  ];

  if (difficulties.every(diff => diff.value === undefined || diff.value === -1)) {
    return null;
  }

  return (
    <div className="difficulties">
      <div className="parts">
        {difficulties.map(diff =>
          <SongInfoPart
            key={diff.name}
            name={diff.name}
            difficulty={diff.value}
            noteCounts={song.notesData?.noteCounts}
            maxNps={song.notesData?.maxNps}
          />
        )}
      </div>
    </div>
  );
};

interface SongInfoPartProps {
  name: string;
  difficulty: string | number | undefined;
  noteCounts?: NoteCount[];
  maxNps?: MaxNps[];
}

const SongInfoPart: React.FC<SongInfoPartProps> = ({ name, difficulty, noteCounts, maxNps }) => {
  const hasDifficulty = difficulty !== undefined && difficulty !== -1;
  
  const notesTooltip = (
    <div className="part-notes-info">
      <span className="part-notes-info-name">{name}</span>
      {noteCounts && noteCounts.map((count, index) => (
        count.instrument === name.toLowerCase() && (
          <div key={index} className="note-count-item">
            <span className="note-count-instrument">
              {SONG_DIFFICULTIES[count.difficulty]}
            </span>
            <span className="note-count-value">{`${count.count} notes`}</span>
            {maxNps &&
              <span className="note-count-max-nps">
                {`(max: ${maxNps.find(nps => nps.instrument === count.instrument && nps.difficulty === count.difficulty)?.nps}/s)`}
              </span>
            }
          </div>
        )
      ))}
    </div>
  )

  return (
    <div className={`part ${!hasDifficulty ? "inactive" : ""}`}>
      <Tooltip content={notesTooltip} position="bottom">
        <img 
          src={name == "Drums" ? IconDrums : 
              name == "Bass" ? IconBass :
              name == "Guitar" ? IconGuitar :
              name == "Rhythm" ? IconRhythm :
              name == "Keys" ? IconKeys : ""}
        />
      </Tooltip>
      <div className="part-difficulty-numeral">
        <span>{hasDifficulty ? difficulty : "-"}</span>
      </div>
    </div>
  );
}


interface SongInfoChartFeaturesProps {
  notesData: NotesData | undefined;
}

const SongInfoChartFeatures: React.FC<SongInfoChartFeaturesProps> = ({ notesData }) => {
  if (!notesData) return null;
  return (
    <div className="chart-features">
      <div className="feature-grid">
        <span className={`feature ${notesData.hasSoloSections ? "active" : ""}`}>Solo</span>
        <span className={`feature ${notesData.hasLyrics ? "active" : ""}`}>Lyrics</span>
        <span className={`feature ${notesData.has2xKick ? "active" : ""}`}>2x Kick</span>
        <span className={`feature ${notesData.hasFlexLanes ? "active" : ""}`}>Lanes</span>
      </div>
    </div>
  );
};


interface SongSpotifyDataProps {
  songData: SongData | null;
}

const SongSpotifyData: React.FC<SongSpotifyDataProps> = ({ songData }) => {
  if (!songData) return null;
  const tsc = songData.time_signature_confidence;
  const tc = songData.tempo_confidence;

  // const renderMeter = (value: number | null | undefined, label: string) => {
  //   if (value === null || value === undefined) return null;
  //   const percentage = Math.min(Math.max(value * 100, 0), 100);
  //   return (
  //     <div className="spotify-meter">
  //       <div className="meter-bar" style={{ height: `${percentage}%` }}></div>
  //       <span className="meter-label">{label}</span>
  //     </div>
  //   );
  // };

  return (
    <div className="song-spotify-data">
      <div className="spotify-data-grid">
        <Tooltip text={`Confidence: ${(tc ? (tc * 100).toFixed(0) : 0)}%`} position="top">
          <div className="spotify-data-item">
            <span className="value">{songData.tempo?.toFixed(0) || 0}</span>
            <span className="label">BPM</span>
          </div>
        </Tooltip>
        <Tooltip text={`Confidence: ${(tsc ? (tsc * 100).toFixed(0) : 0)}%`} position="top">
          <div className="spotify-data-item">
            <span className="value">{songData.time_signature}/4</span>
            <span className="label">Time</span>
          </div>
        </Tooltip>
        <div className="spotify-data-item">
          <span className="value">{songData.loudness?.toFixed(1) || 0}</span>
          <span className="label">dB</span>
        </div>
      </div>
      {/* <div className="spotify-meters">
        {renderMeter(songData.danceability, "Danceability")}
        {renderMeter(songData.energy, "Energy")}
        {renderMeter(songData.valence, "Valence")}
      </div> */}
      {songData.genres && songData.genres.length > 0 && (
        <SongDataGenres genres={songData.genres} />
      )}
    </div>
  );
};


interface SongDataGenresProps {
  genres: string[];
}

const SongDataGenres: React.FC<SongDataGenresProps> = ({ genres }) => {
  const [scrollPosition, setScrollPosition] = useState(0);
  const genresRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (genresRef.current) {
      const scrollAmount = 100;
      const newPosition = direction === "left" 
        ? scrollPosition - scrollAmount 
        : scrollPosition + scrollAmount;
      
      genresRef.current.scrollTo({
        left: newPosition,
        behavior: "smooth"
      });
      setScrollPosition(newPosition);
    }
  };

  return (
    <div className="spotify-genres-container">
      <button 
        className="scroll-button left" 
        onClick={() => scroll("left")}
        style={{ visibility: scrollPosition > 0 ? "visible" : "hidden" }}
      >
        <img src={ChevronLeft} />
      </button>
      <div className="spotify-genres" ref={genresRef}>
        {genres.map((genre, index) => (
          <span key={index} className="genre-tag">{genre}</span>
        ))}
      </div>
      <button 
        className="scroll-button right" 
        onClick={() => scroll("right")}
        style={{ visibility: scrollPosition < (genresRef.current?.scrollWidth || 0) - (genresRef.current?.clientWidth || 0) ? "visible" : "hidden" }}
      >
        <img src={ChevronRight} />
      </button>
    </div>
  );
}


export default SongInfo;