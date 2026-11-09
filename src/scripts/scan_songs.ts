/**
 * Scans chart folders into the JSON that backend/app/migrations/populate_songs_new_table.py uploads.
 *
 *   node src/scripts/scan_songs.ts <song root>... [--out <file>] [--limit <n>] [--workers <n>]
 *
 * A song's id is the MD5 of its chart file, which is what Clone Hero v1.0 reports with scores.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import type * as ScanChart from "scan-chart";
import { summarizeBpm, type BpmSummary } from "./bpm.ts";
import { splitCharters } from "./charters.ts";
import { playlistFor } from "./playlists.ts";
import { mergeByMd5, type ScannedSong } from "./scannedSong.ts";

const CHART_FILES: { name: string; format: "mid" | "chart" }[] = [
  { name: "notes.mid", format: "mid" },
  { name: "notes.chart", format: "chart" },
  { name: "notes.midi", format: "mid" },
];

/** scan-chart only checks these by file name, so their bytes are never read */
const NAME_ONLY = /\.(ogg|opus|mp3|wav|flac|m4a|mogg|webm|mp4|avi|mkv|mov)$/i;
const EMPTY = new Uint8Array(0);
const DEFAULT_OUT = path.join("backend", "data", "scanned_songs.json");

interface FolderJob { dir: string; rel: string }

type FolderResult =
  | { ok: true; song: ScannedSong }
  | { ok: false; folder: string; error: string };

function bpmFor(scanChart: typeof ScanChart, data: Uint8Array, format: "mid" | "chart", songLengthMs: number | null): BpmSummary {
  try {
    const parsed = scanChart.parseChartFile(data, format);
    return summarizeBpm(parsed.tempos, parsed.resolution, songLengthMs);
  } catch {
    return { bpm_dominant: null, bpm_min: null, bpm_max: null };
  }
}

function scanFolder({ dir, rel }: FolderJob, scanChart: typeof ScanChart): FolderResult {
  const names = fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isFile()).map(e => e.name);
  const files = names.map(fileName => ({
    fileName,
    data: NAME_ONLY.test(fileName) ? EMPTY : new Uint8Array(fs.readFileSync(path.join(dir, fileName))),
  }));

  const chart = CHART_FILES
    .map(candidate => ({ ...candidate, file: files.find(f => f.fileName.toLowerCase() === candidate.name) }))
    .find(candidate => candidate.file);
  if (!chart?.file) return { ok: false, folder: rel, error: "no chart file" };

  const scanned = scanChart.scanChartFolder(files, { includeMd5: false, includeBTrack: false });
  const bpm = bpmFor(scanChart, chart.file.data, chart.format, scanned.song_length ?? null);

  if (scanned.notesData) scanned.notesData.chartIssues = [];
  if (scanned.charter) scanned.charter = splitCharters(scanned.charter).join(",");

  return {
    ok: true,
    song: {
      ...scanned,
      ...bpm,
      md5: createHash("md5").update(chart.file.data).digest("hex"),
      albumArt: null,
      playlistPath: playlistFor(rel),
      folders: [rel],
    },
  };
}

function findSongFolders(roots: string[]): FolderJob[] {
  const jobs: FolderJob[] = [];
  const walk = (root: string, dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    if (entries.some(e => e.isFile() && CHART_FILES.some(c => c.name === e.name.toLowerCase()))) {
      jobs.push({ dir, rel: path.relative(root, dir) });
    }
    for (const entry of entries) {
      if (entry.isDirectory()) walk(root, path.join(dir, entry.name));
    }
  };
  for (const root of roots) walk(root, root);
  return jobs;
}

function parseArgs(argv: string[]) {
  const args = { roots: [] as string[], out: DEFAULT_OUT, limit: Infinity, workers: Math.max(1, os.availableParallelism() - 1) };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out") args.out = argv[++i];
    else if (arg === "--limit") args.limit = Number(argv[++i]);
    else if (arg === "--workers") args.workers = Number(argv[++i]);
    else args.roots.push(arg);
  }
  return args;
}

async function runPool(jobs: FolderJob[], workerCount: number, onResult: (result: FolderResult) => void) {
  let next = 0;
  let done = 0;
  await Promise.all(Array.from({ length: Math.min(workerCount, jobs.length) }, () => new Promise<void>((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url));
    const feed = () => {
      if (next < jobs.length) worker.postMessage(jobs[next++]);
      else worker.terminate().then(() => resolve());
    };
    worker.on("message", (result: FolderResult) => {
      onResult(result);
      if (++done % 250 === 0 || done === jobs.length) process.stdout.write(`\rScanned ${done} of ${jobs.length}`);
      feed();
    });
    worker.on("error", reject);
    feed();
  })));
  process.stdout.write("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.roots.length === 0) {
    console.error("usage: node src/scripts/scan_songs.ts <song root>... [--out <file>] [--limit <n>] [--workers <n>]");
    process.exit(1);
  }
  const missing = args.roots.filter(root => !fs.existsSync(root));
  if (missing.length) {
    console.error(`song root not found: ${missing.join(", ")}`);
    process.exit(1);
  }

  const started = Date.now();
  const jobs = findSongFolders(args.roots).slice(0, args.limit);
  console.log(`Found ${jobs.length} song folders in ${args.roots.join(", ")}; scanning with ${args.workers} workers`);

  const songs: ScannedSong[] = [];
  const errors: { folder: string; error: string }[] = [];
  await runPool(jobs, args.workers, result => {
    if (result.ok) songs.push(result.song);
    else errors.push({ folder: result.folder, error: result.error });
  });

  const merged = mergeByMd5(songs);
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, JSON.stringify(merged));
  const errorsFile = args.out.replace(/\.json$/, "_errors.json");
  if (errors.length) fs.writeFileSync(errorsFile, JSON.stringify(errors, null, 2));

  const unnamed = merged.filter(song => !song.playlistPath).length;
  const withBpm = merged.filter(song => song.bpm_dominant != null).length;
  console.log(`Wrote ${merged.length} songs (${songs.length - merged.length} duplicate folders merged) to ${args.out}`);
  console.log(`BPM found for ${withBpm}; no playlist name for ${unnamed}`);
  if (errors.length) console.log(`${errors.length} folders failed, see ${errorsFile}`);
  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(0)}s`);
}

if (isMainThread) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
} else {
  const scanChart = createRequire(import.meta.url)("scan-chart") as typeof ScanChart;
  parentPort!.on("message", (job: FolderJob) => {
    let result: FolderResult;
    try {
      result = scanFolder(job, scanChart);
    } catch (error) {
      result = { ok: false, folder: job.rel, error: String(error) };
    }
    parentPort!.postMessage(result);
  });
}
