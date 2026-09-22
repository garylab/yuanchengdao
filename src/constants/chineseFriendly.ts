const CHINESE_FRIENDLY_PATTERNS: RegExp[] = [
  /中文/,
  /普通话/,
  /华人/,
  /汉语/,
  /粤语/,
  /华语/,
  /mandarin/i,
  /cantonese/i,
  /chinese[\s-]*(speak|language|fluen|proficien|native|bilingual)/i,
  /(speak|fluent|proficien|native|bilingual)[^.\n]{0,20}chinese/i,
  /中英(双语|文)/,
];

export function detectChineseFriendly(...texts: Array<string | null | undefined>): boolean {
  const combined = texts.filter(Boolean).join('\n');
  if (!combined) return false;
  return CHINESE_FRIENDLY_PATTERNS.some((re) => re.test(combined));
}
