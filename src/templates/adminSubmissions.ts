import { AuthUser } from '../types';
import { layout } from './layout';
import { breadcrumb, escapeHtml } from '../utils/helpers';
import { userCenterShell } from './userCenter';
import type { JobSubmissionRow } from '../services/jobSubmissions';

export function adminSubmissionsPage(options: {
  user: AuthUser;
  submissions: Array<JobSubmissionRow & { job_slug: string | null }>;
  searchTerms: Array<{ id: number; term_cn: string }>;
  countries: Array<{ code: string; name_cn: string }>;
  gaId?: string;
  staticUrl?: string;
}): string {
  const { user, submissions, searchTerms, countries } = options;
  const bc = breadcrumb([
    { label: '首页', href: '/' },
    { label: '投递审核', href: '/admin/submissions' },
  ]);

  const pending = submissions.filter((s) => s.status === 'pending');
  const others = submissions.filter((s) => s.status !== 'pending');

  const termOptions = `<option value="">选择分类…</option>${searchTerms.map((t) => `<option value="${t.id}">${escapeHtml(t.term_cn)}</option>`).join('')}`;
  const countryOptions = `<option value="">不指定国家</option>${countries.map((c) => `<option value="${escapeHtml(c.code)}">${escapeHtml(c.name_cn)}</option>`).join('')}`;

  const statusBadge = (s: string) => s === 'approved'
    ? '<span class="inline-block text-xs px-2 py-0.5 rounded bg-green-50 text-green-700">已上线</span>'
    : s === 'rejected'
      ? '<span class="inline-block text-xs px-2 py-0.5 rounded bg-red-50 text-red-600">已拒绝</span>'
      : '<span class="inline-block text-xs px-2 py-0.5 rounded bg-yellow-50 text-yellow-700">待审核</span>';

  const card = (s: JobSubmissionRow & { job_slug: string | null }) => `
    <div class="border border-surface-200 rounded p-4 space-y-3" data-submission-id="${s.id}">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs text-surface-400">#${s.id}</span>
            ${statusBadge(s.status)}
            <span class="font-semibold text-surface-900">${escapeHtml(s.title)}</span>
            <span class="text-sm text-surface-500">${escapeHtml(s.company_name)}</span>
          </div>
          <div class="text-xs text-surface-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
            <span>联系：${escapeHtml(s.contact_email)}</span>
            ${s.company_website ? `<a href="${escapeHtml(s.company_website)}" target="_blank" rel="noopener" class="text-brand-500 hover:underline">官网</a>` : ''}
            ${s.apply_url ? `<a href="${escapeHtml(s.apply_url)}" target="_blank" rel="noopener" class="text-brand-500 hover:underline">申请链接</a>` : ''}
            ${s.apply_email ? `<span>申请邮箱：${escapeHtml(s.apply_email)}</span>` : ''}
            ${s.location_text ? `<span>地点：${escapeHtml(s.location_text)}</span>` : ''}
            ${s.schedule_type ? `<span>${escapeHtml(s.schedule_type)}</span>` : ''}
            ${s.salary_text ? `<span>薪资：${escapeHtml(s.salary_text)}</span>` : ''}
            ${s.salary_lower || s.salary_upper ? `<span>¥${s.salary_lower}–${s.salary_upper}/月</span>` : ''}
            <span>英语：${escapeHtml(s.english_level)}</span>
            <span>${escapeHtml(s.created_at)}</span>
          </div>
        </div>
        ${s.job_slug ? `<a href="/job/${escapeHtml(s.job_slug)}" target="_blank" class="text-xs text-brand-500 hover:underline">查看职位页</a>` : ''}
      </div>
      <details class="text-sm">
        <summary class="cursor-pointer text-surface-600">职位描述（${s.description.length} 字）</summary>
        <div class="mt-2 whitespace-pre-wrap text-surface-700 bg-surface-50 rounded p-3 max-h-80 overflow-y-auto">${escapeHtml(s.description)}</div>
      </details>
      ${s.admin_notes ? `<div class="text-xs text-surface-500">备注：${escapeHtml(s.admin_notes)}</div>` : ''}
      ${s.status === 'pending' ? `
        <div class="grid grid-cols-1 md:grid-cols-4 gap-2 items-end pt-2 border-t border-surface-100">
          <div>
            <label class="block text-xs text-surface-500 mb-1">分类（必选）</label>
            <select class="sub-term w-full border border-surface-200 rounded px-2 py-1.5 text-sm">${termOptions}</select>
          </div>
          <div>
            <label class="block text-xs text-surface-500 mb-1">国家（可选）</label>
            <select class="sub-country w-full border border-surface-200 rounded px-2 py-1.5 text-sm">${countryOptions}</select>
          </div>
          <div>
            <label class="block text-xs text-surface-500 mb-1">地点英文 / 中文（可选）</label>
            <div class="flex gap-1">
              <input type="text" class="sub-loc w-1/2 border border-surface-200 rounded px-2 py-1.5 text-sm" placeholder="Remote">
              <input type="text" class="sub-loc-cn w-1/2 border border-surface-200 rounded px-2 py-1.5 text-sm" placeholder="远程">
            </div>
          </div>
          <div>
            <label class="block text-xs text-surface-500 mb-1">备注（拒绝时会发给投递人）</label>
            <input type="text" class="sub-notes w-full border border-surface-200 rounded px-2 py-1.5 text-sm" placeholder="可选">
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button type="button" class="sub-approve px-3 py-1.5 rounded bg-brand-500 text-white text-sm font-medium hover:bg-brand-600">通过并上线</button>
          <button type="button" class="sub-reject px-3 py-1.5 rounded border border-red-200 text-red-600 text-sm hover:bg-red-50">拒绝</button>
          <span class="sub-status text-xs text-surface-400"></span>
        </div>` : ''}
    </div>`;

  const inner = `
      <div class="bg-white rounded shadow-sm border border-surface-200 p-6 space-y-4">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <h1 class="text-2xl font-bold">投递审核</h1>
          <span class="text-sm text-surface-500">待审核 ${pending.length} · 共 ${submissions.length}</span>
        </div>
        ${pending.length > 0 ? pending.map(card).join('') : '<p class="text-sm text-surface-400 py-4">没有待审核的投递。</p>'}
        ${others.length > 0 ? `<details class="pt-2"><summary class="cursor-pointer text-sm text-surface-600">已处理（${others.length}）</summary><div class="space-y-3 mt-3">${others.map(card).join('')}</div></details>` : ''}
      </div>
    <script>
      (function() {
        var root = document.querefirst ? null : document;
        document.addEventListener('click', async function(e) {
          var approve = e.target.closest('.sub-approve');
          var reject = e.target.closest('.sub-reject');
          if (!approve && !reject) return;
          var card = e.target.closest('[data-submission-id]');
          var id = card.getAttribute('data-submission-id');
          var status = card.querySelector('.sub-status');
          var notes = (card.querySelector('.sub-notes') || {}).value || '';
          var btn = approve || reject;
          btn.disabled = true;
          try {
            var res;
            if (approve) {
              var termId = Number((card.querySelector('.sub-term') || {}).value || 0);
              if (!termId) { status.textContent = '请选择分类'; btn.disabled = false; return; }
              res = await fetch('/api/job-submissions/' + id + '/approve', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  searchTermId: termId,
                  countryCode: (card.querySelector('.sub-country') || {}).value || null,
                  locationName: (card.querySelector('.sub-loc') || {}).value || null,
                  locationNameCn: (card.querySelector('.sub-loc-cn') || {}).value || null,
                  adminNotes: notes || null
                })
              });
            } else {
              if (!confirm('确定拒绝该投递？投递人会收到邮件通知。')) { btn.disabled = false; return; }
              res = await fetch('/api/job-submissions/' + id + '/reject', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminNotes: notes || null })
              });
            }
            var data = await res.json().catch(function() { return {}; });
            if (!res.ok) { status.textContent = data.error || '操作失败'; btn.disabled = false; return; }
            window.location.reload();
          } catch (err) {
            status.textContent = '操作失败';
            btn.disabled = false;
          }
        });
      })();
    </script>`;

  const content = `${bc}${userCenterShell('/admin/submissions', inner, user)}`;
  return layout('投递审核 - 远程岛', content, {
    gaId: options.gaId,
    staticUrl: options.staticUrl,
    description: '管理员审核雇主投递的职位。',
    activePath: '/admin/submissions',
    user,
  });
}
