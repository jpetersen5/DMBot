import React, { useState, useEffect } from "react";
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
import { fetchSongArt } from "../../utils/spotify";
import "./SongInfo.scss";

import IconBass from "../../assets/rb-bass.png";
import IconDrums from "../../assets/rb-drums.png";
import IconGuitar from "../../assets/rb-guitar.png";
import IconRhythm from "../../assets/rb-rhythm.png";
import IconKeys from "../../assets/rb-keys.png";

import DefaultAlbumArt from "../../assets/default-album-art.jpg";

import { charterAvatars } from '../../assets/charter-avatars';

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
  const [albumArtUrl, setAlbumArtUrl] = useState<string>(DefaultAlbumArt);
  const [avatarArtUrl, setAvatarArtUrl] = useState<string>("");

  useEffect(() => {
    const getAlbumArt = async () => {
      const artUrl = await fetchSongArt(song.artist, song.name, song.album);
      if (artUrl) {
        setAlbumArtUrl(artUrl);
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
          <img className="song-art-image" src={albumArtUrl}/>
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


export default SongInfo;