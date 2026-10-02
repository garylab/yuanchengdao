import { AuthUser } from '../types';
import { layout } from './layout';
import { breadcrumb, escapeHtml } from '../utils/helpers';
import { adminShell } from './userCenter';

/**
 * The three taxonomy admin pages (countries / locations / search terms) differ
 * only in their columns and API path, so they share one field-driven renderer.
 */
export type TaxonomyField = {
  /** JSON body key sent to the API, e.g. `nameCn`. */
  key: string;
  label: string;
  /** Property on the row holding the current value. */
  column: string;
  type?: 'text' | 'select';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  /** Columns like a country's `code` are shown but fixed after creation. */
  editable?: boolean;
};

export type TaxonomyRow = {
  id: number;
  is_active: number;
  job_count: number;
  [key: string]: unknown;
};

function cell(row: TaxonomyRow, field: TaxonomyField): string {
  const raw = row[field.column];
  if (raw === null || raw === undefined || raw === '') {
    return '<span class="text-surface-400">—</span>';
  }
  if (field.type === 'select' && field.options) {
    const match = field.options.find((o) => o.value === String(raw));
    return escapeHtml(match ? match.label : String(raw));
  }
  return escapeHtml(String(raw));
}

function input(field: TaxonomyField, row: TaxonomyRow | null): string {
  const value = row ? (row[field.column] ?? '') : '';
  const common = `data-field="${field.key}" class="w-full border border-surface-300 rounded px-2 py-1 text-sm"`;
  if (field.type === 'select' && field.options) {
    const opts = field.options.map((o) =>
      `<option value="${escapeHtml(o.value)}"${String(value) === o.value ? ' selected' : ''}>${escapeHtml(o.label)}</option>`
    ).join('');
    return `<select ${common}><option value="">请选择…</option>${opts}</select>`;
  }
  return `<input type="text" ${common} value="${escapeHtml(String(value))}" placeholder="${escapeHtml(field.placeholder || '')}">`;
}

