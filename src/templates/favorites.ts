import { Job, AuthUser } from '../types';
import { layout } from './layout';
import { renderJobRow } from './jobRow';
import { breadcrumb, escapeHtml, isJobStale, timeAgo } from '../utils/helpers';
import { userCenterShell } from './userCenter';
import { FAVORITE_STATUSES, favoriteStatusMeta } from '../constants/favorites';

export type FavoriteRecord = {
  id: number;
  job_id: number | null;
  status: string;
  notes: string | null;
  job_title: string | null;
  company_name: string | null;
  company_slug: string | null;
  job_slug: string | null;
  apply_url: string | null;
  job_posted_at: string | null;
  created_at: string;
  updated_at: string;
  job: Job | null;
};

export function favoritesPage(
  records: FavoriteRecord[],
  recommended: Job[],
  options: { user: AuthUser; activeStatus: string; gaId?: string; staticUrl?: string },
): string {
  const { user, activeStatus } = options;
  const bc = breadcrumb([
    { label: '首页', href: '/' },
    { label: '收藏 / 申请追踪', href: '/favorites' },
  ]);

  const counts: Record<string, number> = { all: records.length };
  for (const r of records) counts[r.status] = (counts[r.status] || 0) + 1;
  const visible = activeStatus === 'all' ? records.filter((r) => r.status !== 'archived') : records.filter((r) => r.status === activeStatus);

  const tabs = [{ value: 'all', label: '全部（不含归档）' }, ...FAVORITE_STATUSES].map((t) => {
    const active = t.value === activeStatus;
    const n = t.value === 'all' ? records.filter((r) => r.status !== 'archived').length : (counts[t.value] || 0);
    return `<a href="/favorites${t.value === 'all' ? '' : `?status=${t.value}`}" class="px-3 py-1.5 rounded-full text-xs no-underline transition ${active ? 'bg-brand-500 text-white' : 'bg-white border border-surface-200 text-surface-600 hover:border-brand-300 hover:text-brand-600'}">${escapeHtml(t.label)} <span class="${active ? 'text-white/80' : 'text-surface-400'}">${n}</span></a>`;
  }).join('');

  const statusOptions = (current: string) => FAVORITE_STATUSES.map((s) =>
    `<option value="${s.value}" ${s.value === current ? 'selected' : ''}>${escapeHtml(s.label)}</option>`
  ).join('');

  const rows = visible.map((r) => {
    const stale = r.job ? isJobStale(r.job.posted_at || r.job.created_at) : true;
    const removed = !r.job;
    const meta = favoriteStatusMeta(r.status);
    const title = r.job?.title || r.job_title || '（职位信息不可用）';
    const company = r.job?.company_name || r.company_name || '';
    const companySlug = r.job?.company_slug || r.company_slug;
    const jobSlug = r.job?.slug || r.job_slug;
    const applyUrl = r.apply_url;

    const header = `
      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            ${jobSlug && !removed
              ? `<a href="/job/${escapeHtml(jobSlug)}" class="font-semibold text-surface-900 hover:text-brand-600 no-underline">${escapeHtml(title)}</a>`
              : `<span class="font-semibold text-surface-700">${escapeHtml(title)}</span>`}
            ${company ? (companySlug ? `<a href="/company/${escapeHtml(companySlug)}" class="text-sm text-surface-500 hover:text-brand-600 no-underline">${escapeHtml(company)}</a>` : `<span class="text-sm text-surface-500">${escapeHtml(company)}</span>`) : ''}
            <span class="tag-pill ${meta.css} text-xs">${escapeHtml(meta.label)}</span>
            ${removed ? '<span class="tag-pill bg-surface-100 text-surface-500 text-xs">职位已下线</span>' : stale ? '<span class="tag-pill bg-amber-50 text-amber-700 text-xs">已超过 30 天</span>' : ''}
          </div>
          <div class="text-xs text-surface-400 mt-1">收藏于 ${timeAgo(r.created_at)}${r.updated_at !== r.created_at ? ` · 更新于 ${timeAgo(r.updated_at)}` : ''}</div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <select class="fav-status border border-surface-200 rounded px-2 py-1 text-xs text-surface-700 bg-white" data-id="${r.id}">${statusOptions(r.status)}</select>
          ${applyUrl ? `<a href="${escapeHtml(applyUrl)}" target="_blank" rel="noopener noreferrer" class="text-xs px-2.5 py-1 rounded bg-brand-500 text-white hover:bg-brand-600 no-underline">申请</a>` : ''}
          <button type="button" class="fav-notes-toggle text-xs text-surface-500 hover:text-brand-600" data-id="${r.id}">${r.notes ? '备注' : '+ 备注'}</button>
          <button type="button" class="fav-remove text-xs text-surface-400 hover:text-red-600" data-id="${r.id}" title="移除">✕</button>
        </div>
      </div>
      <div class="fav-notes ${r.notes ? '' : 'hidden'} mt-3" data-id="${r.id}">
        <textarea class="fav-notes-input w-full border border-surface-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-400" rows="2" maxlength="2000" placeholder="记录申请进度、联系人、面试时间…">${escapeHtml(r.notes || '')}</textarea>
        <div class="flex items-center gap-3 mt-1.5">
          <button type="button" class="fav-notes-save text-xs px-2.5 py-1 rounded border border-brand-200 bg-brand-50 text-brand-600 hover:bg-brand-100" data-id="${r.id}">保存备注</button>
          <span class="fav-notes-status text-xs text-surface-400"></span>
        </div>
      </div>`;

    return `<div class="fav-row px-4 py-4 border-b border-surface-100 last:border-0" data-id="${r.id}">${header}</div>`;
  }).join('');

  const list = visible.length > 0
    ? `<div class="bg-white rounded shadow-sm border border-surface-200 overflow-hidden">${rows}</div>`
    : `<div class="bg-white rounded shadow-sm border border-surface-200 px-6 py-12 text-center text-surface-500">
        ${records.length === 0 ? '还没有收藏职位。浏览职位时点击"收藏"，之后可以在这里跟踪申请进度。' : '这个状态下暂无职位。'}
        <a href="/" class="text-brand-500 no-underline hover:underline ml-1">去逛逛</a>
      </div>`;

  const recSection = recommended.length > 0 ? `
    <div>
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-base font-bold text-surface-900">为你推荐</h2>
        <span class="text-xs text-surface-400">基于你收藏的职位</span>
      </div>
      <div class="bg-white rounded shadow-sm border border-surface-200 overflow-hidden">
        ${recommended.map((j) => renderJobRow(j, { dataFrom: 'favorites-recommend' })).join('')}
      </div>
    </div>` : '';

  const inner = `
      <div>
        <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h1 class="text-2xl font-bold">收藏 / 申请追踪</h1>
          <span class="text-xs text-surface-400">状态和备注仅自己可见</span>
        </div>
        <div class="flex flex-wrap gap-2 mb-3">${tabs}</div>
        ${list}
      </div>
      ${recSection}
    <script>
      (function() {
        var list = document.querySelector('main');
        if (!list) return;
        async function patch(id, payload) {
          var res = await fetch('/api/favorites/' + id, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          var data = await res.json().catch(function() { return {}; });
          if (!res.ok) throw new Error(data.error || '保存失败');
          return data;
        }
        list.addEventListener('change', async function(e) {
          var sel = e.target.closest('.fav-status');
          if (!sel) return;
          sel.disabled = true;
          try {
            await patch(sel.dataset.id, { status: sel.value });
            window.location.reload();
          } catch (err) {
            alert(err.message || '保存失败');
            sel.disabled = false;
          }
        });
        list.addEventListener('click', async function(e) {
          var toggle = e.target.closest('.fav-notes-toggle');
          if (toggle) {
            var box = list.querySelector('.fav-notes[data-id="' + toggle.dataset.id + '"]');
            if (box) { box.classList.toggle('hidden'); var ta = box.querySelector('textarea'); if (ta && !box.classList.contains('hidden')) ta.focus(); }
            return;
          }
          var save = e.target.closest('.fav-notes-save');
          if (save) {
            var box2 = list.querySelector('.fav-notes[data-id="' + save.dataset.id + '"]');
            var ta2 = box2 && box2.querySelector('textarea');
            var status = box2 && box2.querySelector('.fav-notes-status');
            if (!ta2) return;
            save.disabled = true;
            try {
              await patch(save.dataset.id, { notes: ta2.value });
              if (status) { status.textContent = '已保存'; setTimeout(function() { status.textContent = ''; }, 1500); }
              var tg = list.querySelector('.fav-notes-toggle[data-id="' + save.dataset.id + '"]');
              if (tg) tg.textContent = ta2.value.trim() ? '备注' : '+ 备注';
            } catch (err) {
              if (status) status.textContent = err.message || '保存失败';
            } finally { save.disabled = false; }
            return;
          }
          var remove = e.target.closest('.fav-remove');
          if (remove) {
            if (!confirm('从收藏中移除？备注也会一起删除。')) return;
            var res = await fetch('/api/favorites/record/' + remove.dataset.id, { method: 'DELETE' });
            if (res.ok) {
              var row = remove.closest('.fav-row');
              if (row) row.remove();
            } else { alert('移除失败'); }
          }
        });
      })();
    </script>`;

  const content = `${bc}${userCenterShell('/favorites', inner, user)}`;

  return layout('收藏 / 申请追踪 - 远程岛', content, {
    gaId: options.gaId,
    staticUrl: options.staticUrl,
    description: '管理你收藏的远程职位，记录申请进度与备注。',
    activePath: '/favorites',
    user,
  });
}
