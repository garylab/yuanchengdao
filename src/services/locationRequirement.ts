/**
 * Deterministic applicant-eligibility extraction from the ORIGINAL (English)
 * job description.
 *
 * Two feeds state eligibility in a fixed template, and the LLM pass misses them
 * almost every time (measured: 233 of 239 template jobs were stored as
 * "anywhere"). Those two families are parsed here instead; everything else is
 * left to the model, because the free-form long tail is full of sentences that
 * look like requirements but are not ("Based in San Francisco, Turing is ...").
 */

export const LOCATION_REQ = {
  ANYWHERE: 0,
  COUNTRY: 1,
  REGION: 2,
  TIMEZONE: 3,
  AUTHORIZED: 4,
  /** The posting says nothing about eligibility. Renders no badge, but must not
   *  be stored as ANYWHERE — conflating the two is what made 94% of jobs claim
   *  to be open worldwide. */
  UNKNOWN: 5,
} as const;

export interface LocationRequirementMatch {
  requirement: number;
  /** Chinese label for the badge, e.g. 美国 / 欧盟 / 亚太. */
  label: string;
}

interface RegionEntry {
  cn: string;
  /** Breadth; the broadest entry in a list is the one that decides eligibility. */
  rank: number;
  kind: 'region' | 'country' | 'subdivision';
}

const ANYWHERE_TOKENS = new Set(['anywhere', 'worldwide', 'global', 'remote']);

