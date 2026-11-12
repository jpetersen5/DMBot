import React from "react";
import Skeleton from "../ui/Skeleton/Skeleton";
import "./SongInfo.scss";
import "./SongInfoSkeleton.scss";

const SongInfoSkeleton: React.FC = () => (
  <div className="song-info">
    <div className="song-header">
      <Skeleton className="song-art-box" />
      <div className="song-header-text sis-lines">
        <Skeleton height={26} width="75%" />
        <Skeleton height={20} width="50%" />
        <Skeleton height={14} width="65%" />
        <Skeleton height={14} width="35%" />
      </div>
    </div>
    <div className="drums-card">
      <Skeleton height={32} width="80%" />
      <Skeleton height={24} width="95%" />
      <Skeleton height={16} width="60%" />
    </div>
    <Skeleton height={22} width="70%" />
  </div>
);

export default SongInfoSkeleton;
