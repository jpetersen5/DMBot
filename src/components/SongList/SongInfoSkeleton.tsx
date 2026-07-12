import React from "react";
import Skeleton from "../ui/Skeleton/Skeleton";
import "./SongInfoSkeleton.scss";

import IconBass from "../../assets/rb-bass.png";
import IconDrums from "../../assets/rb-drums.png";
import IconGuitar from "../../assets/rb-guitar.png";
import IconRhythm from "../../assets/rb-rhythm.png";
import IconKeys from "../../assets/rb-keys.png";

const SKELETON_PARTS = [
  { name: "Guitar", icon: IconGuitar },
  { name: "Rhythm", icon: IconRhythm },
  { name: "Bass", icon: IconBass },
  { name: "Drums", icon: IconDrums },
  { name: "Keys", icon: IconKeys },
];

const SongInfoSkeleton: React.FC = () => (
  <div className="song-info">
    <div className="song-box">
      <div className="song-column">
        <div className="song-art-box">
          <Skeleton className="sis-art" />
        </div>
        <div className="song-details-box">
          <div className="sis-lines">
            <Skeleton height={28} width="85%" />
            <Skeleton height={22} width="60%" />
            <Skeleton height={16} width="70%" />
            <Skeleton height={16} width="45%" />
            <Skeleton height={16} width="55%" />
          </div>
        </div>
      </div>
    </div>

    <div className="song-column">
      <div className="difficulties">
        <div className="parts">
          {SKELETON_PARTS.map(part => (
            <div key={part.name} className="part inactive">
              <img src={part.icon} />
              <div className="part-difficulty-numeral">
                <Skeleton className="sis-part-numeral" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="chart-features">
        <div className="feature-grid">
          <span className="feature">Solo</span>
          <span className="feature">Lyrics</span>
          <span className="feature">2x Kick</span>
          <span className="feature">Lanes</span>
        </div>
      </div>
    </div>
  </div>
);

export default SongInfoSkeleton;
