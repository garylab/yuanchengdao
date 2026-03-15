import { layout } from './layout';
import { escapeHtml, breadcrumb } from '../utils/helpers';

interface SearchTermItem {
  id: number;
  term: string;
  term_cn: string;
  slug: string;
  job_count: number;
}

export function categoriesPage(terms: SearchTermItem[], gaId?: string, siteUrl?: string, staticUrl?: string): string {
  const bc = breadcrumb([
    { label: '首页', href: '/' },
    { label: '分类' },
  ]);

  const content = `
    ${bc}
    <div class="max-w-5xl mx-auto px-4 mt-4">
      <h1 class="text-xl font-bold text-surface-900 mb-4">职位分类</h1>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        ${terms.map(t => `
          <a href="/category/${escapeHtml(t.slug)}" class="block bg-white rounded-xl border border-surface-200 p-5 hover:border-brand-300 hover:shadow-sm transition no-underline group">
            <div class="font-semibold text-surface-900 group-hover:text-brand-500 transition">${escapeHtml(t.term_cn)}</div>
            <div class="text-xs text-surface-400 mt-1">${escapeHtml(t.term)}</div>
            <div class="text-sm text-surface-500 mt-2">${t.job_count} 个职位</div>
          </a>
        `).join('')}
      </div>
      ${terms.length === 0 ? `
        <div class="text-center py-20 text-surface-400">
          <p class="text-lg">暂无分类</p>
        </div>
      ` : ''}
    </div>`;

  const pageTitle = '职位分类 - 远程岛';
  const pageDesc = '按职位类别浏览远程工作机会。远程岛 - 华人全球远程工作机会平台。';

  return layout(pageTitle, content, {
    gaId,
    description: pageDesc,
    keywords: '远程工作分类,远程岗位分类,remote job categories,远程岛',
    canonical: siteUrl ? `${siteUrl}/categories` : undefined,
    staticUrl,
  });
}
