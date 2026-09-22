import { AuthUser, Job } from '../types';
import { layout } from './layout';
import { timeAgo, jobDisplayTimestamp, formatSalary, escapeHtml, rewriteUtm, companyLogo, locationRequirementBadge, englishLevelBadge, scheduleTypeBadge, chineseFriendlyBadge } from '../utils/helpers';
import { SALARY_OPTIONS } from '../constants/salary';

function renderJobRow(job: Job, isNew: boolean = false, favorited = false, showFavorite = false): string {
  const salary = formatSalary(job.salary_lower, job.salary_upper, job.salary_currency, job.salary_pay_cycle);
  const posted = timeAgo(jobDisplayTimestamp(job));
  const logo = companyLogo(job.company_name, job.company_thumbnail);
  const scheduleBadge = scheduleTypeBadge(job.detected_extensions);

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
  const favoriteButton = showFavorite
    ? `<button type="button" class="favorite-btn inline-flex items-center gap-1 text-sm ${favorited ? 'text-brand-500' : 'text-surface-500 hover:text-brand-500'} transition" data-job-id="${job.id}" data-favorited="${favorited ? '1' : '0'}" aria-label="收藏">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="${favorited ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 17.3l-6.18 3.25 1.18-6.88L2 8.97l6.91-1L12 1.5l3.09 6.47 6.91 1-5 4.7 1.18 6.88z"/></svg>
        <span>${favorited ? '已收藏' : '收藏'}</span>
      </button>`
    : '';

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
            ${isNew ? `<img src="/new2x.webp" alt="New" class="h-4 flex-shrink-0">` : ''}
          </div>
          <div class="flex flex-wrap items-center gap-2 mt-1.5">
            ${locationLink}
            ${scheduleBadge}
            ${salary ? `<span class="tag-pill bg-green-50 text-green-700 text-xs">💰 ${salary}</span>` : ''}
            ${locationRequirementBadge(job.location_requirement)}
            ${englishLevelBadge(job.english_level_required)}
            ${chineseFriendlyBadge(job.chinese_friendly)}
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
                  class="apply-btn inline-block bg-brand-500 text-white px-6 py-2 rounded text-sm font-medium hover:bg-brand-600 transition no-underline"
                  data-from="home-list" data-job="${escapeHtml(job.title)}" data-company="${escapeHtml(job.company_name || '')}">
                  申请
                </a>
              ` : ''}
              ${favoriteButton}
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
  chineseOnly?: boolean;
  gaId?: string;
  siteUrl?: string;
  staticUrl?: string;
  topSearchTerms?: SearchTermPill[];
  topLocations?: LocationPill[];
  feishuGroupLink?: string;
  telegramChannelUrl?: string;
  user?: AuthUser | null;
  favoritedJobIds?: Set<number>;
  newCompanies?: Array<{ name: string; slug: string; job_count: number }>;
  topSalaryJobs?: Array<{ slug: string; title: string; company_name: string | null; salary_label: string }>;
  recommended?: Array<{ slug: string; title: string; company_name: string | null; location_label: string }>;
  chineseFriendlyCount?: number;
  noEnglishCount?: number;
}

export function homePage(jobs: Job[], countries: CountryFilter[], locations: LocationFilter[], page: number, hasMore: boolean, opts: HomePageOptions = {}): string {
  const { query, countrySlug, locationSlug, salaryRange = '', chineseOnly = false, gaId, siteUrl, staticUrl, topSearchTerms = [], topLocations = [], feishuGroupLink, telegramChannelUrl, user, favoritedJobIds, newCompanies = [], topSalaryJobs = [], recommended = [], chineseFriendlyCount = 0, noEnglishCount = 0 } = opts;
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

  const hasFilters = !!(locationSlug || salaryRange || chineseOnly);
  const hasShortcuts = topLocations.length > 0 || topSearchTerms.length > 0;
  const filterBar = `
    <div class="px-4 py-3 flex flex-wrap items-center gap-2">
      <form action="/" method="GET" class="relative flex-1 min-w-[200px] max-w-md">
        <input type="text" name="q" value="${query ? escapeHtml(query) : ''}"
          placeholder="搜索职位..."
          class="w-full px-3 py-1.5 rounded border border-surface-200 text-sm outline-none focus:ring-1 focus:ring-brand-300 focus:border-brand-300 placeholder:text-surface-400">
        <button type="submit" class="absolute right-1.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-brand-500 transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </button>
      </form>

      <div class="filter-dropdown relative" data-param="location">
        <button type="button" class="filter-btn flex items-center justify-between w-32 px-3 py-1.5 rounded border text-sm transition ${locationSlug ? 'border-brand-300 bg-brand-50 text-brand-600' : 'border-surface-200 bg-white text-surface-600 hover:border-surface-300'}">
          <span class="filter-label">${activeLocation ? escapeHtml(activeLocation.name_cn) : '位置'}</span>
          <svg class="w-3.5 h-3.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </button>
        <div class="filter-panel hidden absolute top-full left-0 mt-1 bg-white border border-surface-200 rounded shadow-lg z-50 w-72 max-h-72 overflow-hidden">
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
        <button type="button" class="filter-btn flex items-center justify-between w-32 px-3 py-1.5 rounded border text-sm transition ${salaryRange ? 'border-brand-300 bg-brand-50 text-brand-600' : 'border-surface-200 bg-white text-surface-600 hover:border-surface-300'}">
          <span class="filter-label">${activeSalary && salaryRange ? activeSalary.label : '薪资'}</span>
          <svg class="w-3.5 h-3.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </button>
        <div class="filter-panel hidden absolute top-full left-0 mt-1 bg-white border border-surface-200 rounded shadow-lg z-50 w-56 max-h-72 overflow-hidden">
          <ul class="overflow-y-auto max-h-60">
            ${salaryOptions}
          </ul>
        </div>
      </div>

      ${chineseOnly ? `<span class="tag-pill bg-rose-50 text-rose-700 text-xs">🇨🇳 华人友好</span>` : ''}
      ${hasFilters || query ? `<a href="/" class="text-xs text-surface-400 hover:text-brand-500 transition">清除</a>` : ''}
      ${(() => {
        const params = new URLSearchParams();
        if (query) { params.set('kind', 'keyword'); params.set('q', query); }
        if (locationSlug) params.set('location', locationSlug);
        if (salaryRange) params.set('salary', salaryRange);
        const href = `/account${params.toString() ? `?${params.toString()}` : ''}`;
        const label = query ? '订阅此搜索' : (hasFilters ? '订阅此筛选' : '订阅新职位');
        return `<a href="${href}" class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-brand-200 bg-brand-50 text-brand-600 text-xs font-medium hover:bg-brand-100 transition no-underline whitespace-nowrap" title="${user ? '把当前条件保存为订阅' : '登录后可订阅新职位提醒'}">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>${label}
        </a>`;
      })()}

      <div class="flex items-center gap-4 ml-auto text-xs">
        ${feishuGroupLink ? `
        <div class="qr-hover-wrap relative inline-flex">
          <a href="${escapeHtml(feishuGroupLink)}" target="_blank" class="inline-flex items-center gap-0.5 no-underline text-brand-500 hover:text-brand-600 font-medium transition"><img src="/feishu.svg" alt="" class="w-3.5 h-3.5">飞书群</a>
          <div class="qr-hover-popover hidden absolute right-0 top-full mt-2 bg-white border border-surface-200 rounded-lg shadow-xl z-50 p-3" style="width:200px;height:228px" data-qr-src="/qr-code-feishu-yuanchengdao.png">
            <p class="text-xs text-surface-400 text-center mt-1">扫码加入飞书群</p>
          </div>
        </div>
        ` : ''}
        ${telegramChannelUrl ? `
        <div class="qr-hover-wrap relative inline-flex">
          <a href="${escapeHtml(telegramChannelUrl)}" target="_blank" class="inline-flex items-center gap-1 no-underline text-surface-400 hover:text-brand-500 transition"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="#26A5E4"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.12.12 0 00-.07-.2c-.08-.06-.2-.04-.28-.02-.12.03-2.07 1.32-5.84 3.87-.55.38-1.05.56-1.5.55-.49-.01-1.44-.28-2.15-.51-.87-.28-1.56-.43-1.5-.92.03-.25.38-.51 1.05-.78 4.12-1.79 6.87-2.97 8.26-3.54 3.93-1.64 4.75-1.92 5.28-1.93.12 0 .37.03.54.18.14.12.18.28.2.46 0 .06.01.24 0 .37z"/></svg>TG频道</a>
          <div class="qr-hover-popover hidden absolute right-0 top-full mt-2 bg-white border border-surface-200 rounded-lg shadow-xl z-50 p-3" style="width:200px;height:228px" data-qr-src="/qr-code-telegram-yuanchengdao.png">
            <p class="text-xs text-surface-400 text-center mt-1">扫码加入TG频道</p>
          </div>
        </div>
        ` : ''}
      </div>
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

  const showDiscovery = page === 1 && !query && !hasFilters;
  const quickEntries = showDiscovery ? `
    <div class="max-w-5xl mx-auto mt-3 flex flex-wrap gap-2 text-xs">
      <a href="/english/none" class="px-3 py-1.5 rounded-full bg-white border border-surface-200 text-surface-700 hover:border-brand-300 hover:text-brand-600 transition no-underline">🗣️ 不需要英语 <span class="text-surface-400">${noEnglishCount}</span></a>
      <a href="/?chinese=1" class="px-3 py-1.5 rounded-full bg-white border border-surface-200 text-surface-700 hover:border-brand-300 hover:text-brand-600 transition no-underline">🇨🇳 华人友好 <span class="text-surface-400">${chineseFriendlyCount}</span></a>
      <a href="/salary" class="px-3 py-1.5 rounded-full bg-white border border-surface-200 text-surface-700 hover:border-brand-300 hover:text-brand-600 transition no-underline">💰 薪资报告</a>
      <a href="/weekly" class="px-3 py-1.5 rounded-full bg-white border border-surface-200 text-surface-700 hover:border-brand-300 hover:text-brand-600 transition no-underline">📰 本周周报</a>
    </div>` : '';
  const discoveryCols: string[] = [];
  if (showDiscovery && recommended.length > 0) {
    discoveryCols.push(`
      <div class="bg-white rounded border border-surface-200 p-4">
        <div class="flex items-center justify-between mb-2"><h3 class="text-sm font-bold text-surface-900">为你推荐</h3><a href="/favorites" class="text-xs text-surface-400 hover:text-brand-500 no-underline">基于收藏</a></div>
        <ul class="space-y-2">${recommended.slice(0, 5).map((j) => `<li class="min-w-0"><a href="/job/${escapeHtml(j.slug)}" class="text-sm text-surface-800 hover:text-brand-600 no-underline line-clamp-1">${escapeHtml(j.title)}</a><div class="text-xs text-surface-400 truncate">${escapeHtml(j.company_name || '')} · ${escapeHtml(j.location_label)}</div></li>`).join('')}</ul>
      </div>`);
  }
  if (showDiscovery && topSalaryJobs.length > 0) {
    discoveryCols.push(`
      <div class="bg-white rounded border border-surface-200 p-4">
        <div class="flex items-center justify-between mb-2"><h3 class="text-sm font-bold text-surface-900">本周高薪</h3><a href="/salary" class="text-xs text-surface-400 hover:text-brand-500 no-underline">薪资报告 →</a></div>
        <ul class="space-y-2">${topSalaryJobs.slice(0, 5).map((j) => `<li class="min-w-0"><a href="/job/${escapeHtml(j.slug)}" class="text-sm text-surface-800 hover:text-brand-600 no-underline line-clamp-1">${escapeHtml(j.title)}</a><div class="text-xs text-surface-400 truncate">${escapeHtml(j.company_name || '')} · <span class="text-green-700">${escapeHtml(j.salary_label)}</span></div></li>`).join('')}</ul>
      </div>`);
  }
  if (showDiscovery && newCompanies.length > 0) {
    discoveryCols.push(`
      <div class="bg-white rounded border border-surface-200 p-4">
        <div class="flex items-center justify-between mb-2"><h3 class="text-sm font-bold text-surface-900">本周新雇主</h3><a href="/companies" class="text-xs text-surface-400 hover:text-brand-500 no-underline">全部企业 →</a></div>
        <div class="flex flex-wrap gap-1.5">${newCompanies.slice(0, 12).map((c) => `<a href="/company/${escapeHtml(c.slug)}" class="px-2 py-1 rounded bg-surface-50 border border-surface-200 text-xs text-surface-700 hover:border-brand-300 hover:text-brand-600 transition no-underline">${escapeHtml(c.name)} <span class="text-surface-400">${c.job_count}</span></a>`).join('')}</div>
      </div>`);
  }
  const discoveryStrip = discoveryCols.length > 0
    ? `<div class="max-w-5xl mx-auto mt-3 grid grid-cols-1 md:grid-cols-${Math.min(discoveryCols.length, 3)} gap-3">${discoveryCols.join('')}</div>`
    : '';

  const jobStats = query ? `
    <div class="px-4 py-3 border-b border-surface-200">
      <p class="text-sm text-surface-500">搜索 "${escapeHtml(query)}" 的结果</p>
    </div>` : '';

  const jobList = jobs.length > 0
    ? `<div class="max-w-5xl mx-auto mt-6">
        <div class="bg-white rounded border border-surface-200 relative">${filterBar}</div>
        ${quickEntries}
        ${discoveryStrip}
        <div class="bg-white rounded shadow-sm border border-surface-200 overflow-hidden mt-3">
          ${jobStats}
          ${jobs.map((job, i) => renderJobRow(job, page === 1 && i < 3, favoritedJobIds?.has(job.id) ?? false, !!user)).join('')}
        </div>
       </div>`
    : `<div class="max-w-5xl mx-auto mt-6">
        <div class="bg-white rounded border border-surface-200 relative">${filterBar}</div>
        <div class="bg-white rounded shadow-sm border border-surface-200 overflow-hidden mt-3">
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
    chineseOnly ? 'chinese=1' : '',
  ].filter(Boolean);
  const filterSuffix = filterParts.join('&');
  const paginationSuffix = filterSuffix ? '&' + filterSuffix : '';

  const pagination = (page > 1 || hasMore) ? `
    <div class="max-w-5xl mx-auto px-4 py-6 flex justify-center gap-2">
      ${page > 1 ? `<a href="/?page=${page - 1}${paginationSuffix}" class="px-4 py-2 rounded bg-white border border-surface-200 text-sm hover:bg-surface-50 transition">← 上一页</a>` : ''}
      ${hasMore ? `<a href="/?page=${page + 1}${paginationSuffix}" class="px-4 py-2 rounded bg-white border border-surface-200 text-sm hover:bg-surface-50 transition">下一页 →</a>` : ''}
    </div>` : '';

  const subParts: string[] = [];
  if (query) subParts.push(`${query} 相关远程工作`);
  if (activeLocation) subParts.push(`${activeLocation.name_cn}远程岗位`);
  if (activeSalary && salaryRange) subParts.push(`薪资${activeSalary.label}`);
  if (chineseOnly) subParts.push('华人友好远程工作');
  if (page > 1) subParts.push(`第${page}页`);
  const pageTitle = subParts.length > 0
    ? `${subParts.join(' - ')} - 远程岛`
    : '远程岛 - 海外远程工作机会招聘平台';

  const pageDesc = query
    ? `"${query}"相关的远程工作机会。在远程岛轻松发现适合你的全球远程岗位。`
    : activeLocation
      ? `${activeLocation.name_cn}地区的远程工作机会，每天更新，在远程岛找到不限地点的理想工作。`
      : `每天更新的全球远程工作机会。远程岛帮你找到不限地点、自由办公的理想工作。`;

  const canonicalParams: string[] = [];
  if (countrySlug) canonicalParams.push(`country=${countrySlug}`);
  if (locationSlug) canonicalParams.push(`location=${locationSlug}`);
  if (salaryRange) canonicalParams.push(`salary=${encodeURIComponent(salaryRange)}`);
  if (chineseOnly) canonicalParams.push('chinese=1');
  if (query) canonicalParams.push(`q=${encodeURIComponent(query)}`);
  if (page > 1) canonicalParams.push(`page=${page}`);
  const canonicalPath = canonicalParams.length > 0 ? `/?${canonicalParams.join('&')}` : '/';
  const canonical = siteUrl ? `${siteUrl}${canonicalPath}` : undefined;

  const keywords = [
    '远程工作', '远程岗位', 'remote jobs',
    activeLocation?.name_cn,
    query,
  ].filter(Boolean).join(',');

  return layout(pageTitle, jobList + pagination, { gaId, description: pageDesc, canonical, keywords, staticUrl, activePath: '/', user });
}
