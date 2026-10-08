import { CrawledJob } from '../types';

/**
 * Admin-managed blocklist of job sources we refuse to republish — mostly sites
 * that are themselves aggregators, so their listings are already second-hand.
 *
 * Two kinds of rule, because Google's `via` label and the apply link disagree
 * often enough that either alone leaks:
 *   - `via`    matches the "via XXX" attribution SerpAPI returns.
 *   - `domain` matches the host of any apply_options link, subdomains included.
 *
 * A listing is only dropped when it has no first-party way in. Google usually
 * returns several apply links for one posting, and a company's own careers
 * page sitting next to a jobgether copy is the normal case, not the exception.
 * So a tainted link is stripped rather than fatal; the job is blocked only when
 * every link is tainted, or when it has no links and the `via` label is.
 */
export type BlockMatchType = 'via' | 'domain';

export interface BlockedSource {
  id: number;
  pattern: string;
  match_type: BlockMatchType;
}

export interface SourceScreening {
  /** The rule that leaves the listing with no first-party link, or null to keep it. */
  blocked: BlockedSource | null;
  /** apply_options with tainted links removed; unchanged when nothing was stripped. */
  applyOptions: string | null;
  /** Rules that removed a link from a listing we are still publishing. */
  stripped: BlockedSource[];
}

/**
 * Scraper farms hide behind hosts like
 * `api.www.communication.coding.light.exam.novel.bsfootball.org`. No employer
 * or ATS nests this deep, so such links are treated as tainted without a rule.
 */
const MAX_HOST_LABELS = 4;

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

function linkHost(link: unknown): string | null {
  if (typeof link !== 'string') return null;
  try {
    return new URL(link).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function isDeepHost(host: string): boolean {
  return host.split('.').length > MAX_HOST_LABELS;
}

function parseApplyOptions(applyOptionsJson: string | null): unknown[] {
  if (!applyOptionsJson) return [];
  try {
    const parsed = JSON.parse(applyOptionsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function screenSource(
  job: Pick<CrawledJob, 'via' | 'apply_options'>,
  rules: BlockedSource[],
): SourceScreening {
  const keep: SourceScreening = { blocked: null, applyOptions: job.apply_options, stripped: [] };
  if (rules.length === 0) return keep;

  const domainRules = rules
    .map((rule) => ({ rule, pattern: normalizeDomainPattern(rule.pattern) }))
    .filter((r) => r.rule.match_type === 'domain' && r.pattern);
  const via = normalizeViaPattern(job.via || '');
  const viaRule = via
    ? rules.find((rule) => rule.match_type === 'via' && normalizeViaPattern(rule.pattern) === via) || null
    : null;

  const options = parseApplyOptions(job.apply_options);
  const clean: unknown[] = [];
  const tainted: BlockedSource[] = [];
  for (const opt of options) {
    const host = linkHost((opt as { link?: unknown })?.link);
    if (host === null) {
      clean.push(opt);
      continue;
    }
    const hit = domainRules.find((r) => hostMatches(host, r.pattern));
    if (hit) {
      tainted.push(hit.rule);
    } else if (!isDeepHost(host)) {
      clean.push(opt);
    }
  }

  if (clean.length === 0 && (options.length > 0 || viaRule)) {
    // Nothing first-party survives. Credit the via rule first, since that is
    // what an admin would look up; a listing whose links are all deep hosts
    // trips no stored rule and is attributed to the heuristic instead.
    const blocked = viaRule || tainted[0] || DEEP_HOST_RULE;
    return { blocked, applyOptions: job.apply_options, stripped: [] };
  }

  if (clean.length === options.length) return keep;
  return {
    blocked: null,
    applyOptions: clean.length > 0 ? JSON.stringify(clean) : null,
    stripped: [...new Map(tainted.map((rule) => [rule.id, rule])).values()],
  };
}

/** Synthetic rule for the deep-subdomain heuristic; never stored, never counted. */
export const DEEP_HOST_RULE: BlockedSource = { id: 0, pattern: 'deep-subdomain', match_type: 'domain' };
