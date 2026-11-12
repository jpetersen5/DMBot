import React, { memo, useState } from "react";
import { PathBreakdown, SongPath } from "../../utils/song";
import { optimalVariants, parseHydraPath, shortPath, stepVariant, verbosePath } from "../../utils/hydraPath";
import "./SongPaths.scss";

const NOTATION_URL = "https://github.com/DragonDelgar/hydra/wiki/Path-Notation-Quick-Reference";

const BREAKDOWN_ROWS: [keyof PathBreakdown, string][] = [
  ["base", "Base"],
  ["combo", "Combo"],
  ["sp", "SP"],
  ["solo", "Solo"],
  ["accents", "Accents"],
  ["ghosts", "Ghosts"],
];

const Breakdown: React.FC<{ breakdown: PathBreakdown }> = ({ breakdown }) => (
  <dl className="path-breakdown">
    {BREAKDOWN_ROWS
      .filter(([key]) => key === "base" || breakdown[key])
      .map(([key, label]) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd>{breakdown[key].toLocaleString()}</dd>
        </div>
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
  if (!variants.length) return <p className="song-paths song-paths-empty">No optimal path</p>;

  const count = variants.length;
  const current = variants[Math.min(index, count - 1)];
  const parsed = parseHydraPath(current.path);
  const short = shortPath(parsed);
  const verbose = verbosePath(parsed);
  const hasTimings = verbose !== short;
  const step = (delta: 1 | -1) => setIndex(i => stepVariant(i, delta, count));

  return (
    <section className="song-paths" aria-label="Optimal path">
      <div className="song-paths-row">
        <span className="song-paths-label">Optimal</span>
        <span className="song-paths-score">{current.score.toLocaleString()}</span>
        <code className="song-paths-path">{short}</code>
        {count > 1 && (
          <div className="song-paths-stepper">
            <button type="button" className="song-paths-step" aria-label="Previous path" onClick={() => step(-1)}>
              ‹
            </button>
            <span className="song-paths-count">{index + 1} of {count}</span>
            <button type="button" className="song-paths-step" aria-label="Next path" onClick={() => step(1)}>
              ›
            </button>
          </div>
        )}
      </div>

      <div className="song-paths-meta">
        <Breakdown breakdown={current.breakdown} />
        <div className="song-paths-links">
          {hasTimings && (
            <button
              type="button"
              className="song-paths-details-toggle"
              aria-expanded={showDetails}
              onClick={() => setShowDetails(shown => !shown)}
            >
              Timings
            </button>
          )}
          <a className="song-paths-notation" href={NOTATION_URL} target="_blank" rel="noopener noreferrer">
            Path notation
          </a>
        </div>
      </div>

      {hasTimings && showDetails && <code className="song-paths-verbose">{verbose}</code>}
    </section>
  );
};

export default memo(SongPaths);
