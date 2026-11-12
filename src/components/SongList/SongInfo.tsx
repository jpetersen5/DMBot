import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { API_URL } from "../../App";
import SongInfoSkeleton from "./SongInfoSkeleton";
import Skeleton from "../ui/Skeleton/Skeleton";
import CharterName from "./CharterName";
import SongPaths from "./SongPaths";
import Tooltip from "../../utils/Tooltip/Tooltip";
import { renderSafeHTML } from "../../utils/safeHTML";
import {
  Song,
  SongExtraData,
  NoteCount,
  MaxNps,
  SONG_DIFFICULTIES,
  formatBpmRange,
  bpmMarkerPercent,
} from "../../utils/song";
import { DrumNoteRow, drumKind, drumNoteRows, drumsDifficulty } from "../../utils/songDrums";
import { fetchAlbumArt } from "../../utils/spotify";
import "./SongInfo.scss";

import IconBass from "../../assets/rb-bass.png";
import IconDrums from "../../assets/rb-drums.png";
import IconGuitar from "../../assets/rb-guitar.png";
import IconRhythm from "../../assets/rb-rhythm.png";
import IconKeys from "../../assets/rb-keys.png";
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

  if (loading) return <SongInfoSkeleton />;
  if (!extraData) return (
    <div className="song-info">
      <p>No extra data available for this song.</p>
    </div>
  );

  return (
    <div className="song-info">
      <SongInfoHeader extraData={extraData} song={song} />
      <DrumsCard extraData={extraData} song={song} />
      <OtherParts extraData={extraData} />
      <SongInfoFooter loadingPhrase={extraData.loading_phrase} md5={song.md5} />
    </div>
  );
};


interface MarqueeTextProps {
  text: string | null | undefined;
  className?: string;
}

