import { layout } from './layout';
import { escapeHtml, breadcrumb } from '../utils/helpers';

interface CompanyItem {
  id: number;
  name: string;
  slug: string;
  thumbnail: string | null;
  location_name_cn: string | null;
  country_name_cn: string | null;
  job_count: number;
}

export function companiesPage(companies: CompanyItem[], page: number, totalPages: number, query?: string, gaId?: string, siteUrl?: string, staticUrl?: string): string {
  const companyCards = companies.map(c => {
    const firstWord = (c.name || '?').split(/\s+/)[0];
    const logoFontSize = firstWord.length <= 2 ? 'text-lg' : firstWord.length <= 5 ? 'text-xs' : 'text-[10px]';
    const logo = c.thumbnail
      ? `<img src="${escapeHtml(c.thumbnail)}" alt="${escapeHtml(c.name)}" class="w-12 h-12 rounded-lg object-contain bg-surface-100" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      : '';
    const locationParts = [c.location_name_cn, c.country_name_cn].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
    const location = locationParts.join(', ') || '';

    return `
      <a href="/company/${escapeHtml(c.slug)}" class="flex items-center gap-3 p-4 bg-white rounded-xl border border-surface-200 hover:border-brand-300 hover:shadow-sm transition no-underline group">
        <div class="flex-shrink-0 w-12 h-12">
          ${logo}
          <div class="${c.thumbnail ? 'hidden' : 'flex'} w-12 h-12 rounded-lg bg-brand-50 items-center justify-center ${logoFontSize} font-bold text-brand-500 leading-tight text-center overflow-hidden p-1.5">${escapeHtml(firstWord)}</div>
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-surface-900 text-sm group-hover:text-brand-500 transition truncate">${escapeHtml(c.name)}</div>
          <div class="flex items-center gap-3 mt-1 text-xs text-surface-400">
            ${location ? `<span>${escapeHtml(location)}</span>` : ''}
            <span>${c.job_count} 个职位</span>
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

  const pagination = totalPages > 1 ? `
    <div class="flex justify-center gap-2 mt-6">
      ${page > 1 ? `<a href="/companies${qs(page - 1)}" class="px-4 py-2 rounded-lg bg-white border border-surface-200 text-sm hover:bg-surface-50 transition no-underline text-surface-600">← 上一页</a>` : ''}
      <span class="px-4 py-2 text-sm text-surface-500">${page} / ${totalPages}</span>
      ${page < totalPages ? `<a href="/companies${qs(page + 1)}" class="px-4 py-2 rounded-lg bg-white border border-surface-200 text-sm hover:bg-surface-50 transition no-underline text-surface-600">下一页 →</a>` : ''}
    </div>` : '';

  const bc = breadcrumb([
    { label: '首页', href: '/' },
    { label: '企业' },
  ]);

  const content = `
    ${bc}
    <div class="max-w-5xl mx-auto px-4 mt-4">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-xl font-bold text-surface-900">企业列表</h1>
        <form action="/companies" method="GET" class="relative w-48">
          <input type="text" name="q" value="${query ? escapeHtml(query) : ''}" class="w-full px-3 py-1.5 pr-8 rounded-lg border border-surface-200 text-sm outline-none focus:ring-1 focus:ring-brand-300 focus:border-brand-300 placeholder:text-surface-400" placeholder="搜索企业...">
          <button type="submit" class="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-brand-500 transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </button>
        </form>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        ${companyCards}
      </div>
      ${companies.length === 0 ? `<div class="text-center py-20 text-surface-400"><p class="text-lg">${query ? '没有匹配的企业' : '暂无企业'}</p></div>` : ''}
      ${pagination}
    </div>`;

  return layout('公司列表 - 远程岛', content, {
    gaId,
    description: '哪些公司提供远程工作？浏览正在招聘远程岗位的全球企业，了解各家公司在招职位数量，找到你心仪的雇主。',
    keywords: '远程工作公司,远程招聘企业,海外远程公司,远程岛',
    canonical: siteUrl ? `${siteUrl}/companies${page > 1 ? `?page=${page}` : ''}` : undefined,
    staticUrl,
    activePath: '/companies',
  });
}
