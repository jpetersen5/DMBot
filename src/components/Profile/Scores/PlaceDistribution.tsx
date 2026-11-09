import React, { useMemo } from "react";
import { Score, medalForRank } from "../../../utils/score";
import { PLACE_BUCKETS, buildPlaceDistribution } from "../../../utils/placeBuckets";
import "./PlaceDistribution.scss";

interface PlaceDistributionProps {
  scores: Score[];
  selected: string[];
  onToggle: (bucketKey: string) => void;
}

const PlaceDistribution: React.FC<PlaceDistributionProps> = ({ scores, selected, onToggle }) => {
  const { counts, unranked, total } = useMemo(() => buildPlaceDistribution(scores), [scores]);
  const max = useMemo(() => Math.max(1, ...Object.values(counts)), [counts]);

  if (total === 0) return null;

  return (
    <div className="place-distribution">
      <div className="place-distribution-header">
        <h3>Leaderboard Placements</h3>
      </div>

      <div className="place-chips">
        {PLACE_BUCKETS.map(bucket => {
          const count = counts[bucket.key];
          const isSelected = selected.includes(bucket.key);
          const medal = bucket.min === bucket.max ? medalForRank(bucket.min) : null;
          return (
            <button
              key={bucket.key}
              className={`place-chip ${medal ?? ""} ${isSelected ? "selected" : ""}`}
              disabled={count === 0}
              aria-pressed={isSelected}
              onClick={() => onToggle(bucket.key)}
            >
              <span className={`place-chip-label ${medal ? `medal-${medal}` : ""}`}>{bucket.label}</span>
              <span className="place-chip-count">{count.toLocaleString()}</span>
              <span className="place-chip-bar" style={{ width: `${(count / max) * 100}%` }} />
            </button>
          );
        })}
      </div>

      {unranked > 0 && (
        <p className="place-unranked">
          {unranked.toLocaleString()} score{unranked === 1 ? "" : "s"} without a placement
        </p>
      )}
    </div>
  );
};

export default PlaceDistribution;