export function taxonomyPage(options: {
  user: AuthUser;
  title: string;
  path: string;
  apiBase: string;
  description: string;
  /** Shown under the heading to explain what toggling actually affects. */
  hint: string;
  countLabel: string;
  fields: TaxonomyField[];
  rows: TaxonomyRow[];
  /** Omit for small tables that are fine to render whole. */
  pagination?: { page: number; pageSize: number; total: number; q: string };
  gaId?: string;
  staticUrl?: string;
}): string {
  const { user, title, path, apiBase, hint, countLabel, fields, rows, pagination } = options;
  const bc = breadcrumb([
    { label: '首页', href: '/' },
    { label: title, href: path },
  ]);

  const activeCount = rows.filter((r) => r.is_active).length;
  const colSpan = fields.length + 4;
  const editableFields = fields.filter((f) => f.editable !== false);

  // With pagination the counts describe the whole table, not just this page.
  const summary = pagination
    ? `${countLabel} ${pagination.total} 条 · 第 ${pagination.page} / ${Math.max(1, Math.ceil(pagination.total / pagination.pageSize))} 页`
    : `${countLabel} ${rows.length} 条 · 启用 ${activeCount} 条`;

  const pager = (() => {
    if (!pagination) return '';
    const { page, pageSize, total, q } = pagination;
    const lastPage = Math.max(1, Math.ceil(total / pageSize));
    const href = (p: number) => `${path}?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
    const link = (p: number, label: string, disabled: boolean) => disabled
      ? `<span class="px-3 py-1.5 text-sm text-surface-400">${label}</span>`
      : `<a href="${href(p)}" class="px-3 py-1.5 text-sm text-brand-500 no-underline hover:underline">${label}</a>`;
    if (total <= pageSize && !q) return '';
    return `
        <div class="flex items-center justify-between mt-4 pt-3 border-t border-surface-100">
          ${link(page - 1, '← 上一页', page <= 1)}
          <span class="text-xs text-surface-500">共 ${total} 条</span>
          ${link(page + 1, '下一页 →', page >= lastPage)}
        </div>`;
  })();

  const searchBox = pagination
    ? `
        <form method="get" action="${path}" class="mb-4 flex gap-2">
          <input type="text" name="q" value="${escapeHtml(pagination.q)}" placeholder="按名称或 slug 搜索…"
            class="flex-1 min-w-0 border border-surface-300 rounded px-3 py-1.5 text-sm">
          <button type="submit" class="text-sm bg-surface-100 text-surface-700 rounded px-3 py-1.5 hover:bg-surface-200 transition">搜索</button>
          ${pagination.q ? `<a href="${path}" class="text-sm text-surface-600 px-2 py-1.5 no-underline hover:underline">清除</a>` : ''}
        </form>`
    : '';

  const body = rows.map((row) => {
    const statusBadge = row.is_active
      ? '<span class="inline-block text-xs px-2 py-0.5 rounded bg-green-50 text-green-700">启用</span>'
      : '<span class="inline-block text-xs px-2 py-0.5 rounded bg-surface-100 text-surface-600">停用</span>';

    // Current values ride along as JSON so the single shared editor can be
    // populated client-side; rendering a form per row made this page ~900KB.
    const values: Record<string, string> = {};
    for (const f of editableFields) {
      const raw = row[f.column];
      values[f.key] = raw === null || raw === undefined ? '' : String(raw);
    }

    return `
      <tr class="border-b border-surface-100 align-top" data-row="${row.id}" data-values="${escapeHtml(JSON.stringify(values))}">
        <td class="py-3 pr-3 text-sm text-surface-500">${row.id}</td>
        ${fields.map((f) => `<td class="py-3 pr-3 text-sm text-surface-700">${cell(row, f)}</td>`).join('')}
        <td class="py-3 pr-3 text-sm text-surface-700">${row.job_count}</td>
        <td class="py-3 pr-3">${statusBadge}</td>
        <td class="py-3 whitespace-nowrap">
          <button type="button" data-edit="${row.id}" class="text-xs text-brand-500 hover:underline mr-3">编辑</button>
          <button type="button" data-toggle="${row.id}" class="text-xs text-surface-600 hover:underline">${row.is_active ? '停用' : '启用'}</button>
        </td>
      </tr>`;
  }).join('');

  // One editor row, moved under whichever row is being edited.
  const editorRow = `
      <tr class="hidden border-b border-surface-100 bg-surface-50" data-editor>
        <td colspan="${colSpan}" class="py-3 px-3">
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-form="edit">
            ${editableFields.map((f) => `
              <label class="block text-xs text-surface-600">
                <span class="block mb-1">${escapeHtml(f.label)}</span>
                ${input(f, null)}
              </label>`).join('')}
          </div>
          <div class="mt-3 flex items-center gap-3">
            <button type="button" data-save class="text-sm bg-brand-500 text-white rounded px-3 py-1.5 hover:bg-brand-600 transition">保存</button>
            <button type="button" data-cancel class="text-sm text-surface-600 hover:underline">取消</button>
          </div>
        </td>
      </tr>`;

  const createFields = fields.filter((f) => f.editable !== false || f.key === 'code');

  const inner = `
      <div class="bg-white rounded shadow-sm border border-surface-200 p-6">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h1 class="text-2xl font-bold">${escapeHtml(title)}</h1>
          <span class="text-sm text-surface-500">${summary}</span>
        </div>
        <p class="text-sm text-surface-600 mb-4">${escapeHtml(hint)}</p>
        ${searchBox}

        <details class="mb-5 border border-surface-200 rounded">
          <summary class="cursor-pointer px-4 py-2 text-sm text-surface-700">新增</summary>
          <div class="px-4 pb-4 pt-2">
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-form="new">
              ${createFields.map((f) => `
                <label class="block text-xs text-surface-600">
                  <span class="block mb-1">${escapeHtml(f.label)}</span>
                  ${input(f, null)}
                </label>`).join('')}
            </div>
            <button type="button" data-create class="mt-3 text-sm bg-brand-500 text-white rounded px-3 py-1.5 hover:bg-brand-600 transition">创建</button>
          </div>
        </details>

        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="border-b border-surface-200 text-xs text-surface-500 uppercase tracking-wide">
                <th class="py-2 pr-3 font-medium">ID</th>
                ${fields.map((f) => `<th class="py-2 pr-3 font-medium">${escapeHtml(f.label)}</th>`).join('')}
                <th class="py-2 pr-3 font-medium">职位数</th>
                <th class="py-2 pr-3 font-medium">状态</th>
                <th class="py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              ${body || `<tr><td colspan="${colSpan}" class="py-6 text-center text-sm text-surface-400">暂无记录</td></tr>`}
              ${editorRow}
            </tbody>
          </table>
        </div>
        ${pager}
      </div>

      <script>
      (function () {
        var base = ${JSON.stringify(apiBase)};

        function collect(scope) {
          var payload = {};
          scope.querySelectorAll('[data-field]').forEach(function (el) {
            payload[el.getAttribute('data-field')] = el.value;
          });
          return payload;
        }

        async function post(url, payload, btn) {
          var original = btn.textContent;
          btn.disabled = true;
          btn.textContent = '处理中…';
          try {
            var res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload || {}),
            });
            var data = await res.json().catch(function () { return {}; });
            if (res.ok) { window.location.reload(); return; }
            alert(data.error || '操作失败');
          } catch (e) {
            alert('操作失败');
          }
          btn.disabled = false;
          btn.textContent = original;
        }

        var editor = document.querySelector('[data-editor]');
        var editForm = document.querySelector('[data-form="edit"]');
        var editingId = null;

        function closeEditor() {
          editingId = null;
          if (editor) editor.classList.add('hidden');
        }

        function openEditor(id) {
          var row = document.querySelector('[data-row="' + id + '"]');
          if (!row || !editor || !editForm) return;
          if (editingId === id) { closeEditor(); return; }

          var values = {};
          try { values = JSON.parse(row.getAttribute('data-values') || '{}'); } catch (e) {}
          editForm.querySelectorAll('[data-field]').forEach(function (el) {
            el.value = values[el.getAttribute('data-field')] || '';
          });

          editingId = id;
          row.insertAdjacentElement('afterend', editor);
          editor.classList.remove('hidden');
        }

        document.addEventListener('click', function (ev) {
          var el = ev.target;
          if (!(el instanceof HTMLElement)) return;

          var editId = el.getAttribute('data-edit');
          if (editId) { openEditor(editId); return; }

          if (el.hasAttribute('data-cancel')) { closeEditor(); return; }

          if (el.hasAttribute('data-save')) {
            if (editingId && editForm) post(base + '/' + editingId, collect(editForm), el);
            return;
          }

          var toggleId = el.getAttribute('data-toggle');
          if (toggleId) {
            post(base + '/' + toggleId + '/toggle', {}, el);
            return;
          }

          if (el.hasAttribute('data-create')) {
            var newForm = document.querySelector('[data-form="new"]');
            if (newForm) post(base, collect(newForm), el);
          }
        });
      })();
      </script>`;

  const content = `${bc}${adminShell(path, inner, user)}`;

  return layout(`${title} - 远程岛`, content, {
    gaId: options.gaId,
    staticUrl: options.staticUrl,
    description: options.description,
    activePath: path,
    user,
  });
}
