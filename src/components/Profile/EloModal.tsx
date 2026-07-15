import React, { useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
} from "chart.js";
import "chartjs-adapter-date-fns";
import { EloHistory } from "../../utils/user";
import Modal from "../ui/Modal/Modal";
import "./EloModal.scss";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale);

interface EloModalProps {
  show: boolean;
  onHide: () => void;
  eloHistory?: EloHistory[];
  elo?: number;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const PRESETS: { label: string; ms: number }[] = [
  { label: "12h", ms: 12 * HOUR },
  { label: "24h", ms: 24 * HOUR },
  { label: "7d", ms: 7 * DAY },
  { label: "30d", ms: 30 * DAY },
];

const fmt = (ts: number) =>
  new Date(ts).toLocaleString(undefined, {
    month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });

interface RangeSliderProps {
  min: number;
  max: number;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
}

const RangeSlider: React.FC<RangeSliderProps> = ({ min, max, start, end, onChange }) => {
  const range = Math.max(max - min, 1);
  const minSpan = Math.max(range * 0.02, 60 * 1000);

  const startPct = ((start - min) / range) * 100;
  const endPct = ((end - min) / range) * 100;

  const beginDrag = (mode: "start" | "end" | "band") => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const track = e.currentTarget.parentElement;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const posToTs = (clientX: number) => {
      const pct = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      return min + pct * range;
    };

    const anchorTs = posToTs(e.clientX);
    const s0 = start;
    const e0 = end;

    const move = (ev: PointerEvent) => {
      const ts = posToTs(ev.clientX);
      if (mode === "start") {
        onChange(Math.min(ts, e0 - minSpan), e0);
      } else if (mode === "end") {
        onChange(s0, Math.max(ts, s0 + minSpan));
      } else {
        const span = e0 - s0;
        let s = s0 + (ts - anchorTs);
        s = Math.min(Math.max(s, min), max - span);
        onChange(s, s + span);
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="range-slider">
      <div className="track" />
      <div
        className="band"
        style={{ left: `${startPct}%`, width: `${Math.max(endPct - startPct, 0)}%` }}
        onPointerDown={beginDrag("band")}
      />
      <div
        className="handle"
        style={{ left: `${startPct}%` }}
        onPointerDown={beginDrag("start")}
        role="slider"
        aria-label="Range start"
        aria-valuenow={start}
      />
      <div
        className="handle"
        style={{ left: `${endPct}%` }}
        onPointerDown={beginDrag("end")}
        role="slider"
        aria-label="Range end"
        aria-valuenow={end}
      />
    </div>
  );
};

const EloModal: React.FC<EloModalProps> = ({ show, onHide, eloHistory, elo }) => {
  const [chartBorderColor] = useState<string>(() => {
    const theme = localStorage.getItem("theme") || "light";
    return theme === "light" ? "rgba(32, 32, 32, 1)" : "rgba(255, 255, 255, 1)";
  });

  const sorted = useMemo(() => {
    if (!eloHistory) return [];
    return [...eloHistory]
      .map(e => ({ t: new Date(e.timestamp).getTime(), elo: e.elo }))
      .filter(e => !Number.isNaN(e.t))
      .sort((a, b) => a.t - b.t);
  }, [eloHistory]);

  const [now] = useState(() => Date.now());
  const firstTs = sorted.length > 0 ? sorted[0].t : now;
  const minTs = Math.min(firstTs, now - 30 * DAY);
  const maxTs = now;

  const [win, setWin] = useState<{ start: number; end: number }>(() => {
    const n = Date.now();
    return { start: n - 30 * DAY, end: n };
  });

  const setWindow = (start: number, end: number) =>
    setWin({
      start: Math.min(Math.max(start, minTs), maxTs),
      end: Math.min(Math.max(end, minTs), maxTs),
    });

  const windowStart = Math.min(Math.max(win.start, minTs), maxTs);
  const windowEnd = Math.max(Math.min(win.end, maxTs), windowStart);

  const applyPreset = (ms: number) => setWindow(Math.max(now - ms, minTs), now);
  const activePreset = (ms: number) =>
    windowEnd === now && windowStart === Math.max(now - ms, minTs);

  const chartData = useMemo(() => {
    if (sorted.length === 0) return null;

    let carry = sorted[0].elo;
    for (const e of sorted) {
      if (e.t <= windowStart) carry = e.elo;
      else break;
    }

    const points: { x: number; y: number }[] = [{ x: windowStart, y: carry }];
    for (const e of sorted) {
      if (e.t > windowStart && e.t <= windowEnd) points.push({ x: e.t, y: e.elo });
    }
    const lastElo = points[points.length - 1].y;
    const finalElo = windowEnd >= now ? (elo ?? lastElo) : lastElo;
    points.push({ x: windowEnd, y: finalElo });

    return {
      datasets: [
        {
          label: "Elo",
          data: points,
          fill: false,
          borderColor: chartBorderColor,
          stepped: "before" as const,
          tension: 0,
        },
      ],
    };
  }, [sorted, windowStart, windowEnd, now, elo, chartBorderColor]);

  const windowMs = windowEnd - windowStart;
  const unit: "hour" | "day" | "month" =
    windowMs <= 2 * DAY ? "hour" : windowMs <= 90 * DAY ? "day" : "month";

  const options = useMemo(() => ({
    responsive: true,
    animation: false as const,
    scales: {
      x: {
        type: "time" as const,
        time: {
          unit,
          displayFormats: {
            hour: "HH:mm",
            day: "MMM dd",
            month: "MMM yyyy",
          },
        },
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 15,
        },
        min: windowStart,
        max: windowEnd,
      },
      y: {
        beginAtZero: false,
      },
    },
    plugins: {
      legend: { display: false },
    },
  }), [unit, windowStart, windowEnd]);

  return (
    <Modal show={show} onHide={onHide} size="lg" title="Elo History" className="elo-modal">
      {chartData ? (
        <div className="elo-chart">
          <div className="chart-controls">
            <div className="preset-buttons">
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  type="button"
                  className={activePreset(p.ms) ? "active" : ""}
                  onClick={() => applyPreset(p.ms)}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                className={windowStart === minTs && windowEnd === maxTs ? "active" : ""}
                onClick={() => setWindow(minTs, maxTs)}
              >
                All
              </button>
            </div>
            <RangeSlider
              min={minTs}
              max={maxTs}
              start={windowStart}
              end={windowEnd}
              onChange={setWindow}
            />
            <span className="range-label">{fmt(windowStart)} — {fmt(windowEnd)}</span>
          </div>
          <Line data={chartData} options={options} />
        </div>
      ) : (
        <p className="no-history">No Elo history available yet.</p>
      )}
    </Modal>
  );
};

export default EloModal;
