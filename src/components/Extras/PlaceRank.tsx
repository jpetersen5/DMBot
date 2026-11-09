import React from "react";
import { formatRank, medalForRank } from "../../utils/score";
import "./PlaceRank.scss";

interface PlaceRankProps {
  rank: number;
  boardSize?: number;
}

const PlaceRank: React.FC<PlaceRankProps> = ({ rank, boardSize }) => {
  const medal = medalForRank(rank);
  return (
    <span className="place-rank">
      <span className={`place-rank-place ${medal ? `medal-${medal}` : ""}`}>{formatRank(rank)}</span>
      {rank > 0 && boardSize ? <span className="place-rank-of">/ {boardSize}</span> : null}
    </span>
  );
};

export default PlaceRank;
