import type { Difficulty, NotesData, SongExtraData } from "./song";

const DIFFICULTY_ORDER: Difficulty[] = ["expert", "hard", "medium", "easy"];

export interface DrumNoteRow {
  difficulty: Difficulty;
  count: number;
  nps: number | null;
}

const isSet = (value: number | undefined): value is number => value !== undefined && value !== -1;

export const drumsDifficulty = (extra: SongExtraData): number | null =>
  isSet(extra.diff_drums_real) ? extra.diff_drums_real : isSet(extra.diff_drums) ? extra.diff_drums : null;

export const drumKind = (notesData: NotesData | undefined): "Pro" | "5-lane" | null =>
  notesData?.drumType === 1 ? "Pro" : notesData?.drumType === 2 ? "5-lane" : null;

export const drumNoteRows = (notesData: NotesData | undefined): DrumNoteRow[] =>
  DIFFICULTY_ORDER.flatMap(difficulty => {
    const count = notesData?.noteCounts.find(n => n.instrument === "drums" && n.difficulty === difficulty);
    if (!count) return [];
    const peak = notesData?.maxNps.find(n => n.instrument === "drums" && n.difficulty === difficulty);
    return [{ difficulty, count: count.count, nps: peak?.nps ?? null }];
  });
