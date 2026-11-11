import type { SongPath } from "./song";

export interface Activation {
  short: string;
  timing: string | null;
}

export interface ParsedPath {
  squeezes: string[];
  activations: Activation[];
}

const isPlaceholder = (section: string) => section.startsWith("(No ");

export const parseHydraPath = (path: string): ParsedPath => {
  const split = path.indexOf(" | ");
  const squeezeSection = split === -1 ? "" : path.slice(0, split).trim();
  const activationSection = (split === -1 ? path : path.slice(split + 3)).trim();

  const squeezes = !squeezeSection || isPlaceholder(squeezeSection) ? [] : squeezeSection.split(", ");
  const activations: Activation[] = [];
  if (activationSection && !isPlaceholder(activationSection)) {
    for (const match of activationSection.matchAll(/(\S+)(?: \(([^)]*)\))?/g)) {
      activations.push({ short: match[1], timing: match[2] ?? null });
    }
  }
  return { squeezes, activations };
};

export const shortPath = (parsed: ParsedPath): string =>
  parsed.activations.length ? parsed.activations.map(a => a.short).join(" ") : "No activations";

export const optimalVariants = (paths: SongPath[] | null | undefined): SongPath[] => {
  if (!paths?.length) return [];
  return paths.filter(p => p.score === paths[0].score);
};