const REGIONS: Record<string, RegionEntry> = {
  // Supranational
  'emea': { cn: 'EMEA', rank: 90, kind: 'region' },
  'apac': { cn: '亚太', rank: 90, kind: 'region' },
  'europe': { cn: '欧洲', rank: 80, kind: 'region' },
  'asia': { cn: '亚洲', rank: 80, kind: 'region' },
  'africa': { cn: '非洲', rank: 80, kind: 'region' },
  'oceania': { cn: '大洋洲', rank: 80, kind: 'region' },
  'north america': { cn: '北美', rank: 80, kind: 'region' },
  'south america': { cn: '南美', rank: 80, kind: 'region' },
  'latin america': { cn: '拉美', rank: 80, kind: 'region' },
  'european union': { cn: '欧盟', rank: 70, kind: 'region' },
  'eu': { cn: '欧盟', rank: 70, kind: 'region' },
  'central america': { cn: '中美洲', rank: 60, kind: 'region' },
  'east asia': { cn: '东亚', rank: 60, kind: 'region' },
  'south asia': { cn: '南亚', rank: 60, kind: 'region' },
  'southeast asia': { cn: '东南亚', rank: 60, kind: 'region' },
  'middle east': { cn: '中东', rank: 60, kind: 'region' },

  // Countries
  'united states': { cn: '美国', rank: 10, kind: 'country' },
  'usa': { cn: '美国', rank: 10, kind: 'country' },
  'us': { cn: '美国', rank: 10, kind: 'country' },
  'united kingdom': { cn: '英国', rank: 10, kind: 'country' },
  'uk': { cn: '英国', rank: 10, kind: 'country' },
  'canada': { cn: '加拿大', rank: 10, kind: 'country' },
  'germany': { cn: '德国', rank: 10, kind: 'country' },
  'france': { cn: '法国', rank: 10, kind: 'country' },
  'spain': { cn: '西班牙', rank: 10, kind: 'country' },
  'portugal': { cn: '葡萄牙', rank: 10, kind: 'country' },
  'ireland': { cn: '爱尔兰', rank: 10, kind: 'country' },
  'netherlands': { cn: '荷兰', rank: 10, kind: 'country' },
  'belgium': { cn: '比利时', rank: 10, kind: 'country' },
  'poland': { cn: '波兰', rank: 10, kind: 'country' },
  'austria': { cn: '奥地利', rank: 10, kind: 'country' },
  'switzerland': { cn: '瑞士', rank: 10, kind: 'country' },
  'norway': { cn: '挪威', rank: 10, kind: 'country' },
  'sweden': { cn: '瑞典', rank: 10, kind: 'country' },
  'denmark': { cn: '丹麦', rank: 10, kind: 'country' },
  'finland': { cn: '芬兰', rank: 10, kind: 'country' },
  'italy': { cn: '意大利', rank: 10, kind: 'country' },
  'greece': { cn: '希腊', rank: 10, kind: 'country' },
  'andorra': { cn: '安道尔', rank: 10, kind: 'country' },
  'slovenia': { cn: '斯洛文尼亚', rank: 10, kind: 'country' },
  'ukraine': { cn: '乌克兰', rank: 10, kind: 'country' },
  'bulgaria': { cn: '保加利亚', rank: 10, kind: 'country' },
  'romania': { cn: '罗马尼亚', rank: 10, kind: 'country' },
  'czechia': { cn: '捷克', rank: 10, kind: 'country' },
  'czech republic': { cn: '捷克', rank: 10, kind: 'country' },
  'hungary': { cn: '匈牙利', rank: 10, kind: 'country' },
  'turkey': { cn: '土耳其', rank: 10, kind: 'country' },
  'israel': { cn: '以色列', rank: 10, kind: 'country' },
  'india': { cn: '印度', rank: 10, kind: 'country' },
  'china': { cn: '中国', rank: 10, kind: 'country' },
  'hong kong': { cn: '香港', rank: 10, kind: 'country' },
  'taiwan': { cn: '台湾', rank: 10, kind: 'country' },
  'japan': { cn: '日本', rank: 10, kind: 'country' },
  'south korea': { cn: '韩国', rank: 10, kind: 'country' },
  'singapore': { cn: '新加坡', rank: 10, kind: 'country' },
  'malaysia': { cn: '马来西亚', rank: 10, kind: 'country' },
  'vietnam': { cn: '越南', rank: 10, kind: 'country' },
  'thailand': { cn: '泰国', rank: 10, kind: 'country' },
  'philippines': { cn: '菲律宾', rank: 10, kind: 'country' },
  'indonesia': { cn: '印度尼西亚', rank: 10, kind: 'country' },
  'australia': { cn: '澳大利亚', rank: 10, kind: 'country' },
  'new zealand': { cn: '新西兰', rank: 10, kind: 'country' },
  'mexico': { cn: '墨西哥', rank: 10, kind: 'country' },
  'brazil': { cn: '巴西', rank: 10, kind: 'country' },
  'argentina': { cn: '阿根廷', rank: 10, kind: 'country' },
  'colombia': { cn: '哥伦比亚', rank: 10, kind: 'country' },
  'chile': { cn: '智利', rank: 10, kind: 'country' },
  'peru': { cn: '秘鲁', rank: 10, kind: 'country' },
  'south africa': { cn: '南非', rank: 10, kind: 'country' },
  'nigeria': { cn: '尼日利亚', rank: 10, kind: 'country' },
  'egypt': { cn: '埃及', rank: 10, kind: 'country' },
  'united arab emirates': { cn: '阿联酋', rank: 10, kind: 'country' },
};

