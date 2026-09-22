import { AuthUser, Job } from '../types';
import { layout } from './layout';
import { renderJobRow } from './jobRow';
import { breadcrumb, escapeHtml } from '../utils/helpers';

export type CountryPageInfo = {
  id: number;
  code: string;
  name: string;
  name_cn: string;
  slug: string;
  flag_emoji: string | null;
  job_count: number;
};

export function countryPage(
  country: CountryPageInfo,
  jobs: Job[],
  page: number,
  hasMore: boolean,
  topLocations: Array<{ name_cn: string; slug: string; job_count: number }>,
  otherCountries: Array<{ name_cn: string; slug: string; flag_emoji: string | null; job_count: number }>,
  opts: { gaId?: string; siteUrl?: string; staticUrl?: string; user?: AuthUser | null },
): string {
  const flag = country.flag_emoji || '🌍';
  const bc = breadcrumb([
    { label: '首页', href: '/' },
    { label: '地区', href: '/locations' },
    { label: country.name_cn, href: `/country/${country.slug}` },
  ]);

  const pagination = (page > 1 || hasMore) ? `
    <div class="flex justify-center gap-2 mt-6">
      ${page > 1 ? `<a href="/country/${country.slug}?page=${page - 1}" class="px-4 py-2 rounded bg-white border border-surface-200 text-sm hover:bg-surface-50 transition no-underline text-surface-600">← 上一页</a>` : ''}
      ${hasMore ? `<a href="/country/${country.slug}?page=${page + 1}" class="px-4 py-2 rounded bg-white border border-surface-200 text-sm hover:bg-surface-50 transition no-underline text-surface-600">下一页 →</a>` : ''}
    </div>` : '';

  const locationChips = topLocations.length > 0 ? `
    <div class="flex flex-wrap items-center gap-2 text-xs text-surface-500 mb-4">
      <span class="font-semibold text-surface-600">热门城市：</span>
      ${topLocations.map((l) => `<a href="/location/${escapeHtml(l.slug)}" class="px-2 py-1 rounded bg-white border border-surface-200 hover:border-brand-300 hover:text-brand-600 transition no-underline">${escapeHtml(l.name_cn)} <span class="text-surface-400">${l.job_count}</span></a>`).join('')}
    </div>` : '';

  const otherChips = otherCountries.length > 0 ? `
    <div class="mt-8">
      <h2 class="text-sm font-semibold text-surface-600 mb-2">其他国家 / 地区</h2>
      <div class="flex flex-wrap gap-2 text-sm">
        ${otherCountries.map((c) => `<a href="/country/${escapeHtml(c.slug)}" class="px-3 py-1.5 rounded bg-white border border-surface-200 hover:border-brand-300 hover:text-brand-600 transition no-underline text-surface-700">${c.flag_emoji || '🌍'} ${escapeHtml(c.name_cn)} <span class="text-surface-400 text-xs">${c.job_count}</span></a>`).join('')}
      </div>
    </div>` : '';

  const content = `
    ${bc}
    <div class="max-w-5xl mx-auto px-4 mt-4">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h1 class="text-xl font-bold text-surface-900">${flag} ${escapeHtml(country.name_cn)}远程工作</h1>
        <span class="text-sm text-surface-500">在招 ${country.job_count} 个</span>
      </div>
      <p class="text-sm text-surface-500 mb-4">面向 ${escapeHtml(country.name_cn)}（${escapeHtml(country.name)}）的远程岗位，含限本国居民与全球开放的职位。</p>
      ${locationChips}
      <div class="bg-white rounded shadow-sm border border-surface-200 overflow-hidden">
        ${jobs.length > 0
          ? jobs.map((j) => renderJobRow(j, { dataFrom: `country-${country.slug}` })).join('')
          : `<div class="text-center py-20 text-surface-400"><p class="text-lg">暂无相关职位</p></div>`}
      </div>
      ${pagination}
      ${otherChips}
    </div>`;

  return layout(`${country.name_cn}远程工作 - 远程岛`, content, {
    gaId: opts.gaId,
    description: `${country.name_cn}的远程工作机会，共 ${country.job_count} 个在招岗位，每天更新，支持按城市、薪资筛选并直接申请。`,
    keywords: `${country.name_cn}远程工作,${country.name} remote jobs,${country.name_cn}远程招聘,远程岛`,
    canonical: opts.siteUrl ? `${opts.siteUrl}/country/${country.slug}${page > 1 ? `?page=${page}` : ''}` : undefined,
    staticUrl: opts.staticUrl,
    activePath: '/locations',
    user: opts.user,
  });
}
