import { layout } from './layout';
import { escapeHtml } from '../utils/helpers';

interface CompanyItem {
  id: number;
  name: string;
  slug: string;
  thumbnail: string | null;
  location_name_cn: string | null;
  country_name_cn: string | null;
  job_count: number;
}

export function companiesPage(companies: CompanyItem[], page: number, totalPages: number, gaId?: string, siteUrl?: string, staticUrl?: string): string {
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

  const pagination = totalPages > 1 ? `
    <div class="flex justify-center gap-2 mt-6">
      ${page > 1 ? `<a href="/companies?page=${page - 1}" class="px-4 py-2 rounded-lg bg-white border border-surface-200 text-sm hover:bg-surface-50 transition no-underline text-surface-600">← 上一页</a>` : ''}
      <span class="px-4 py-2 text-sm text-surface-500">${page} / ${totalPages}</span>
      ${page < totalPages ? `<a href="/companies?page=${page + 1}" class="px-4 py-2 rounded-lg bg-white border border-surface-200 text-sm hover:bg-surface-50 transition no-underline text-surface-600">下一页 →</a>` : ''}
    </div>` : '';

  const content = `
    <div class="max-w-5xl mx-auto px-4 mt-6">
      <h1 class="text-xl font-bold text-surface-900 mb-4">公司列表</h1>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        ${companyCards}
      </div>
      ${pagination}
    </div>`;

  return layout('公司列表 - 远程岛', content, {
    gaId,
    description: '远程岛收录的招聘远程岗位的公司列表，浏览全球远程招聘公司。',
    keywords: '远程工作公司,远程招聘,海外远程公司,远程岛',
    canonical: siteUrl ? `${siteUrl}/companies${page > 1 ? `?page=${page}` : ''}` : undefined,
    staticUrl,
  });
}
