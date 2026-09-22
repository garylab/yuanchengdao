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

export const ENGLISH_LEVEL_GROUPS = [
  {
    slug: 'none',
    label: '不需要英语',
    title: '不需要英语的远程工作',
    description: '岗位描述中未提出英语要求，适合英语暂时不是强项的求职者。',
    levels: ['none'] as EnglishLevel[],
  },
  {
    slug: 'basic',
    label: '英语基础即可',
    title: '英语基础即可的远程工作',
    description: '只需日常沟通或中级英语水平（含 B2 及以下），适合边工作边提升。',
    levels: ['basic', 'intermediate', 'upper_intermediate', 'B2'] as EnglishLevel[],
  },
  {
    slug: 'fluent',
    label: '需英语流利',
    title: '需英语流利的远程工作',
    description: '明确要求流利、高级或母语级英语（C1/C2 及以上），通常沟通密集或面向客户。',
    levels: ['C1', 'C2', 'advanced', 'fluent', 'native'] as EnglishLevel[],
  },
] as const;

export type EnglishLevelGroupSlug = (typeof ENGLISH_LEVEL_GROUPS)[number]['slug'];

export function findEnglishLevelGroup(slug: string) {
  return ENGLISH_LEVEL_GROUPS.find((g) => g.slug === slug) || null;
}
