export interface Tempo {
  tick: number;
  beatsPerMinute: number;
  msTime?: number;
}

export interface BpmSummary {
  bpm_dominant: number | null;
  bpm_min: number | null;
  bpm_max: number | null;
}

const EMPTY: BpmSummary = { bpm_dominant: null, bpm_min: null, bpm_max: null };

/** charts occasionally carry gimmick markers far outside any playable tempo */
const MIN_PLAUSIBLE_BPM = 20;
const MAX_PLAUSIBLE_BPM = 600;

const isPlausible = (bpm: number): boolean =>
  Number.isFinite(bpm) && bpm >= MIN_PLAUSIBLE_BPM && bpm <= MAX_PLAUSIBLE_BPM;

/** duration-weighted dominant BPM, plus the min and max across the tempo map */
export function summarizeBpm(
  tempos: Tempo[],
  resolution: number,
  songLengthMs: number | null
): BpmSummary {
  const usable = (tempos ?? [])
    .filter(tempo => isPlausible(tempo.beatsPerMinute))
    .sort((a, b) => a.tick - b.tick);

  if (usable.length === 0) return EMPTY;

  const rounded = usable.map(tempo => Math.round(tempo.beatsPerMinute));
  const bpm_min = Math.min(...rounded);
  const bpm_max = Math.max(...rounded);

  if (usable.length === 1) {
    return { bpm_dominant: rounded[0], bpm_min, bpm_max };
  }

  const weightByBpm = new Map<number, number>();

  for (let i = 0; i < usable.length; i++) {
    const tempo = usable[i];
    const next = usable[i + 1];
    let durationMs: number;

    if (next) {
      durationMs = next.msTime != null && tempo.msTime != null
        ? next.msTime - tempo.msTime
        : ticksToMs(next.tick - tempo.tick, resolution, tempo.beatsPerMinute);
    } else if (songLengthMs != null && tempo.msTime != null) {
      durationMs = songLengthMs - tempo.msTime;
    } else {
      // no way to close the final segment; it contributes nothing
      continue;
    }

    if (!Number.isFinite(durationMs) || durationMs <= 0) continue;

    const key = Math.round(tempo.beatsPerMinute);
    weightByBpm.set(key, (weightByBpm.get(key) ?? 0) + durationMs);
  }

  if (weightByBpm.size === 0) {
    // every segment was zero-length or unclosable, fall back to the opening tempo
    return { bpm_dominant: rounded[0], bpm_min, bpm_max };
  }

  let bpm_dominant = rounded[0];
  let best = -1;
  for (const [bpm, weight] of weightByBpm) {
    // ties break toward the lower BPM for stability across re-scans
    if (weight > best || (weight === best && bpm < bpm_dominant)) {
      best = weight;
      bpm_dominant = bpm;
    }
  }

  return { bpm_dominant, bpm_min, bpm_max };
}

function ticksToMs(deltaTicks: number, resolution: number, bpm: number): number {
  if (!resolution || resolution <= 0 || bpm <= 0) return 0;
  return (deltaTicks / resolution) * (60_000 / bpm);
}
