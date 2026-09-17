import { Job, AuthUser } from '../types';
import { layout } from './layout';
import { renderJobRow } from './jobRow';
import { breadcrumb } from '../utils/helpers';
import { userCenterShell } from './userCenter';

export function favoritesPage(jobs: Job[], options: {
  gaId?: string;
  staticUrl?: string;
  user?: AuthUser | null;
}): string {
  const bc = breadcrumb([
    { label: '首页', href: '/' },
    { label: '收藏', href: '/favorites' },
  ]);

  const list = jobs.length > 0
    ? `<div class="bg-white rounded shadow-sm border border-surface-200 overflow-hidden">
        ${jobs.map((job) => renderJobRow(job, { dataFrom: 'favorites', showNewBadge: false })).join('')}
      </div>`
    : `<div class="bg-white rounded shadow-sm border border-surface-200 px-6 py-12 text-center text-surface-500">
        还没有收藏职位。<a href="/" class="text-brand-500 no-underline hover:underline">去逛逛</a>
      </div>`;

  const inner = `
      <h1 class="text-2xl font-bold mb-4">收藏</h1>
      ${list}`;

  const content = `${bc}${userCenterShell('/favorites', inner)}`;

  return layout('收藏 - 远程岛', content, {
    gaId: options.gaId,
    staticUrl: options.staticUrl,
    description: '查看你在远程岛收藏的远程职位。',
    activePath: '/favorites',
    user: options.user,
  });
}
