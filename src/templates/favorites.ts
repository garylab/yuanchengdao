import { Job, AuthUser } from '../types';
import { layout } from './layout';
import { renderJobRow } from './jobRow';
import { breadcrumb } from '../utils/helpers';

export function favoritesPage(jobs: Job[], options: {
  gaId?: string;
  staticUrl?: string;
  user?: AuthUser | null;
}): string {
  const bc = breadcrumb([
    { label: '首页', href: '/' },
    { label: '我的收藏', href: '/favorites' },
  ]);

  const list = jobs.length > 0
    ? `<div class="bg-white rounded shadow-sm border border-surface-200 overflow-hidden">
        ${jobs.map((job) => renderJobRow(job, { dataFrom: 'favorites', showNewBadge: false })).join('')}
      </div>`
    : `<div class="bg-white rounded shadow-sm border border-surface-200 px-6 py-12 text-center text-surface-500">
        还没有收藏职位。<a href="/" class="text-brand-500 no-underline hover:underline">去逛逛</a>
      </div>`;

  const content = `
    ${bc}
    <div class="max-w-5xl mx-auto px-4 py-6">
      <h1 class="text-2xl font-bold mb-4">我的收藏</h1>
      ${list}
    </div>`;

  return layout('我的收藏 - 远程岛', content, {
    gaId: options.gaId,
    staticUrl: options.staticUrl,
    description: '查看你在远程岛收藏的远程职位。',
    activePath: '/favorites',
    user: options.user,
  });
}
