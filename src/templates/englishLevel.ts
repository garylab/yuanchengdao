import { AuthUser, Job } from '../types';
import { layout } from './layout';
import { renderJobRow } from './jobRow';
import { breadcrumb, escapeHtml } from '../utils/helpers';
import { ENGLISH_LEVEL_GROUPS } from '../constants/englishLevel';

type Group = (typeof ENGLISH_LEVEL_GROUPS)[number];

export function englishLevelPage(
  group: Group,
  jobs: Job[],
  page: number,
  hasMore: boolean,
  counts: Record<string, number>,
  opts: { gaId?: string; siteUrl?: string; staticUrl?: string; user?: AuthUser | null },
): string {
  const bc = breadcrumb([
    { label: '首页', href: '/' },
    { label: '英语要求', href: '/english/none' },
    { label: group.label, href: `/english/${group.slug}` },
  ]);

  const tabs = ENGLISH_LEVEL_GROUPS.map((g) => {
    const active = g.slug === group.slug;
    return `<a href="/english/${g.slug}" class="px-3 py-1.5 rounded-full text-sm no-underline transition ${active ? 'bg-brand-500 text-white' : 'bg-white border border-surface-200 text-surface-600 hover:border-brand-300 hover:text-brand-600'}">${escapeHtml(g.label)} <span class="${active ? 'text-white/80' : 'text-surface-400'}">${counts[g.slug] ?? 0}</span></a>`;
  }).join('');

  const pagination = (page > 1 || hasMore) ? `
    <div class="flex justify-center gap-2 mt-6">
      ${page > 1 ? `<a href="/english/${group.slug}?page=${page - 1}" class="px-4 py-2 rounded bg-white border border-surface-200 text-sm hover:bg-surface-50 transition no-underline text-surface-600">← 上一页</a>` : ''}
      ${hasMore ? `<a href="/english/${group.slug}?page=${page + 1}" class="px-4 py-2 rounded bg-white border border-surface-200 text-sm hover:bg-surface-50 transition no-underline text-surface-600">下一页 →</a>` : ''}
    </div>` : '';

  const content = `
    ${bc}
    <div class="max-w-5xl mx-auto px-4 mt-4">
      <h1 class="text-xl font-bold text-surface-900 mb-1">${escapeHtml(group.title)}</h1>
      <p class="text-sm text-surface-500 mb-4">${escapeHtml(group.description)}</p>
      <div class="flex flex-wrap gap-2 mb-4">${tabs}</div>
      <div class="bg-white rounded shadow-sm border border-surface-200 overflow-hidden">
        ${jobs.length > 0
          ? jobs.map((j) => renderJobRow(j, { dataFrom: `english-${group.slug}` })).join('')
          : `<div class="text-center py-20 text-surface-400"><p class="text-lg">暂无相关职位</p></div>`}
      </div>
      ${pagination}
    </div>`;

  return layout(`${group.title} - 远程岛`, content, {
    gaId: opts.gaId,
    description: `${group.title}：${group.description} 每天更新，可直接申请。`,
    keywords: `${group.title},未标明英语要求的远程工作,英语要求,远程工作,远程岛`,
    canonical: opts.siteUrl ? `${opts.siteUrl}/english/${group.slug}${page > 1 ? `?page=${page}` : ''}` : undefined,
    staticUrl: opts.staticUrl,
    activePath: '/english',
    user: opts.user,
  });
}
