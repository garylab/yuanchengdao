import { Job } from '../types';
import { layout } from './layout';
import { timeAgo, formatSalary, escapeHtml, rewriteUtm, companyLogo } from '../utils/helpers';

function renderJobRow(job: Job, isNew: boolean = false, staticUrl: string = ''): string {
  const salary = formatSalary(job.salary_lower, job.salary_upper, job.salary_currency, job.salary_pay_cycle);
  const posted = timeAgo(job.posted_at || job.created_at);
  const logo = companyLogo(job.company_name, job.company_thumbnail);

  const locationLabel = [job.location_name_cn, job.country_name_cn]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ') || '远程';
  const flag = job.country_flag_emoji || '🌍';
  const locationLink = job.location_slug
    ? `<a href="/location/${escapeHtml(job.location_slug)}" class="text-xs text-surface-400 hover:text-brand-500 transition no-underline flex-shrink-0">${flag} ${escapeHtml(locationLabel)}</a>`
    : `<span class="text-xs text-surface-400 flex-shrink-0">${flag} ${escapeHtml(locationLabel)}</span>`;

  const highlights = job.job_highlights ? JSON.parse(job.job_highlights) as Array<{ title: string; items: string[] }> : [];
  const applyOptions = job.apply_options ? JSON.parse(job.apply_options) as Array<{ title: string; link: string }> : [];
  const primaryApply = applyOptions[0]?.link ? rewriteUtm(applyOptions[0].link) : null;

  return `
    <div class="job-row border-b border-surface-100" data-job-id="${job.id}">
      <div class="job-row-header flex items-center gap-4 px-4 py-4 cursor-pointer select-none">
        ${logo}

        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <a href="/job/${escapeHtml(job.slug)}" class="job-title font-semibold text-surface-900 text-sm sm:text-base hover:text-brand-500 transition no-underline">${escapeHtml(job.title)}</a>
            ${job.company_slug
              ? `<a href="/company/${escapeHtml(job.company_slug)}" class="text-sm text-surface-500 hover:text-brand-500 transition no-underline flex-shrink-0">${escapeHtml(job.company_name || '')}</a>`
              : `<span class="text-sm text-surface-500 flex-shrink-0">${escapeHtml(job.company_name || '')}</span>`
            }
            ${isNew ? `<img src="${staticUrl}/new2x.webp" alt="New" class="h-4 flex-shrink-0">` : ''}
          </div>
          <div class="flex flex-wrap items-center gap-2 mt-1.5">
            ${locationLink}
            ${salary ? `<span class="tag-pill bg-green-50 text-green-700 text-xs font-semibold">💰 ${salary}</span>` : ''}
            <span class="text-xs text-surface-400 flex-shrink-0 sm:hidden">${posted}</span>
          </div>
        </div>

        <div class="hidden sm:flex items-center gap-3 flex-shrink-0">
          <div class="text-xs text-surface-400 text-right">
            ${posted}
          </div>
        </div>
      </div>

      <div class="job-expand hidden px-4 pb-4">
        <div class="ml-16 border-t border-surface-100 pt-4">
          <div class="text-sm text-surface-600 leading-relaxed mb-4 whitespace-pre-line">${escapeHtml(job.description)}</div>

          ${highlights.length > 0 ? `
            <div class="mb-4 space-y-3">
              ${highlights.map(h => `
                <div>
                  <h4 class="text-xs font-semibold text-surface-500 uppercase mb-1">${escapeHtml(h.title)}</h4>
                  <ul class="list-disc list-inside text-sm text-surface-600 space-y-0.5">
                    ${h.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
                  </ul>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              ${primaryApply ? `
                <a href="${escapeHtml(primaryApply)}" target="_blank" rel="noopener noreferrer"
                  class="apply-btn inline-block bg-brand-500 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition no-underline"
                  data-from="home-list" data-job="${escapeHtml(job.title)}" data-company="${escapeHtml(job.company_name || '')}">
                  申请
                </a>
              ` : ''}
              <a href="/job/${escapeHtml(job.slug)}" class="text-sm text-brand-500 hover:text-brand-600 transition no-underline">
                详情
              </a>
            </div>
            <button class="job-collapse p-2 rounded-full hover:bg-surface-100 transition text-surface-400 hover:text-surface-600" title="收起">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

interface CountryFilter {
  id: number;
  code: string;
  name: string;
  name_cn: string;
  slug: string;
  job_count: number;
}

interface LocationFilter {
  id: number;
  name: string;
  name_cn: string;
  slug: string;
  country_id: number;
  job_count: number;
}

interface SearchTermPill {
  term_cn: string;
  slug: string;
  job_count: number;
}

interface LocationPill {
  name_cn: string;
  slug: string;
  job_count: number;
  country_flag_emoji?: string | null;
}

interface HomePageOptions {
  query?: string;
  countrySlug?: string;
  locationSlug?: string;
  salaryRange?: string;
  gaId?: string;
  siteUrl?: string;
  staticUrl?: string;
  topSearchTerms?: SearchTermPill[];
  topLocations?: LocationPill[];
}

const SALARY_OPTIONS = [
  { value: '', label: '全部' },
  { value: '0-0', label: '无薪资' },
  { value: '1-', label: '有薪资' },
  { value: '1-499', label: '1-499' },
  { value: '500-999', label: '500-1K' },
  { value: '1000-2999', label: '1K-3K' },
  { value: '3000-6999', label: '3K-7K' },
  { value: '7000-9999', label: '7K-1万' },
  { value: '10000-19999', label: '1万-2万' },
  { value: '20000-29999', label: '2万-3万' },
  { value: '30000-39999', label: '3万-4万' },
  { value: '40000-49999', label: '4万-5万' },
  { value: '50000-', label: '5万+' },
];

export function homePage(jobs: Job[], countries: CountryFilter[], locations: LocationFilter[], page: number, hasMore: boolean, opts: HomePageOptions = {}): string {
  const { query, countrySlug, locationSlug, salaryRange = '', gaId, siteUrl, staticUrl, topSearchTerms = [], topLocations = [] } = opts;
  const activeLocation = locationSlug ? locations.find(l => l.slug === locationSlug) : null;

  const locationOptions = locations.map(l =>
    `<li data-value="${escapeHtml(l.slug)}" data-label="${escapeHtml(l.name_cn)}" class="filter-option px-3 py-2 cursor-pointer hover:bg-brand-50 text-sm ${locationSlug === l.slug ? 'bg-brand-50 text-brand-600 font-medium' : 'text-surface-700'}">
      ${escapeHtml(l.name_cn)}
    </li>`
  ).join('');

  const activeSalary = SALARY_OPTIONS.find(s => s.value === salaryRange);

  const salaryOptions = SALARY_OPTIONS.map(s =>
    `<li data-value="${s.value}" data-label="${s.label}" class="filter-option px-3 py-2 cursor-pointer hover:bg-brand-50 text-sm ${salaryRange === s.value ? 'bg-brand-50 text-brand-600 font-medium' : 'text-surface-700'}">${s.label}</li>`
  ).join('');

  const hasFilters = locationSlug || salaryRange;
  const hasShortcuts = topLocations.length > 0 || topSearchTerms.length > 0;
  const filterBar = `
    <div class="px-4 py-3 flex flex-wrap items-center gap-2">
      <form action="/" method="GET" class="relative flex-1 min-w-[200px] max-w-md">
        <input type="text" name="q" value="${query ? escapeHtml(query) : ''}"
          placeholder="搜索职位..."
          class="w-full px-3 py-1.5 rounded-lg border border-surface-200 text-sm outline-none focus:ring-1 focus:ring-brand-300 focus:border-brand-300 placeholder:text-surface-400">
        <button type="submit" class="absolute right-1.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-brand-500 transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </button>
      </form>

      <div class="filter-dropdown relative" data-param="location">
        <button type="button" class="filter-btn flex items-center justify-between w-32 px-3 py-1.5 rounded-lg border text-sm transition ${locationSlug ? 'border-brand-300 bg-brand-50 text-brand-600' : 'border-surface-200 bg-white text-surface-600 hover:border-surface-300'}">
          <span class="filter-label">${activeLocation ? escapeHtml(activeLocation.name_cn) : '位置'}</span>
          <svg class="w-3.5 h-3.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </button>
        <div class="filter-panel hidden absolute top-full left-0 mt-1 bg-white border border-surface-200 rounded-lg shadow-lg z-50 w-72 max-h-72 overflow-hidden">
          <div class="p-2 border-b border-surface-100">
            <input type="text" class="filter-search w-full px-2 py-1.5 text-sm border border-surface-200 rounded outline-none focus:ring-1 focus:ring-brand-300" placeholder="搜索位置...">
          </div>
          <ul class="overflow-y-auto max-h-52">
            <li data-value="" data-label="位置" class="filter-option px-3 py-2 cursor-pointer hover:bg-brand-50 text-sm ${!locationSlug ? 'bg-brand-50 text-brand-600 font-medium' : 'text-surface-700'}">全部</li>
            ${locationOptions}
          </ul>
        </div>
      </div>

      <div class="filter-dropdown relative" data-param="salary">
        <button type="button" class="filter-btn flex items-center justify-between w-32 px-3 py-1.5 rounded-lg border text-sm transition ${salaryRange ? 'border-brand-300 bg-brand-50 text-brand-600' : 'border-surface-200 bg-white text-surface-600 hover:border-surface-300'}">
          <span class="filter-label">${activeSalary && salaryRange ? activeSalary.label : '薪资'}</span>
          <svg class="w-3.5 h-3.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </button>
        <div class="filter-panel hidden absolute top-full left-0 mt-1 bg-white border border-surface-200 rounded-lg shadow-lg z-50 w-56 max-h-72 overflow-hidden">
          <ul class="overflow-y-auto max-h-60">
            ${salaryOptions}
          </ul>
        </div>
      </div>

      ${hasFilters || query ? `<a href="/" class="text-xs text-surface-400 hover:text-brand-500 transition">清除</a>` : ''}
    </div>
    ${hasShortcuts ? `
    <div class="px-4 pt-1 pb-3 mt-1 flex items-center gap-x-3 gap-y-1 flex-wrap overflow-x-auto text-xs text-surface-400">
      ${topLocations.length > 0 ? '<span class="font-semibold text-surface-600">热门位置：</span>' : ''}
      ${topLocations.length > 0 ? topLocations.map(l =>
        `<a href="/location/${escapeHtml(l.slug)}" class="hover:text-brand-500 transition no-underline whitespace-nowrap">${l.country_flag_emoji || '🌍'} ${escapeHtml(l.name_cn)}</a>`
      ).join('') : ''}
      ${topLocations.length > 0 && topSearchTerms.length > 0 ? '<span class="text-surface-200 mx-2">|</span>' : ''}
      ${topSearchTerms.length > 0 ? '<span class="font-semibold text-surface-600">热门岗位：</span>' : ''}
      ${topSearchTerms.length > 0 ? topSearchTerms.map(t =>
        `<a href="/category/${escapeHtml(t.slug)}" class="hover:text-brand-500 transition no-underline whitespace-nowrap">${escapeHtml(t.term_cn)}</a>`
      ).join('') : ''}
    </div>
    ` : ''}`;

  const jobStats = query ? `
    <div class="px-4 py-3 border-b border-surface-200">
      <p class="text-sm text-surface-500">搜索 "${escapeHtml(query)}" 的结果</p>
    </div>` : '';

  const jobList = jobs.length > 0
    ? `<div class="max-w-5xl mx-auto mt-6">
        <div class="bg-white rounded-xl border border-surface-200 relative">${filterBar}</div>
        <div class="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden mt-3">
          ${jobStats}
          ${jobs.map((job, i) => renderJobRow(job, page === 1 && i < 3, staticUrl)).join('')}
        </div>
       </div>`
    : `<div class="max-w-5xl mx-auto mt-6">
        <div class="bg-white rounded-xl border border-surface-200 relative">${filterBar}</div>
        <div class="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden mt-3">
          ${jobStats}
          <div class="text-center py-20 text-surface-400">
            <p class="text-4xl mb-4">🔍</p>
            <p class="text-lg">暂无匹配的职位</p>
            <p class="text-sm mt-2">试试其他关键词或筛选条件</p>
          </div>
        </div>
       </div>`;

  const filterParts = [
    query ? `q=${encodeURIComponent(query)}` : '',
    countrySlug ? `country=${countrySlug}` : '',
    locationSlug ? `location=${locationSlug}` : '',
    salaryRange ? `salary=${encodeURIComponent(salaryRange)}` : '',
  ].filter(Boolean);
  const filterSuffix = filterParts.join('&');
  const paginationSuffix = filterSuffix ? '&' + filterSuffix : '';

  const pagination = (page > 1 || hasMore) ? `
    <div class="max-w-5xl mx-auto px-4 py-6 flex justify-center gap-2">
      ${page > 1 ? `<a href="/?page=${page - 1}${paginationSuffix}" class="px-4 py-2 rounded-lg bg-white border border-surface-200 text-sm hover:bg-surface-50 transition">← 上一页</a>` : ''}
      ${hasMore ? `<a href="/?page=${page + 1}${paginationSuffix}" class="px-4 py-2 rounded-lg bg-white border border-surface-200 text-sm hover:bg-surface-50 transition">下一页 →</a>` : ''}
    </div>` : '';

  const subParts: string[] = [];
  if (query) subParts.push(`${query} 相关远程工作`);
  if (activeLocation) subParts.push(`${activeLocation.name_cn}远程岗位`);
  if (activeSalary && salaryRange) subParts.push(`薪资${activeSalary.label}`);
  if (page > 1) subParts.push(`第${page}页`);
  const pageTitle = subParts.length > 0
    ? `${subParts.join(' - ')} - 远程岛`
    : '远程岛 - 华人全球远程工作机会平台';

  const pageDesc = query
    ? `"${query}"相关的远程工作机会。在远程岛轻松发现适合你的全球远程岗位。`
    : activeLocation
      ? `${activeLocation.name_cn}地区的远程工作机会，每天更新，在远程岛找到不限地点的理想工作。`
      : `每天更新的全球远程工作机会。远程岛帮你找到不限地点、自由办公的理想工作。`;

  const canonicalParams: string[] = [];
  if (countrySlug) canonicalParams.push(`country=${countrySlug}`);
  if (locationSlug) canonicalParams.push(`location=${locationSlug}`);
  if (salaryRange) canonicalParams.push(`salary=${encodeURIComponent(salaryRange)}`);
  if (query) canonicalParams.push(`q=${encodeURIComponent(query)}`);
  if (page > 1) canonicalParams.push(`page=${page}`);
  const canonicalPath = canonicalParams.length > 0 ? `/?${canonicalParams.join('&')}` : '/';
  const canonical = siteUrl ? `${siteUrl}${canonicalPath}` : undefined;

  const keywords = [
    '远程工作', '远程岗位', 'remote jobs',
    activeLocation?.name_cn,
    query,
  ].filter(Boolean).join(',');

  return layout(pageTitle, jobList + pagination, { gaId, description: pageDesc, canonical, keywords, staticUrl, activePath: '/' });
}
