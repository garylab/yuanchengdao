import { layout } from './layout';
import { escapeHtml, breadcrumb } from '../utils/helpers';

interface SearchTermItem {
  id: number;
  term: string;
  term_cn: string;
  slug: string;
  job_count: number;
}

export function categoriesPage(terms: SearchTermItem[], query?: string, gaId?: string, siteUrl?: string, staticUrl?: string): string {
  const bc = breadcrumb([
    { label: '首页', href: '/' },
    { label: '分类' },
  ]);

  const content = `
    ${bc}
    <div class="max-w-5xl mx-auto px-4 mt-4">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-xl font-bold text-surface-900">职位分类</h1>
        <form action="/categories" method="GET" class="relative w-48">
          <input type="text" name="q" value="${query ? escapeHtml(query) : ''}" class="w-full px-3 py-1.5 pr-8 rounded-lg border border-surface-200 text-sm outline-none focus:ring-1 focus:ring-brand-300 focus:border-brand-300 placeholder:text-surface-400" placeholder="搜索分类...">
          <button type="submit" class="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-brand-500 transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </button>
        </form>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        ${terms.map(t => `
          <a href="/category/${escapeHtml(t.slug)}" class="block bg-white rounded-xl border border-surface-200 p-5 hover:border-brand-300 hover:shadow-sm transition no-underline group">
            <div class="font-semibold text-surface-900 group-hover:text-brand-500 transition">${escapeHtml(t.term_cn)}</div>
            <div class="text-sm text-surface-500 mt-1">${t.job_count} 个职位</div>
          </a>
        `).join('')}
      </div>
      ${terms.length === 0 ? `
        <div class="text-center py-20 text-surface-400">
          <p class="text-lg">${query ? '没有匹配的分类' : '暂无分类'}</p>
        </div>
      ` : ''}
    </div>`;

  const pageTitle = '职位分类 - 远程岛';
  const pageDesc = '不确定找什么工作？按类别浏览所有远程岗位方向，从工程师到设计师、从产品到运营，找到最适合你的远程职业。';

  return layout(pageTitle, content, {
    gaId,
    description: pageDesc,
    keywords: '远程工作分类,远程岗位分类,remote job categories,远程岛',
    canonical: siteUrl ? `${siteUrl}/categories` : undefined,
    staticUrl,
    activePath: '/categories',
  });
}