/** "Delaware (USA)", "New York (USA)" — a single state, not the whole country. */
const US_STATE = /^[a-z .'-]+\(usa\)$/i;

function lookup(raw: string): RegionEntry | null {
  const token = raw.trim().replace(/\.$/, '');
  if (!token) return null;
  // "the United States" / "The EU" -> "united states" / "eu"
  const key = token.toLowerCase().replace(/^the\s+/, '');
  if (ANYWHERE_TOKENS.has(key)) return { cn: '', rank: 1000, kind: 'region' };
  if (REGIONS[key]) return REGIONS[key];
  if (US_STATE.test(token)) return { cn: '美国部分州', rank: 5, kind: 'subdivision' };
  return null;
}

function fromTokens(tokens: string[]): LocationRequirementMatch | null {
  const entries = tokens.map(lookup).filter((e): e is RegionEntry => e !== null);
  if (entries.length === 0) return null;

  // The broadest entry defines who is eligible: "EMEA, Europe, Germany" means
  // anyone in EMEA qualifies, not only Germans.
  const topRank = Math.max(...entries.map((e) => e.rank));
  if (topRank === 1000) return null; // explicitly open worldwide

  const broadest = entries.filter((e) => e.rank === topRank);
  const names = [...new Set(broadest.map((e) => e.cn))];
  // Several places at the same breadth ("United States, Poland, Vietnam") are
  // all acceptable origins — naming only the first would exclude the others.
  const label = names.length === 1 ? names[0] : `${names[0]}等${names.length}地`;

  return {
    requirement: broadest[0].kind === 'region' ? LOCATION_REQ.REGION : LOCATION_REQ.COUNTRY,
    label,
  };
}

/**
 * Combines a rule match with the model's answer. The rule decides WHERE, but an
 * explicit work-authorization finding is more specific than a plain country
 * restriction, so it survives and just gains a label ("需美国工作许可").
 */
export function mergeLocationRequirement(
  ruled: LocationRequirementMatch | null,
  modelRequirement: number,
  modelLabel: string | null | undefined,
): { requirement: number; label: string } {
  if (!ruled) return { requirement: modelRequirement, label: (modelLabel || '').trim() };
  if (modelRequirement === LOCATION_REQ.AUTHORIZED) {
    return { requirement: LOCATION_REQ.AUTHORIZED, label: ruled.label };
  }
  return { requirement: ruled.requirement, label: ruled.label };
}

/** "USA and Canada", "Europe, the UK or Ireland" -> individual tokens. */
function splitList(raw: string): string[] {
  return raw.split(/,|;|\s+and\s+|\s+or\s+|\//i);
}

// "Note: The job is a remote job and is open to candidates in USA."
const OPEN_TO_CANDIDATES = /open to candidates in\s+([^.\n]{1,60})/i;
// "This a Full Remote job, the offer is available from: EMEA, Europe, Germany"
const AVAILABLE_FROM = /the offer is available from:\s*([^.\n]{1,200})/i;

/**
 * Returns a match only for the two templated feeds; `null` means "no opinion",
 * and the caller should fall back to the model's answer.
 */
export function detectLocationRequirement(description: string | null | undefined): LocationRequirementMatch | null {
  if (!description) return null;

  const openTo = description.match(OPEN_TO_CANDIDATES);
  if (openTo) {
    const match = fromTokens(splitList(openTo[1]));
    if (match) return match;
  }

  const availableFrom = description.match(AVAILABLE_FROM);
  if (availableFrom) {
    const match = fromTokens(splitList(availableFrom[1]));
    if (match) return match;
  }

  return null;
}

/**
 * Reverse of the REGIONS table above: the Chinese label stored in
 * jobs.location_requirement_label, mapped to something schema.org can express.
 *
 * Countries carry an ISO 3166-1 alpha-2 code, which is what Google for Jobs
 * matches a searcher's location against. Supranational regions have no code and
 * degrade to a named AdministrativeArea — less precise, but honest, which a
 * single hardcoded country was not.
 */
const APPLICANT_AREA_BY_CN: Record<string, { type: 'Country' | 'AdministrativeArea'; name: string }> = {
  // Supranational
  'EMEA': { type: 'AdministrativeArea', name: 'EMEA' },
  '亚太': { type: 'AdministrativeArea', name: 'Asia-Pacific' },
  '欧洲': { type: 'AdministrativeArea', name: 'Europe' },
  '亚洲': { type: 'AdministrativeArea', name: 'Asia' },
  '非洲': { type: 'AdministrativeArea', name: 'Africa' },
  '大洋洲': { type: 'AdministrativeArea', name: 'Oceania' },
  '北美': { type: 'AdministrativeArea', name: 'North America' },
  '南美': { type: 'AdministrativeArea', name: 'South America' },
  '拉美': { type: 'AdministrativeArea', name: 'Latin America' },
  '欧盟': { type: 'AdministrativeArea', name: 'European Union' },
  '中美洲': { type: 'AdministrativeArea', name: 'Central America' },
  '东亚': { type: 'AdministrativeArea', name: 'East Asia' },
  '南亚': { type: 'AdministrativeArea', name: 'South Asia' },
  '东南亚': { type: 'AdministrativeArea', name: 'Southeast Asia' },
  '中东': { type: 'AdministrativeArea', name: 'Middle East' },

  // Countries
  '美国': { type: 'Country', name: 'US' },
  // Narrower than the whole country, but the country is the closest thing
  // schema.org can match on; the page itself names the states.
  '美国部分州': { type: 'Country', name: 'US' },
  '英国': { type: 'Country', name: 'GB' },
  '加拿大': { type: 'Country', name: 'CA' },
  '德国': { type: 'Country', name: 'DE' },
  '法国': { type: 'Country', name: 'FR' },
  '西班牙': { type: 'Country', name: 'ES' },
  '葡萄牙': { type: 'Country', name: 'PT' },
  '爱尔兰': { type: 'Country', name: 'IE' },
  '荷兰': { type: 'Country', name: 'NL' },
  '比利时': { type: 'Country', name: 'BE' },
  '波兰': { type: 'Country', name: 'PL' },
  '奥地利': { type: 'Country', name: 'AT' },
  '瑞士': { type: 'Country', name: 'CH' },
  '挪威': { type: 'Country', name: 'NO' },
  '瑞典': { type: 'Country', name: 'SE' },
  '丹麦': { type: 'Country', name: 'DK' },
  '芬兰': { type: 'Country', name: 'FI' },
  '意大利': { type: 'Country', name: 'IT' },
  '希腊': { type: 'Country', name: 'GR' },
  '安道尔': { type: 'Country', name: 'AD' },
  '斯洛文尼亚': { type: 'Country', name: 'SI' },
  '乌克兰': { type: 'Country', name: 'UA' },
  '保加利亚': { type: 'Country', name: 'BG' },
  '罗马尼亚': { type: 'Country', name: 'RO' },
  '捷克': { type: 'Country', name: 'CZ' },
  '匈牙利': { type: 'Country', name: 'HU' },
  '土耳其': { type: 'Country', name: 'TR' },
  '以色列': { type: 'Country', name: 'IL' },
  '印度': { type: 'Country', name: 'IN' },
  '中国': { type: 'Country', name: 'CN' },
  '香港': { type: 'Country', name: 'HK' },
  '台湾': { type: 'Country', name: 'TW' },
  '日本': { type: 'Country', name: 'JP' },
  '韩国': { type: 'Country', name: 'KR' },
  '新加坡': { type: 'Country', name: 'SG' },
  '马来西亚': { type: 'Country', name: 'MY' },
  '越南': { type: 'Country', name: 'VN' },
  '泰国': { type: 'Country', name: 'TH' },
  '菲律宾': { type: 'Country', name: 'PH' },
  '印度尼西亚': { type: 'Country', name: 'ID' },
  '澳大利亚': { type: 'Country', name: 'AU' },
  '新西兰': { type: 'Country', name: 'NZ' },
  '墨西哥': { type: 'Country', name: 'MX' },
  '巴西': { type: 'Country', name: 'BR' },
  '阿根廷': { type: 'Country', name: 'AR' },
  '哥伦比亚': { type: 'Country', name: 'CO' },
  '智利': { type: 'Country', name: 'CL' },
  '秘鲁': { type: 'Country', name: 'PE' },
  '南非': { type: 'Country', name: 'ZA' },
  '尼日利亚': { type: 'Country', name: 'NG' },
  '埃及': { type: 'Country', name: 'EG' },
  '阿联酋': { type: 'Country', name: 'AE' },
};

/**
 * schema.org applicantLocationRequirements for a stored (requirement, label)
 * pair, or null when we must not make a claim.
 *
 * Null is the right answer more often than it looks:
 *   ANYWHERE  - no restriction to state; Google reads an absent property as
 *               "unspecified", which is exactly the truth.
 *   UNKNOWN   - the posting never said. Not the same as ANYWHERE.
 *   TIMEZONE  - "must overlap UTC+8" is not a geography schema.org can express.
 *   anything whose label we cannot resolve to a real place.
 */
export function applicantLocationRequirement(
  requirement: number | null | undefined,
  label: string | null | undefined,
): { '@type': string; name: string } | null {
  if (requirement !== LOCATION_REQ.COUNTRY && requirement !== LOCATION_REQ.REGION && requirement !== LOCATION_REQ.AUTHORIZED) {
    return null;
  }
  const area = APPLICANT_AREA_BY_CN[(label || '').trim()];
  if (!area) return null;
  return { '@type': area.type, name: area.name };
}
