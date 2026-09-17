import { AuthUser } from '../types';
import { layout } from './layout';
import { breadcrumb, escapeHtml } from '../utils/helpers';
import { userCenterShell } from './userCenter';
import { feedbackCategoryLabel } from '../constants/feedback';

export type AdminFeedbackRow = {
  id: number;
  user_id: number | null;
  email: string | null;
  category: string;
  message: string;
  reference_url: string | null;
  page_url: string | null;
  resolved_at: string | null;
  admin_notes: string | null;
  created_at: string;
  user_email: string | null;
  user_name: string | null;
};

export function adminFeedbackPage(options: {
  user: AuthUser;
  feedback: AdminFeedbackRow[];
  gaId?: string;
  staticUrl?: string;
}): string {
  const { user, feedback } = options;
  const bc = breadcrumb([
    { label: '首页', href: '/' },
    { label: '反馈管理', href: '/admin/feedback' },
  ]);

  const pending = feedback.filter((f) => !f.resolved_at).length;

  const rows = feedback.map((f) => {
    const submitter = f.user_email
      ? `${escapeHtml(f.user_name || '')} <span class="text-surface-400">${escapeHtml(f.user_email)}</span>`
      : f.email
        ? `<span class="text-surface-500">${escapeHtml(f.email)}</span> <span class="text-xs text-surface-400">(匿名)</span>`
        : `<span class="text-xs text-surface-400">未提供</span>`;
    const statusBadge = f.resolved_at
      ? `<span class="inline-block text-xs px-2 py-0.5 rounded bg-green-50 text-green-700">已处理</span>`
      : `<span class="inline-block text-xs px-2 py-0.5 rounded bg-yellow-50 text-yellow-700">待处理</span>`;
    return `
      <tr class="border-b border-surface-100 last:border-0 align-top" data-feedback-id="${f.id}">
        <td class="py-3 pr-3 text-sm text-surface-500 whitespace-nowrap">${f.id}</td>
        <td class="py-3 pr-3 text-sm">
          <div><span class="inline-block text-xs px-2 py-0.5 rounded bg-brand-50 text-brand-600 font-medium">${escapeHtml(feedbackCategoryLabel(f.category))}</span></div>
          <div class="text-surface-800 mt-2 whitespace-pre-wrap break-words">${escapeHtml(f.message)}</div>
          ${f.reference_url ? `<div class="mt-1"><a href="${escapeHtml(f.reference_url)}" target="_blank" rel="noopener" class="text-xs text-brand-500 hover:underline break-all">${escapeHtml(f.reference_url)}</a></div>` : ''}
          ${f.page_url ? `<div class="mt-1 text-xs text-surface-400">来源页：<a href="${escapeHtml(f.page_url)}" target="_blank" rel="noopener" class="hover:underline break-all">${escapeHtml(f.page_url)}</a></div>` : ''}
        </td>
        <td class="py-3 pr-3 text-sm">${submitter}</td>
        <td class="py-3 pr-3 text-xs text-surface-500 whitespace-nowrap">${escapeHtml(f.created_at)}</td>
        <td class="py-3 pr-3">${statusBadge}</td>
        <td class="py-3">
          <button type="button" class="feedback-toggle text-sm ${f.resolved_at ? 'text-surface-500 hover:text-brand-600' : 'text-brand-500 hover:text-brand-600'}">
            ${f.resolved_at ? '标记待处理' : '标记已处理'}
          </button>
        </td>
      </tr>`;
  }).join('');

  const inner = `
      <div class="bg-white rounded shadow-sm border border-surface-200 p-6">
        <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h1 class="text-2xl font-bold">反馈管理</h1>
          <span class="text-sm text-surface-500">共 ${feedback.length} 条 · 待处理 ${pending}</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="border-b border-surface-200 text-xs text-surface-500 uppercase tracking-wide">
                <th class="py-2 pr-3 font-medium">ID</th>
                <th class="py-2 pr-3 font-medium">类型 / 内容</th>
                <th class="py-2 pr-3 font-medium">提交人</th>
                <th class="py-2 pr-3 font-medium">时间</th>
                <th class="py-2 pr-3 font-medium">状态</th>
                <th class="py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody id="feedback-tbody">
              ${rows || '<tr><td colspan="6" class="py-6 text-center text-sm text-surface-400">暂无反馈</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    <script>
      (function() {
        var tbody = document.getElementById('feedback-tbody');
        if (!tbody) return;
        tbody.addEventListener('click', async function(event) {
          var btn = event.target.closest('.feedback-toggle');
          if (!btn) return;
          var row = btn.closest('[data-feedback-id]');
          var id = row && row.getAttribute('data-feedback-id');
          if (!id) return;
          btn.disabled = true;
          var original = btn.textContent;
          btn.textContent = '处理中…';
          try {
            var response = await fetch('/api/feedback/' + id + '/toggle', { method: 'POST' });
            if (response.ok) window.location.reload();
            else {
              btn.disabled = false;
              btn.textContent = original;
              alert('操作失败');
            }
          } catch (e) {
            btn.disabled = false;
            btn.textContent = original;
            alert('操作失败');
          }
        });
      })();
    </script>`;

  const content = `${bc}${userCenterShell('/admin/feedback', inner, user)}`;

  return layout('反馈管理 - 远程岛', content, {
    gaId: options.gaId,
    staticUrl: options.staticUrl,
    description: '管理员查看用户反馈。',
    activePath: '/admin/feedback',
    user,
  });
}
