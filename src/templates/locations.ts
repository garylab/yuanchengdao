import { layout } from './layout';
import { escapeHtml, breadcrumb } from '../utils/helpers';

interface LocationItem {
  id: number;
  name: string;
  name_cn: string;
  slug: string;
  country_name_cn: string | null;
  country_flag_emoji: string | null;
  job_count: number;
}

export function locationsPage(locations: LocationItem[], page: number, hasMore: boolean, query?: string, gaId?: string, siteUrl?: string, staticUrl?: string): string {
  const cards = locations.map(l => {
    const displayName = l.name_cn || l.name;
    const subtitle = l.country_name_cn && l.country_name_cn !== l.name_cn ? l.country_name_cn : '';

    return `
      <a href="/location/${escapeHtml(l.slug)}" class="flex items-center gap-3 p-4 bg-white rounded-xl border border-surface-200 hover:border-brand-300 hover:shadow-sm transition no-underline group">
        <div class="flex-shrink-0 w-12 h-12 rounded-lg bg-brand-50 flex items-center justify-center text-xl">${l.country_flag_emoji || '🌍'}</div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-surface-900 text-sm group-hover:text-brand-500 transition truncate">${escapeHtml(displayName)}</div>
          <div class="flex items-center gap-3 mt-1 text-xs text-surface-400">
            ${subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ''}
            <span>${l.job_count} 个职位</span>
          </div>
        </div>
      </a>`;
  }).join('');

  const qs = (p: number) => {
    const parts: string[] = [];
    if (query) parts.push(`q=${encodeURIComponent(query)}`);
    if (p > 1) parts.push(`page=${p}`);
    return parts.length ? '?' + parts.join('&') : '';
  };

  const pagination = (page > 1 || hasMore) ? `
    <div class="flex justify-center gap-2 mt-6">
      ${page > 1 ? `<a href="/locations${qs(page - 1)}" class="px-4 py-2 rounded-lg bg-white border border-surface-200 text-sm hover:bg-surface-50 transition no-underline text-surface-600">← 上一页</a>` : ''}
      ${hasMore ? `<a href="/locations${qs(page + 1)}" class="px-4 py-2 rounded-lg bg-white border border-surface-200 text-sm hover:bg-surface-50 transition no-underline text-surface-600">下一页 →</a>` : ''}
    </div>` : '';

  const bc = breadcrumb([
    { label: '首页', href: '/' },
    { label: '地区' },
  ]);

  const content = `
    ${bc}
    <div class="max-w-5xl mx-auto px-4 mt-4">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-xl font-bold text-surface-900">地区列表</h1>
        <form action="/locations" method="GET" class="relative w-48">
          <input type="text" name="q" value="${query ? escapeHtml(query) : ''}" class="w-full px-3 py-1.5 pr-8 rounded-lg border border-surface-200 text-sm outline-none focus:ring-1 focus:ring-brand-300 focus:border-brand-300 placeholder:text-surface-400" placeholder="搜索地区...">
          <button type="submit" class="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-brand-500 transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </button>
        </form>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        ${cards}
      </div>
      ${locations.length === 0 ? `<div class="text-center py-20 text-surface-400"><p class="text-lg">${query ? '没有匹配的地区' : '暂无地区'}</p></div>` : ''}
      ${pagination}
    </div>`;

  return layout('地区列表 - 远程岛', content, {
    gaId,
    description: '按地区浏览全球远程工作机会，查看各地区在招职位数量，找到适合你的远程岗位。',
    keywords: '远程工作地区,远程岗位城市,全球远程工作,远程岛',
    canonical: siteUrl ? `${siteUrl}/locations${page > 1 ? `?page=${page}` : ''}` : undefined,
    staticUrl,
    activePath: '/locations',
  });
}