const MarqueeText: React.FC<MarqueeTextProps> = ({ text, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const inner = textRef.current;
    if (!container || !inner) return;

    const measure = () => {
      const distance = inner.scrollWidth - container.clientWidth;
      setOverflow(distance > 1 ? distance : 0);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [text]);

  const scrollSpeed = 45; // px per second
  const scrollFraction = 0.38;
  const duration = overflow > 0 ? Math.max(2, overflow / scrollSpeed / scrollFraction) : 0;

  return (
    <div className={`marquee ${className ?? ""}`} ref={containerRef}>
      <span
        className={`marquee-inner ${overflow > 0 ? "scrolling" : ""}`}
        ref={textRef}
        style={{
          "--marquee-distance": `${overflow}px`,
          animationDuration: `${duration}s`,
        } as React.CSSProperties}
      >
        {text}
      </span>
    </div>
  );
};

interface SongInfoSectionProps {
  extraData: SongExtraData;
  song: Song;
}

const SongInfoHeader: React.FC<SongInfoSectionProps> = ({ extraData, song }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [avatarArtUrl, setAvatarArtUrl] = useState<string>("");

  useEffect(() => {
    const getAlbumArt = async () => {
      const url = await fetchAlbumArt(song.id);
      setImageUrl(url ?? DefaultAlbumArt);

      getAvatarArt(); // prevents rendering until after artwork is loaded
    };

    const getAvatarArt = async () => {
      const icon = extraData.icon ? extraData.icon : "";
      const artUrl = icon && icon in charterAvatars ? charterAvatars[icon] : "";
      setAvatarArtUrl(artUrl);
    }

    getAlbumArt();
  }, [song.id, extraData.icon]);

  const album = extraData.album && (extraData.year ? `${extraData.album} (${extraData.year})` : extraData.album);
  const albumLine = [album, extraData.genre].filter(Boolean).join(" · ");
  const charters = song.charter_refs?.join(",");

  return (
    <div className="song-header">
      <div className="song-art-box">
        {imageUrl ? (
          <img className="song-art-image" src={imageUrl} alt="" />
        ) : (
          <Skeleton className="song-art-image" />
        )}
        {avatarArtUrl && (
          <div className="song-art-charter">
            <img className="user-avatar" src={avatarArtUrl} alt="" />
          </div>
        )}
      </div>

      <div className="song-header-text">
        <MarqueeText className="song-title" text={song.name} />
        {extraData.artist && <div className="song-artist">{extraData.artist}</div>}
        {albumLine && <div className="song-album">{albumLine}</div>}
        {charters && (
          <div className="song-charter">
            <CharterName names={charters} />
          </div>
        )}
      </div>
    </div>
  );
};


const formatNps = (nps: number) => String(Math.round(nps * 10) / 10);

const DrumNotesTable: React.FC<{ rows: DrumNoteRow[] }> = ({ rows }) => (
  <div className="part-notes-info">
    <span className="part-notes-info-name">Drums</span>
    {rows.map(row => (
      <div key={row.difficulty} className="note-count-item">
        <span className="note-count-instrument">{SONG_DIFFICULTIES[row.difficulty]}</span>
        <span className="note-count-value">{`${row.count.toLocaleString()} notes`}</span>
        {row.nps != null && <span className="note-count-max-nps">{`(max: ${formatNps(row.nps)}/s)`}</span>}
      </div>
    ))}
  </div>
);

const FeatureChip: React.FC<{ label: string; active: boolean }> = ({ label, active }) => (
  <span className={`feature ${active ? "active" : ""}`}>{label}</span>
);

const DrumsCard: React.FC<SongInfoSectionProps> = ({ extraData, song }) => {
  const notesData = extraData.notesData;
  const difficulty = drumsDifficulty(extraData);
  const kind = drumKind(notesData);
  const rows = drumNoteRows(notesData);
  const expert = rows.find(row => row.difficulty === "expert");

  return (
    <section className="drums-card" aria-label="Drums">
      <div className="drums-stats">
        <div className={`drums-difficulty ${difficulty == null ? "inactive" : ""}`}>
          <img src={IconDrums} alt="Drums" />
          <span className="drums-difficulty-value">{difficulty ?? "-"}</span>
          {kind && <span className="drums-kind">{kind}</span>}
        </div>
        {expert && (
          <Tooltip content={<DrumNotesTable rows={rows} />} position="bottom">
            <span className="drums-stat"><strong>{expert.count.toLocaleString()}</strong> notes</span>
          </Tooltip>
        )}
        {expert?.nps != null && (
          <span className="drums-stat">max <strong>{formatNps(expert.nps)}</strong>/s</span>
        )}
        <SongInfoTempo song={song} />
      </div>

      <SongPaths paths={song.paths} />

      {notesData && (
        <div className="feature-chips">
          <FeatureChip label="Solo" active={notesData.hasSoloSections} />
          <FeatureChip label="2x Kick" active={notesData.has2xKick} />
          <FeatureChip label="Lanes" active={notesData.hasFlexLanes} />
        </div>
      )}
    </section>
  );
};


const OtherParts: React.FC<{ extraData: SongExtraData }> = ({ extraData }) => {
  const parts = [
    { name: "Guitar", icon: IconGuitar, value: extraData.diff_guitar },
    { name: "Rhythm", icon: IconRhythm, value: extraData.diff_rhythm },
    { name: "Bass", icon: IconBass, value: extraData.diff_bass },
    { name: "Keys", icon: IconKeys, value: extraData.diff_keys },
  ];
  const notesData = extraData.notesData;

  return (
    <div className="other-parts">
      <span className="other-parts-label">Other parts</span>
      <div className="parts">
        {parts.map(part => (
          <SongInfoPart
            key={part.name}
            name={part.name}
            icon={part.icon}
            difficulty={part.value}
            noteCounts={notesData?.noteCounts}
            maxNps={notesData?.maxNps}
          />
        ))}
      </div>
      {notesData && <FeatureChip label="Lyrics" active={notesData.hasLyrics} />}
    </div>
  );
};

interface SongInfoPartProps {
  name: string;
  icon: string;
  difficulty: number | undefined;
  noteCounts?: NoteCount[];
  maxNps?: MaxNps[];
}

const SongInfoPart: React.FC<SongInfoPartProps> = ({ name, icon, difficulty, noteCounts, maxNps }) => {
  const hasDifficulty = difficulty !== undefined && difficulty !== -1;
  const hasNotes = !!noteCounts?.some(count => count.instrument === name.toLowerCase());
  const isActive = hasDifficulty && hasNotes;

  const notesTooltip = hasNotes ? (
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
  ) : (
    <div className="part-notes-info">
      <span className="part-notes-info-name">{name}</span>
      <span className="part-notes-info-empty">No notes charted.</span>
    </div>
  )

  return (
    <Tooltip content={notesTooltip} position="bottom">
      <div className={`part ${!isActive ? "inactive" : ""}`}>
        <img src={icon} alt={name} />
        <span className="part-difficulty-numeral">{hasDifficulty ? difficulty : "-"}</span>
      </div>
    </Tooltip>
  );
}


const SongInfoTempo: React.FC<{ song: Song }> = ({ song }) => {
  const marker = bpmMarkerPercent(song);
  if (song.bpm_dominant == null || marker == null) {
    return (
      <Tooltip text={formatBpmRange(song)}>
        <div className="tempo inactive">
          <span className="tempo-value">N/A</span>
          <span className="tempo-unit">BPM</span>
        </div>
      </Tooltip>
    );
  }

  const min = song.bpm_min ?? song.bpm_dominant;
  const max = song.bpm_max ?? song.bpm_dominant;
  const steady = min === max;
  const tooltip = steady
    ? `Steady at ${song.bpm_dominant} BPM`
    : `${song.bpm_dominant} BPM for most of the chart. ${formatBpmRange(song)}`;

  return (
    <Tooltip text={tooltip}>
      <div className="tempo">
        <span className="tempo-value">{song.bpm_dominant}</span>
        <span className="tempo-unit">BPM</span>
        {steady ? (
          <span className="tempo-steady">Steady</span>
        ) : (
          <div className="tempo-range" aria-label={formatBpmRange(song)}>
            <span>{min}</span>
            <div className="tempo-track">
              <span className="tempo-marker" style={{ left: `${marker}%` }} />
            </div>
            <span>{max}</span>
          </div>
        )}
      </div>
    </Tooltip>
  );
};


interface SongInfoFooterProps {
  loadingPhrase: string | undefined;
  md5: string;
}

const SongInfoFooter: React.FC<SongInfoFooterProps> = ({ loadingPhrase, md5 }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(md5);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <footer className="song-info-footer">
      {loadingPhrase && (
        <Tooltip text="This song info was included by the charter!" position="top">
          <span className="loading-phrase" dangerouslySetInnerHTML={renderSafeHTML(loadingPhrase)} />
        </Tooltip>
      )}
      <div className="md5">
        <span className="md5-label">MD5</span>
        <code className="md5-value">{md5}</code>
        <button type="button" className="md5-copy" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
      </div>
    </footer>
  );
};

export default SongInfo;
