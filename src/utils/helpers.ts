import { parseEnglishLevel, type EnglishLevel } from '../constants/englishLevel';

function dateCutoff(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 19).replace('T', ' ');
}

export function activeCutoff(): string {
  return dateCutoff(30);
}

export function expiredCutoff(): string {
  return dateCutoff(90);
}

export function jobDisplayTimestamp(job: {
  created_at?: string;
  posted_at?: string | null;
}): string | null {
  return job.created_at || job.posted_at || null;
}

export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '最近';
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 30) return `${days}天前`;
  if (days < 365) return `${Math.floor(days / 30)}个月前`;
  return `${Math.floor(days / 365)}年前`;
}

export function formatBeijingTime(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

const CYCLE_LABELS: Record<string, string> = {
  hour: '/时',
  day: '/天',
  week: '/周',
  month: '/月',
  year: '/年',
};

function formatSalaryAmountPart(amount: number): string {
  const rounded = Math.round(amount);
  if (rounded >= 10000) {
    const inWan = Math.round((rounded / 10000) * 10) / 10;
    return `${Number.isInteger(inWan) ? inWan : inWan.toFixed(1)}万`;
  }
  if (rounded >= 1000) {
    const inThousands = Math.round((rounded / 1000) * 10) / 10;
    const nearestWholeK = Math.round(inThousands);
    if (Math.abs(inThousands - nearestWholeK) < 1e-6) {
      return `${nearestWholeK}k`;
    }
    return `${inThousands.toFixed(1)}k`;
  }
  return String(rounded);
}

export function formatSalary(lower: number, upper: number, currency: string, payCycle: string): string {
  if (!lower && !upper) return '';
  const sym = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : `${currency} `;
  const cycle = CYCLE_LABELS[payCycle] || '/年';
  if (lower && upper) {
    if (Math.round(lower) === Math.round(upper)) {
      return `${sym}${formatSalaryAmountPart(lower)}${cycle}`;
    }
    return `${sym}${formatSalaryAmountPart(lower)} - ${sym}${formatSalaryAmountPart(upper)}${cycle}`;
  }
  if (lower) return `${sym}${formatSalaryAmountPart(lower)}+${cycle}`;
  if (upper) return `最高 ${sym}${formatSalaryAmountPart(upper)}${cycle}`;
  return '';
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * List rows ship only a preview of each description; the full text (and the
 * highlight blocks) are fetched from /api/jobs/:id/description when the row is
 * expanded. Thirty untruncated descriptions were ~80% of the homepage HTML.
 */
export const JOB_DESCRIPTION_PREVIEW_CHARS = 320;

/** Logos above the fold load eagerly; the rest of a list is lazy. */
export const EAGER_LOGO_ROWS = 5;

export function jobDescriptionPreview(description: string | null | undefined): { text: string; truncated: boolean } {
  const full = description || '';
  if (full.length <= JOB_DESCRIPTION_PREVIEW_CHARS) return { text: full, truncated: false };
  return { text: full.slice(0, JOB_DESCRIPTION_PREVIEW_CHARS).trimEnd() + '…', truncated: true };
}

export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.substring(0, len) + '...';
}

export function resolveThumbnail(thumb: string | null | undefined, staticUrl: string): string | undefined {
  if (!thumb) return undefined;
  if (thumb.startsWith('http://') || thumb.startsWith('https://')) return thumb;
  return `${staticUrl}/${thumb}`;
}

export function breadcrumb(items: Array<{ label: string; href?: string }>): string {
  const parts = items.map((item) => {
    if (item.href) {
      return `<a href="${item.href}" class="text-surface-400 hover:text-brand-500 transition no-underline">${escapeHtml(item.label)}</a>`;
    }
    return `<span class="text-surface-500">${escapeHtml(item.label)}</span>`;
  });
  return `<nav class="max-w-5xl mx-auto px-4 mt-4 text-xs flex items-center gap-1.5">${parts.join('<span class="text-surface-300">/</span>')}</nav>`;
}

export function companyLogo(name: string | null | undefined, thumbnail: string | null | undefined, size: 'sm' | 'md' | 'lg' = 'md', eager = false): string {
  const companyName = name || '?';
  const firstWord = companyName.split(/\s+/)[0];
  const label = firstWord.length <= 7 ? firstWord : companyName[0];
  const escaped = escapeHtml(label);
  const alt = escapeHtml(`${companyName} logo`);

  const cfg: Record<string, { wh: string; px: number; rounded: string; pad: string; fontSize: string }> = {
    sm:  { wh: 'w-8 h-8',   px: 32, rounded: 'rounded', pad: 'p-0.5', fontSize: label.length <= 2 ? 'text-xs' : 'text-[9px]' },
    md:  { wh: 'w-12 h-12', px: 48, rounded: 'rounded', pad: 'p-1.5', fontSize: label.length <= 2 ? 'text-lg' : label.length <= 5 ? 'text-xs' : 'text-[10px]' },
    lg:  { wh: 'w-16 h-16', px: 64, rounded: 'rounded', pad: 'p-2',   fontSize: label.length <= 2 ? 'text-xl' : label.length <= 5 ? 'text-sm' : 'text-xs' },
  };
  const c = cfg[size];

  const fallbackDisplay = thumbnail ? 'hidden' : 'flex';
  const fallback = `<div class="${fallbackDisplay} ${c.wh} ${c.rounded} bg-brand-50 items-center justify-center ${c.fontSize} font-bold text-brand-500 leading-tight text-center overflow-hidden ${c.pad}">${escaped}</div>`;

  // Intrinsic size reserves the box (no CLS); only the handful of logos above the
  // fold are eager, the rest of a 30-row list is lazy.
  const img = thumbnail
    ? `<img src="${escapeHtml(thumbnail)}" alt="${alt}" width="${c.px}" height="${c.px}" loading="${eager ? 'eager' : 'lazy'}" decoding="async" class="${c.wh} ${c.rounded} object-contain bg-surface-100 flex-shrink-0" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';

  return `<div class="flex-shrink-0 ${c.wh}">${img}${fallback}</div>`;
}

const LOCATION_REQ_BADGES: Record<number, { icon: string; label: string; labelled: (where: string) => string; css: string }> = {
  1: { icon: '📍', label: '限本国',     labelled: (w) => `仅限${w}`,     css: 'bg-amber-50 text-amber-700' },
  2: { icon: '🗺️', label: '限特定地区', labelled: (w) => `仅限${w}`,     css: 'bg-orange-50 text-orange-700' },
  3: { icon: '🕐', label: '限时区',     labelled: (w) => `限${w}`,       css: 'bg-violet-50 text-violet-700' },
  4: { icon: '📋', label: '需工作许可', labelled: (w) => `需${w}工作许可`, css: 'bg-red-50 text-red-700' },
  // 5 = unknown: the posting says nothing about eligibility, so show nothing.
};

export function locationRequirementBadge(req: number | null | undefined, where?: string | null): string {
  if (!req) return '';
  const cfg = LOCATION_REQ_BADGES[req];
  if (!cfg) return '';
  const trimmed = (where || '').trim();
  // Name the country/region when we know it — a bare "限本国" does not tell the
  // reader which country they need to be in.
  const text = trimmed ? cfg.labelled(escapeHtml(trimmed)) : cfg.label;
  return `<span class="tag-pill ${cfg.css} text-xs">${cfg.icon} ${text}</span>`;
}

const ENGLISH_LEVEL_BADGES: Record<EnglishLevel, { label: string; css: string } | null> = {
  none: null,
  basic: { label: '需英语基础', css: 'bg-slate-50 text-slate-600' },
  intermediate: { label: '需英语中级', css: 'bg-sky-50 text-sky-800' },
  upper_intermediate: { label: '需英语中高级', css: 'bg-sky-50 text-sky-800' },
  B2: { label: '需英语B2+', css: 'bg-indigo-50 text-indigo-800' },
  C1: { label: '需英语C1', css: 'bg-indigo-50 text-indigo-800' },
  C2: { label: '需英语C2', css: 'bg-violet-50 text-violet-800' },
  advanced: { label: '需英语高级', css: 'bg-indigo-50 text-indigo-800' },
  fluent: { label: '需英语流利', css: 'bg-violet-50 text-violet-800' },
  native: { label: '需英语母语', css: 'bg-emerald-50 text-emerald-800' },
};

export function englishLevelBadge(level: EnglishLevel | string | null | undefined): string {
  const normalized = parseEnglishLevel(level);
  if (normalized === 'none') return '';
  const cfg = ENGLISH_LEVEL_BADGES[normalized];
  if (!cfg) return '';
  return `<span class="tag-pill ${cfg.css} text-xs">🗣️ ${cfg.label}</span>`;
}

export function formatLocationRequirementPlainText(req: number | null | undefined): string {
  if (!req) return '';
  const cfg = LOCATION_REQ_BADGES[req];
  return cfg ? `${cfg.icon} ${cfg.label}` : '';
}

export function formatEnglishLevelPlainText(level: EnglishLevel | string | null | undefined): string {
  const normalized = parseEnglishLevel(level);
  if (normalized === 'none') return '';
  const cfg = ENGLISH_LEVEL_BADGES[normalized];
  return cfg ? `🗣️ ${cfg.label}` : '';
}

interface ScheduleType {
  cn: string;
  /** schema.org employmentType value, for the JobPosting markup. */
  schemaOrg: string;
  /** Feed spellings, already lowercased and with unicode dashes normalised. */
  tokens: string[];
}

const SCHEDULE_TYPES: ScheduleType[] = [
  {
    cn: '全职',
    schemaOrg: 'FULL_TIME',
    tokens: ['full-time', 'fulltime', 'vollzeit', 'fuld tid', 'tiempo completo', 'a tiempo completo', 'tempo integral', 'à plein temps', 'fulltime en', 'フルタイム', 'دوام كامل'],
  },
  {
    cn: '兼职',
    schemaOrg: 'PART_TIME',
    tokens: ['part-time', 'parttime', 'teilzeit', 'deltid', 'medio tiempo', 'a tiempo parcial', 'tempo partiel', 'à temps partiel', 'meio período', 'meio periodo', 'fulltime, parttime', 'parttime en', 'دوام جزئي'],
  },
  {
    cn: '合同',
    schemaOrg: 'CONTRACTOR',
    tokens: ['contractor', 'contract', 'auftragnehmer', 'kontraktansat', 'prestataire', 'prestador de serviços', 'prestador de servicos', 'contratista', 'متعاقد', '契約社員', 'freelance'],
  },
  {
    cn: '实习',
    schemaOrg: 'INTERN',
    tokens: ['internship', 'stage', 'praktik', 'praktikum', 'prácticas', 'practicas', 'pasantía', 'pasantia', 'estágio', 'estagio', 'インターン', 'فترة تدريب'],
  },
  {
    cn: '临时',
    schemaOrg: 'TEMPORARY',
    tokens: ['temporary'],
  },
];

function matchScheduleTypes(
  detectedExtensions: string | null | undefined,
): { raw: string; matched: ScheduleType[] } | null {
  if (!detectedExtensions) return null;

  let scheduleType: string | undefined;
  try {
    const parsed = JSON.parse(detectedExtensions) as Record<string, unknown>;
    scheduleType = typeof parsed.schedule_type === 'string' ? parsed.schedule_type.trim() : undefined;
  } catch {
    scheduleType = undefined;
  }
  if (!scheduleType) return null;

  const normalized = scheduleType.replace(/[‐‑‒–—−]/g, '-').toLowerCase();
  return {
    raw: scheduleType,
    matched: SCHEDULE_TYPES.filter((t) => t.tokens.some((needle) => normalized.includes(needle))),
  };
}

export function scheduleTypeBadge(detectedExtensions: string | null | undefined): string {
  const match = matchScheduleTypes(detectedExtensions);
  if (!match) return '';
  // Nothing recognised still shows the feed's own wording rather than dropping it.
  const label = match.matched.length > 0 ? match.matched.map((t) => t.cn).join(' / ') : match.raw;
  return `<span class="tag-pill bg-surface-100 text-surface-700 text-xs">⏱ ${escapeHtml(label)}</span>`;
}

/**
 * schema.org employmentType values for a posting, or [] when the feed said
 * nothing we can map. Defaulting to FULL_TIME — which is what the JobPosting
 * markup used to do for every job — is a claim about the posting that the data
 * does not support, so an unrecognised schedule now yields no claim at all.
 */
export function employmentTypes(detectedExtensions: string | null | undefined): string[] {
  const match = matchScheduleTypes(detectedExtensions);
  if (!match) return [];
  return match.matched.map((t) => t.schemaOrg);
}

export function rewriteUtm(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set('utm_source', 'yuanchengdao.com');
    u.searchParams.set('utm_medium', 'referral');
    u.searchParams.set('utm_campaign', 'yuanchengdao');
    return u.toString();
  } catch {
    return url;
  }
}

export function chineseFriendlyBadge(flag: number | null | undefined): string {
  if (!flag) return '';
  return `<span class="tag-pill bg-rose-50 text-rose-700 text-xs">🇨🇳 中文优先</span>`;
}

export function formatDateCn(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * D1 stores timestamps as "2026-10-05 12:34:56" (datetime('now'), always UTC),
 * which is not valid ISO 8601 — schema.org dates must be, so convert before
 * emitting them into JSON-LD or a feed.
 */
export function toIsoDateTime(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function isJobStale(postedAt: string | null | undefined, days = 30): boolean {
  if (!postedAt) return false;
  const t = new Date(postedAt.includes('T') ? postedAt : postedAt.replace(' ', 'T') + 'Z').getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t > days * 86400000;
}
