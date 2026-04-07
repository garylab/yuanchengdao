export const ENGLISH_LEVEL_VALUES = [
  'none',
  'basic',
  'intermediate',
  'upper_intermediate',
  'B2',
  'C1',
  'C2',
  'advanced',
  'fluent',
  'native',
] as const;

export type EnglishLevel = (typeof ENGLISH_LEVEL_VALUES)[number];

const ENGLISH_LEVEL_SET = new Set<string>(ENGLISH_LEVEL_VALUES);

export function parseEnglishLevel(raw: unknown): EnglishLevel {
  if (raw === null || raw === undefined) return 'none';
  const normalized = String(raw).trim();
  if (normalized === '') return 'none';
  if (ENGLISH_LEVEL_SET.has(normalized)) return normalized as EnglishLevel;
  const lower = normalized.toLowerCase();
  if (lower === 'b2') return 'B2';
  if (lower === 'c1') return 'C1';
  if (lower === 'c2') return 'C2';
  if (ENGLISH_LEVEL_SET.has(lower)) return lower as EnglishLevel;
  return 'none';
}
