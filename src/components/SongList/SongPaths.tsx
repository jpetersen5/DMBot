import React, { memo, useState } from "react";
import Tooltip from "../../utils/Tooltip/Tooltip";
import { PathBreakdown, SongPath } from "../../utils/song";
import { optimalVariants, parseHydraPath, shortPath, stepVariant, verbosePath } from "../../utils/hydraPath";
import "./SongPaths.scss";

const NOTATION_URL = "https://github.com/DragonDelgar/hydra/wiki/Path-Notation-Quick-Reference";

const BREAKDOWN_ROWS: [keyof PathBreakdown, string][] = [
  ["base", "Base"],
  ["combo", "Combo"],
  ["sp", "Star Power"],
  ["solo", "Solo"],
  ["accents", "Accents"],
  ["ghosts", "Ghosts"],
];

const Breakdown: React.FC<{ breakdown: PathBreakdown }> = ({ breakdown }) => (
  <dl className="path-breakdown">
    {BREAKDOWN_ROWS
      .filter(([key]) => key === "base" || breakdown[key])
      .map(([key, label]) => (
        <React.Fragment key={key}>
          <dt>{label}</dt>
          <dd>{breakdown[key].toLocaleString()}</dd>
        </React.Fragment>
      ))}
  </dl>
);

interface SongPathsProps {
  paths: SongPath[] | null | undefined;
}

const SongPaths: React.FC<SongPathsProps> = ({ paths }) => {
  const [index, setIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  const variants = optimalVariants(paths);
  if (!variants.length) return null;

  const count = variants.length;
  const current = variants[Math.min(index, count - 1)];
  const parsed = parseHydraPath(current.path);
  const step = (delta: 1 | -1) => setIndex(i => stepVariant(i, delta, count));

  return (
    <section className="song-paths" aria-label="Optimal path">
      <div className="song-paths-header">
        <span className="song-paths-label">Optimal</span>
        <span className="song-paths-score">{current.score.toLocaleString()}</span>
        <a className="song-paths-notation" href={NOTATION_URL} target="_blank" rel="noopener noreferrer">
          Path notation
        </a>
      </div>

      <div className="song-paths-row">
        {count > 1 && (
          <button type="button" className="song-paths-step" aria-label="Previous path" onClick={() => step(-1)}>
            ‹
          </button>
        )}
        <Tooltip content={<Breakdown breakdown={current.breakdown} />} position="top">
          <code className="song-paths-path">{shortPath(parsed)}</code>
        </Tooltip>
        {count > 1 && (
          <button type="button" className="song-paths-step" aria-label="Next path" onClick={() => step(1)}>
            ›
          </button>
        )}
        {count > 1 && <span className="song-paths-count">{index + 1} of {count}</span>}
        <button
          type="button"
          className="song-paths-details-toggle"
          aria-expanded={showDetails}
          onClick={() => setShowDetails(shown => !shown)}
        >
          Details
        </button>
      </div>

      {showDetails && (
        <div className="song-paths-details">
          <code className="song-paths-verbose">{verbosePath(parsed) || "No activations"}</code>
          <Breakdown breakdown={current.breakdown} />
        </div>
      )}
    </section>
  );
};

export default memo(SongPaths);
