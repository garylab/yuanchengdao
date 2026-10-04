import { CrawledJob } from '../types';

/**
 * Admin-managed blocklist of job sources we refuse to republish — mostly sites
 * that are themselves aggregators, so their listings are already second-hand.
 *
 * Two kinds of rule, because Google's `via` label and the apply link disagree
 * often enough that either alone leaks:
 *   - `via`    matches the "via XXX" attribution SerpAPI returns.
 *   - `domain` matches the host of any apply_options link, subdomains included.
 */
export type BlockMatchType = 'via' | 'domain';

export interface BlockedSource {
  id: number;
  pattern: string;
  match_type: BlockMatchType;
}

export function isBlockMatchType(value: string): value is BlockMatchType {
  return value === 'via' || value === 'domain';
}

/** "Talent.com" and "talent com" are the same publisher; compare them that way. */
export function normalizeViaPattern(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Accepts a bare host, a full URL, or a pasted "www." host. */
export function normalizeDomainPattern(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/^www\./, '')
    .replace(/\.$/, '');
}

export function normalizePattern(value: string, matchType: BlockMatchType): string {
  return matchType === 'domain' ? normalizeDomainPattern(value) : value.trim().toLowerCase();
}

export async function loadBlockedSources(db: D1Database): Promise<BlockedSource[]> {
  const result = await db
    .prepare('SELECT id, pattern, match_type FROM blocked_sources WHERE is_active = 1')
    .all<BlockedSource>();
  return (result.results || []).filter((rule) => isBlockMatchType(rule.match_type));
}

function hostMatches(host: string, pattern: string): boolean {
  return host === pattern || host.endsWith(`.${pattern}`);
}

function applyHosts(applyOptionsJson: string | null): string[] {
  if (!applyOptionsJson) return [];
  let options: unknown;
  try {
    options = JSON.parse(applyOptionsJson);
  } catch {
    return [];
  }
  if (!Array.isArray(options)) return [];

  const hosts: string[] = [];
  for (const opt of options) {
    const link = (opt as { link?: unknown })?.link;
    if (typeof link !== 'string') continue;
    try {
      hosts.push(new URL(link).hostname.toLowerCase().replace(/^www\./, ''));
    } catch {
      continue;
    }
  }
  return hosts;
}

/** Returns the first rule the listing trips, or null when it is clean. */
export function matchBlockedSource(
  job: Pick<CrawledJob, 'via' | 'apply_options'>,
  rules: BlockedSource[],
): BlockedSource | null {
  if (rules.length === 0) return null;

  const via = normalizeViaPattern(job.via || '');
  const hosts = applyHosts(job.apply_options);

  for (const rule of rules) {
    if (rule.match_type === 'via') {
      if (via && normalizeViaPattern(rule.pattern) === via) return rule;
      continue;
    }
    const pattern = normalizeDomainPattern(rule.pattern);
    if (pattern && hosts.some((host) => hostMatches(host, pattern))) return rule;
  }

  return null;
}
