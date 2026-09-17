import { AuthUser } from '../types';
import { layout } from './layout';
import { breadcrumb, escapeHtml } from '../utils/helpers';
import { userCenterShell } from './userCenter';
import { salaryLabel } from '../constants/salary';

export type AdminUserSubscription = {
  term_cn: string | null;
  location_name_cn: string | null;
  salary_range: string | null;
  notify_email: number;
  notify_telegram: number;
};

export type AdminUserRow = {
  id: number;
  email: string;
  name: string | null;
  role: 'admin' | 'user';
  created_at: string;
  telegram_chat_id: string | null;
  favorite_count: number;
  subscriptions: AdminUserSubscription[];
};

export function usersPage(options: {
  user: AuthUser;
  users: AdminUserRow[];
  gaId?: string;
  staticUrl?: string;
}): string {
  const { user, users } = options;
  const bc = breadcrumb([
    { label: '首页', href: '/' },
    { label: '所有用户', href: '/users' },
  ]);

  const rows = users.map((u) => {
    const subs = u.subscriptions.length > 0
      ? `<ul class="space-y-1">${u.subscriptions.map((s) => {
          const channels = [
            s.notify_email ? '邮件' : null,
            s.notify_telegram ? 'Telegram' : null,
          ].filter(Boolean).join(' / ') || '无';
          const loc = s.location_name_cn ? escapeHtml(s.location_name_cn) : '不限';
          const salary = escapeHtml(salaryLabel(s.salary_range));
          return `<li class="text-xs text-surface-600">${escapeHtml(s.term_cn || '分类')} · ${loc} · 薪资${salary} · ${channels}</li>`;
        }).join('')}</ul>`
      : `<span class="text-xs text-surface-400">无</span>`;

    const roleBadge = u.role === 'admin'
      ? `<span class="inline-block text-xs px-2 py-0.5 rounded bg-brand-50 text-brand-600 font-medium">管理员</span>`
      : `<span class="inline-block text-xs px-2 py-0.5 rounded bg-surface-100 text-surface-600">普通</span>`;

    return `
      <tr class="border-b border-surface-100 last:border-0 align-top">
        <td class="py-3 pr-3 text-sm text-surface-500">${u.id}</td>
        <td class="py-3 pr-3 text-sm">
          <div class="text-surface-900">${escapeHtml(u.email)}</div>
          ${u.name ? `<div class="text-xs text-surface-500 mt-0.5">${escapeHtml(u.name)}</div>` : ''}
        </td>
        <td class="py-3 pr-3">${roleBadge}</td>
        <td class="py-3 pr-3 text-xs text-surface-500 whitespace-nowrap">${escapeHtml(u.created_at)}</td>
        <td class="py-3 pr-3 text-xs">${u.telegram_chat_id ? '<span class="text-green-600">已绑</span>' : '<span class="text-surface-400">未绑</span>'}</td>
        <td class="py-3 pr-3 text-sm text-surface-700">${u.favorite_count}</td>
        <td class="py-3">${subs}</td>
      </tr>`;
  }).join('');

  const inner = `
      <div class="bg-white rounded shadow-sm border border-surface-200 p-6">
        <div class="flex items-center justify-between mb-4">
          <h1 class="text-2xl font-bold">所有用户</h1>
          <span class="text-sm text-surface-500">共 ${users.length} 位</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="border-b border-surface-200 text-xs text-surface-500 uppercase tracking-wide">
                <th class="py-2 pr-3 font-medium">ID</th>
                <th class="py-2 pr-3 font-medium">邮箱 / 昵称</th>
                <th class="py-2 pr-3 font-medium">角色</th>
                <th class="py-2 pr-3 font-medium">注册时间</th>
                <th class="py-2 pr-3 font-medium">TG</th>
                <th class="py-2 pr-3 font-medium">收藏</th>
                <th class="py-2 font-medium">订阅</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="7" class="py-6 text-center text-sm text-surface-400">暂无用户</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;

  const content = `${bc}${userCenterShell('/users', inner, user)}`;

  return layout('所有用户 - 远程岛', content, {
    gaId: options.gaId,
    staticUrl: options.staticUrl,
    description: '管理员查看远程岛注册用户与订阅情况。',
    activePath: '/users',
    user,
  });
}
