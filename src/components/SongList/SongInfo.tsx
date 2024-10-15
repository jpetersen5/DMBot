import React, { useState, useEffect } from "react";
import { API_URL } from "../../App";
import LoadingSpinner from "../Loading/LoadingSpinner";
import CharterName from "./CharterName";
import Tooltip from "../../utils/Tooltip/Tooltip";
import { renderSafeHTML, processColorTags, capitalize } from "../../utils/safeHTML";
import {
  Song,
  msToTime,
  SongExtraData,
  NoteCount,
  MaxNps,
  NotesData,
  SONG_DIFFICULTIES,
} from "../../utils/song";
import "./SongInfo.scss";

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

  if (loading) return <LoadingSpinner message="Loading song details..." />;
  if (!extraData) return <p>No extra data available for this song.</p>;

  return (
    <div className="song-info">
      { 
        // extraData.loading_phrase &&
        // <SongInfoHeader value={extraData.loading_phrase} />
      }

      <SongInfoPrimary extraData={extraData} song={song} />

      <SongInfoDifficulties song={extraData} />
      <SongInfoInstruments instruments={extraData.notesData?.instruments} />
      <SongInfoNoteCounts noteCounts={extraData.notesData?.noteCounts || []} />
      <SongInfoMaxNPS maxNps={extraData.notesData?.maxNps} />
      <SongInfoChartFeatures notesData={extraData.notesData} />
      <SongInfoLine label="MD5" value={song.md5} />
    </div>
  );
};


interface SongInfoHeaderProps {
  value: string;
}

const SongInfoHeader: React.FC<SongInfoHeaderProps> = ({ value }) => {
  return (
    <Tooltip text={"This song info was included by the charter!"} position="bottom">
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

  return (
    <div className="song-box">
      <div className="song-column">
        <div className="song-art-box">
          <img className="song-art-image" 
            src={"https://f4.bcbits.com/img/a3384036326_10.jpg"} alt="Song" />
          <div className="song-art-charter">
            <img
              src={"https://cdn.discordapp.com/avatars/225072566400712704/0653bfe218ab1ba5791a7326d69091e4.png"}
              className="user-avatar"
            />
          </div>
        </div>

        <div className="song-details-box" >
          <div className="song-title">{song.name}</div>
          <div className="song-artist">{extraData.artist}</div>
          <div>
            <span className="song-album">{extraData.album}</span>
            <span className="song-year"> ({extraData.year})</span>
          </div>
          
          <div className="song-genre">{extraData.genre}</div>
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
      <div className="charter">
        <p className="info-line">
          {/* <span className="label">{label}:</span> */}
          <CharterName names={value as string} displayBadges={true}/>
        </p>
      </div>
    );
  }
  const processedValue = typeof value === "string" 
    ? processColorTags(value)
    : String(value);
  return (
    <p className="info-line">
      {/* <span className="label">{label}:</span> */}
      <span dangerouslySetInnerHTML={renderSafeHTML(processedValue)} />
    </p>
  );
};


interface SongInfoDifficultiesProps {
  song: SongExtraData;
}

const SongInfoDifficulties: React.FC<SongInfoDifficultiesProps> = ({ song }) => {
  console.log(song);
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
      <span className="label">Difficulties:</span>
      <div className="difficulty-grid">
        {difficulties.map(diff => 
          diff.value !== undefined && diff.value !== -1 && (
            <div key={diff.name} className="difficulty">
              <span className="diff-name">{diff.name}</span>
              <span className="diff-value">{diff.value}</span>
            </div>
          )
        )}
      </div>
    </div>
  );
};


interface SongInfoInstrumentsProps {
  instruments: string[] | undefined;
}

const SongInfoInstruments: React.FC<SongInfoInstrumentsProps> = ({ instruments }) => {
  if (!instruments) return null;
  return (
    <div className="instruments">
      <span className="label">Instruments:</span>
      <div className="instrument-list">
        {instruments.map(instrument => (
          <span key={instrument} className="instrument">
            {capitalize(instrument)}
          </span>
        ))}
      </div>
    </div>
  );
};


interface SongInfoNoteCountsProps {
  noteCounts: NoteCount[] | undefined;
}

const SongInfoNoteCounts: React.FC<SongInfoNoteCountsProps> = ({ noteCounts }) => {
  if (!noteCounts) return null;
  return (
    <div className="note-counts">
      <span className="label">Note Counts:</span>
      <div className="note-count-grid">
        {noteCounts.map((count, index) => (
          <div key={index} className="note-count-item">
            <span className="note-count-instrument">
              {capitalize(count.instrument)} ({SONG_DIFFICULTIES[count.difficulty]})
            </span>
            <span className="note-count-value">{count.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};


interface SongInfoMaxNPSProps {
  maxNps: MaxNps[] | undefined;
}

const SongInfoMaxNPS: React.FC<SongInfoMaxNPSProps> = ({ maxNps }) => {
  if (!maxNps) return null;
  return (
    <div className="max-nps">
      <span className="label">Max NPS:</span>
      <div className="max-nps-grid">
        {maxNps.map((nps, index) => (
          <div key={index} className="nps-item">
            <span className="nps-instrument">
              {capitalize(nps.instrument)} ({SONG_DIFFICULTIES[nps.difficulty]})
            </span>
            <span className="nps-value">
              {nps.nps.toFixed(2)} at {msToTime(nps.time)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};


interface SongInfoChartFeaturesProps {
  notesData: NotesData | undefined;
}

const SongInfoChartFeatures: React.FC<SongInfoChartFeaturesProps> = ({ notesData }) => {
  if (!notesData) return null;
  return (
    <div className="chart-features">
      <span className="label">Chart Features:</span>
      <div className="feature-grid">
        <span className={`feature ${notesData.hasSoloSections ? "active" : ""}`}>Solo Sections</span>
        <span className={`feature ${notesData.hasLyrics ? "active" : ""}`}>Lyrics</span>
        <span className={`feature ${notesData.has2xKick ? "active" : ""}`}>2x Kick</span>
        <span className={`feature ${notesData.hasFlexLanes ? "active" : ""}`}>Lanes</span>
      </div>
    </div>
  );
};


export default SongInfo;