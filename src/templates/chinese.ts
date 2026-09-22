import { AuthUser, Job } from '../types';
import { layout } from './layout';
import { renderJobRow } from './jobRow';
import { breadcrumb } from '../utils/helpers';

export function chineseJobsPage(
  jobs: Job[],
  page: number,
  hasMore: boolean,
  total: number,
  opts: { gaId?: string; siteUrl?: string; staticUrl?: string; user?: AuthUser | null },
): string {
  const bc = breadcrumb([
    { label: '首页', href: '/' },
    { label: '中文远程工作岗位', href: '/chinese' },
  ]);

  const pagination = (page > 1 || hasMore) ? `
    <div class="flex justify-center gap-2 mt-6">
      ${page > 1 ? `<a href="/chinese?page=${page - 1}" class="px-4 py-2 rounded bg-white border border-surface-200 text-sm hover:bg-surface-50 transition no-underline text-surface-600">← 上一页</a>` : ''}
      ${hasMore ? `<a href="/chinese?page=${page + 1}" class="px-4 py-2 rounded bg-white border border-surface-200 text-sm hover:bg-surface-50 transition no-underline text-surface-600">下一页 →</a>` : ''}
    </div>` : '';

  const content = `
    ${bc}
    <div class="max-w-5xl mx-auto px-4 mt-4">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 class="text-xl font-bold text-surface-900">🇨🇳 中文远程工作岗位</h1>
        <span class="text-sm text-surface-500">在招 ${total} 个</span>
      </div>
      <p class="text-sm text-surface-500 mb-4">职位描述中明确提到中文、普通话或粤语（要求或优先）的远程岗位，面向中文使用者，每天更新。</p>
      <div class="bg-white rounded shadow-sm border border-surface-200 overflow-hidden">
        ${jobs.length > 0
          ? jobs.map((j) => renderJobRow(j, { dataFrom: 'chinese-list' })).join('')
          : `<div class="text-center py-20 text-surface-400"><p class="text-lg">暂无相关职位</p></div>`}
      </div>
      ${pagination}
    </div>`;

  return layout(`中文远程工作岗位${page > 1 ? ` - 第${page}页` : ''} - 远程岛`, content, {
    gaId: opts.gaId,
    description: `中文远程工作岗位汇总：职位要求或优先中文、普通话、粤语的全球远程职位，共 ${total} 个在招，每天更新，可直接申请。`,
    keywords: '中文远程工作,中文优先,普通话远程工作,Mandarin remote jobs,Chinese speaking remote jobs,远程岛',
    canonical: opts.siteUrl ? `${opts.siteUrl}/chinese${page > 1 ? `?page=${page}` : ''}` : undefined,
    staticUrl: opts.staticUrl,
    activePath: '/chinese',
    user: opts.user,
  });
}
