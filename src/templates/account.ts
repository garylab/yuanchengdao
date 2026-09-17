import { AuthUser } from '../types';
import { layout } from './layout';
import { breadcrumb, escapeHtml } from '../utils/helpers';
import { userCenterShell } from './userCenter';
import { SALARY_OPTIONS, salaryLabel } from '../constants/salary';

export type AccountSubscription = {
  id: number;
  search_term_id: number;
  location_id: number | null;
  salary_range: string | null;
  notify_email: number;
  notify_telegram: number;
  term_cn: string | null;
  location_name_cn: string | null;
};

export type AccountPrefill = {
  locationId?: number | null;
  locationLabel?: string | null;
  salaryRange?: string | null;
};

export type AccountSearchTerm = {
  id: number;
  term_cn: string;
  slug: string;
};

export type AccountLocation = {
  id: number;
  name_cn: string;
  slug: string;
};

export function accountPage(options: {
  user: AuthUser;
  subscriptions: AccountSubscription[];
  searchTerms: AccountSearchTerm[];
  locations: AccountLocation[];
  prefill?: AccountPrefill;
  gaId?: string;
  staticUrl?: string;
}): string {
  const { user, subscriptions, searchTerms, locations, prefill } = options;
  const bc = breadcrumb([
    { label: '首页', href: '/' },
    { label: '我的', href: '/account' },
  ]);

  const telegramStatus = user.telegram_chat_id
    ? `<span class="text-green-600 text-sm">已绑定</span>
       <button type="button" id="telegram-unlink" class="ml-3 text-sm text-surface-500 hover:text-red-600">解除绑定</button>`
    : `<button type="button" id="telegram-link" class="text-sm text-brand-500 hover:text-brand-600">绑定 Telegram</button>
       <p id="telegram-link-hint" class="hidden mt-2 text-xs text-surface-500"></p>`;

  const subscriptionRows = subscriptions.length > 0
    ? subscriptions.map((subscription) => `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 border-b border-surface-100 last:border-0"
             data-subscription-id="${subscription.id}"
             data-term-id="${subscription.search_term_id}"
             data-term-label="${escapeHtml(subscription.term_cn || '')}"
             data-location-id="${subscription.location_id ?? ''}"
             data-location-label="${escapeHtml(subscription.location_name_cn || '')}"
             data-salary-range="${escapeHtml(subscription.salary_range || '')}"
             data-notify-email="${subscription.notify_email ? '1' : '0'}"
             data-notify-telegram="${subscription.notify_telegram ? '1' : '0'}">
          <div class="text-sm">
            <div class="font-medium text-surface-900">${escapeHtml(subscription.term_cn || '分类')}</div>
            <div class="text-surface-500 mt-0.5">
              ${subscription.location_name_cn ? escapeHtml(subscription.location_name_cn) : '不限地点'}
              · 薪资${escapeHtml(salaryLabel(subscription.salary_range))}
              · ${subscription.notify_email ? '邮件' : ''}${subscription.notify_email && subscription.notify_telegram ? ' / ' : ''}${subscription.notify_telegram ? 'Telegram' : ''}
            </div>
          </div>
          <div class="flex items-center gap-3 self-start sm:self-auto">
            <button type="button" class="subscription-test text-sm text-surface-500 hover:text-brand-600">发送测试</button>
            <button type="button" class="subscription-edit text-sm text-brand-500 hover:text-brand-600">编辑</button>
            <button type="button" class="subscription-delete text-sm text-red-500 hover:text-red-600">删除</button>
          </div>
        </div>
      `).join('')
    : `<p class="text-sm text-surface-500 py-4">暂无订阅。添加后，匹配的新职位会通知你。</p>`;

  const comboboxData = {
    searchTermId: searchTerms.map((t) => ({ id: t.id, label: t.term_cn })),
    locationId: [
      { id: 0, label: '不限地点' },
      ...locations.map((l) => ({ id: l.id, label: l.name_cn })),
    ],
  };

  const inner = `
      <div class="bg-white rounded shadow-sm border border-surface-200 p-6">
        <h1 class="text-2xl font-bold mb-4">我的</h1>
        <div class="text-sm text-surface-600 space-y-2">
          <div><span class="text-surface-400">邮箱</span> · ${escapeHtml(user.email)}</div>
          ${user.name ? `<div><span class="text-surface-400">昵称</span> · ${escapeHtml(user.name)}</div>` : ''}
          <div class="flex flex-wrap items-center gap-2 pt-2">
            <span class="text-surface-400">Telegram</span>
            ${telegramStatus}
          </div>
        </div>
        <form method="post" action="/api/auth/logout" class="mt-6">
          <button type="submit" class="text-sm text-surface-500 hover:text-red-600">退出登录</button>
        </form>
      </div>

      <div class="bg-white rounded shadow-sm border border-surface-200 p-6">
        <h2 class="text-lg font-bold mb-4">职位订阅</h2>
        <div id="subscription-list">${subscriptionRows}</div>

        <form id="subscription-form" class="mt-6 pt-6 border-t border-surface-100 space-y-3">
          <input type="hidden" id="subscription-id" value="">
          <div class="flex items-center justify-between">
            <h3 id="subscription-form-title" class="text-sm font-semibold text-surface-800">添加订阅</h3>
            <button type="button" id="subscription-cancel" class="hidden text-sm text-surface-500 hover:text-surface-700">取消编辑</button>
          </div>
          <p id="subscription-message" class="hidden text-sm"></p>
          <div>
            <label class="block text-sm text-surface-600 mb-1">职位分类（必选）</label>
            <div class="combobox relative" data-name="searchTermId">
              <input type="hidden" name="searchTermId" value="">
              <input type="text" data-combobox-input placeholder="搜索职位分类" autocomplete="off"
                class="w-full border border-surface-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-400">
              <button type="button" data-combobox-clear tabindex="-1" aria-label="清除"
                class="hidden absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 text-lg leading-none">×</button>
              <ul data-combobox-list class="hidden absolute z-20 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-surface-200 rounded shadow-lg py-1"></ul>
            </div>
          </div>
          <div>
            <label class="block text-sm text-surface-600 mb-1">地点（可选）</label>
            <div class="combobox relative" data-name="locationId">
              <input type="hidden" name="locationId" value="">
              <input type="text" data-combobox-input placeholder="搜索地点，留空为不限" autocomplete="off"
                class="w-full border border-surface-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-400">
              <button type="button" data-combobox-clear tabindex="-1" aria-label="清除"
                class="hidden absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 text-lg leading-none">×</button>
              <ul data-combobox-list class="hidden absolute z-20 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-surface-200 rounded shadow-lg py-1"></ul>
            </div>
          </div>
          <div>
            <label class="block text-sm text-surface-600 mb-1">薪资（可选）</label>
            <select name="salaryRange" class="w-full border border-surface-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-400">
              ${SALARY_OPTIONS.map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('')}
            </select>
          </div>
          <div class="flex flex-wrap gap-4 text-sm">
            <label class="inline-flex items-center gap-2">
              <input type="checkbox" name="notifyEmail" checked class="rounded border-surface-300">
              邮件通知
            </label>
            <label class="inline-flex items-center gap-2">
              <input type="checkbox" name="notifyTelegram" class="rounded border-surface-300" ${user.telegram_chat_id ? '' : 'disabled'}>
              Telegram 通知 ${user.telegram_chat_id ? '' : '（需先绑定）'}
            </label>
          </div>
          <button type="submit" id="subscription-submit" class="bg-brand-500 text-white rounded px-4 py-2 text-sm font-medium hover:bg-brand-600 transition">添加订阅</button>
        </form>
      </div>
    <script>
      window.__comboboxData = ${JSON.stringify(comboboxData)};
    </script>
    <script>
      (function() {
        var comboboxData = window.__comboboxData || {};

        function initCombobox(el) {
          var name = el.getAttribute('data-name');
          var options = comboboxData[name] || [];
          var input = el.querySelector('[data-combobox-input]');
          var hidden = el.querySelector('input[type="hidden"]');
          var list = el.querySelector('[data-combobox-list]');
          var clear = el.querySelector('[data-combobox-clear]');
          var activeIndex = -1;
          var visible = [];

          function render(filter) {
            var q = (filter || '').toLowerCase().trim();
            visible = options.filter(function(o) {
              return !q || String(o.label).toLowerCase().indexOf(q) !== -1;
            }).slice(0, 100);
            if (visible.length === 0) {
              list.innerHTML = '<li class="px-3 py-2 text-sm text-surface-400">无匹配项</li>';
            } else {
              list.innerHTML = visible.map(function(o, i) {
                var li = document.createElement('li');
                li.className = 'combobox-option px-3 py-2 text-sm cursor-pointer hover:bg-brand-50' + (i === activeIndex ? ' bg-brand-50' : '');
                li.setAttribute('data-value', String(o.id));
                li.textContent = o.label;
                return li.outerHTML;
              }).join('');
            }
            list.classList.remove('hidden');
          }

          function selectByIndex(i) {
            if (i < 0 || i >= visible.length) return;
            var opt = visible[i];
            hidden.value = String(opt.id);
            input.value = opt.label;
            list.classList.add('hidden');
            activeIndex = -1;
            if (clear) clear.classList.toggle('hidden', !hidden.value);
          }

          input.addEventListener('focus', function() {
            activeIndex = -1;
            render(input.value);
          });
          input.addEventListener('input', function() {
            hidden.value = '';
            activeIndex = -1;
            render(input.value);
            if (clear) clear.classList.toggle('hidden', !input.value);
          });
          input.addEventListener('blur', function() {
            setTimeout(function() { list.classList.add('hidden'); }, 150);
          });
          input.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              if (list.classList.contains('hidden')) render(input.value);
              activeIndex = Math.min(activeIndex + 1, visible.length - 1);
              render(input.value);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              activeIndex = Math.max(activeIndex - 1, 0);
              render(input.value);
            } else if (e.key === 'Enter') {
              if (!list.classList.contains('hidden') && activeIndex >= 0) {
                e.preventDefault();
                selectByIndex(activeIndex);
              }
            } else if (e.key === 'Escape') {
              list.classList.add('hidden');
            }
          });
          list.addEventListener('mousedown', function(e) {
            var target = e.target.closest('[data-value]');
            if (!target) return;
            e.preventDefault();
            var value = target.getAttribute('data-value');
            for (var i = 0; i < visible.length; i++) {
              if (String(visible[i].id) === value) {
                selectByIndex(i);
                break;
              }
            }
          });
          if (clear) {
            clear.addEventListener('click', function() {
              hidden.value = '';
              input.value = '';
              clear.classList.add('hidden');
              input.focus();
            });
          }

          el.__setValue = function(id, label) {
            if (id == null || id === '' || id === 0 || id === '0') {
              hidden.value = '';
              input.value = '';
            } else {
              hidden.value = String(id);
              input.value = label || '';
            }
            if (clear) clear.classList.toggle('hidden', !input.value);
            list.classList.add('hidden');
          };
        }

        var termCombo = document.querySelector('.combobox[data-name="searchTermId"]');
        var locationCombo = document.querySelector('.combobox[data-name="locationId"]');
        if (termCombo) initCombobox(termCombo);
        if (locationCombo) initCombobox(locationCombo);

        var form = document.getElementById('subscription-form');
        var idInput = document.getElementById('subscription-id');
        var titleEl = document.getElementById('subscription-form-title');
        var submitBtn = document.getElementById('subscription-submit');
        var cancelBtn = document.getElementById('subscription-cancel');
        var messageEl = document.getElementById('subscription-message');
        var list = document.getElementById('subscription-list');

        function showMessage(text, isError) {
          messageEl.textContent = text;
          messageEl.className = 'text-sm ' + (isError ? 'text-red-600' : 'text-green-600');
          messageEl.classList.remove('hidden');
        }

        function resetForm() {
          idInput.value = '';
          if (termCombo) termCombo.__setValue('', '');
          if (locationCombo) locationCombo.__setValue('', '');
          form.salaryRange.value = '';
          form.notifyEmail.checked = true;
          if (!form.notifyTelegram.disabled) form.notifyTelegram.checked = false;
          titleEl.textContent = '添加订阅';
          submitBtn.textContent = '添加订阅';
          cancelBtn.classList.add('hidden');
          messageEl.classList.add('hidden');
        }

        function loadForEdit(row) {
          idInput.value = row.getAttribute('data-subscription-id');
          if (termCombo) termCombo.__setValue(row.getAttribute('data-term-id'), row.getAttribute('data-term-label'));
          if (locationCombo) {
            var locId = row.getAttribute('data-location-id');
            var locLabel = row.getAttribute('data-location-label');
            locationCombo.__setValue(locId, locLabel);
          }
          form.salaryRange.value = row.getAttribute('data-salary-range') || '';
          form.notifyEmail.checked = row.getAttribute('data-notify-email') === '1';
          if (!form.notifyTelegram.disabled) {
            form.notifyTelegram.checked = row.getAttribute('data-notify-telegram') === '1';
          }
          titleEl.textContent = '编辑订阅';
          submitBtn.textContent = '保存修改';
          cancelBtn.classList.remove('hidden');
          messageEl.classList.add('hidden');
          form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        cancelBtn.addEventListener('click', resetForm);

        var prefill = ${JSON.stringify(prefill || null)};
        if (prefill) {
          if (locationCombo && prefill.locationId) {
            locationCombo.__setValue(prefill.locationId, prefill.locationLabel || '');
          }
          if (prefill.salaryRange) {
            form.salaryRange.value = prefill.salaryRange;
          }
          if (termCombo) {
            var termInput = termCombo.querySelector('[data-combobox-input]');
            if (termInput) termInput.focus();
          }
          form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        var linkBtn = document.getElementById('telegram-link');
        if (linkBtn) {
          linkBtn.addEventListener('click', async function() {
            var response = await fetch('/api/telegram/link-token', { method: 'POST' });
            var data = await response.json().catch(function() { return {}; });
            if (!response.ok) {
              alert(data.error || '生成绑定链接失败');
              return;
            }
            var hint = document.getElementById('telegram-link-hint');
            if (hint) {
              hint.innerHTML = '打开 <a class="text-brand-500" href="' + data.deepLink + '" target="_blank" rel="noopener">Telegram 绑定</a>，点击 Start 完成。';
              hint.classList.remove('hidden');
            }
            window.open(data.deepLink, '_blank', 'noopener');
          });
        }

        var unlinkBtn = document.getElementById('telegram-unlink');
        if (unlinkBtn) {
          unlinkBtn.addEventListener('click', async function() {
            if (!confirm('确定解除 Telegram 绑定？')) return;
            var response = await fetch('/api/telegram/unlink', { method: 'POST' });
            if (response.ok) window.location.reload();
          });
        }

        form.addEventListener('submit', async function(event) {
          event.preventDefault();
          var searchTermId = Number(form.searchTermId.value);
          if (!searchTermId) {
            showMessage('请选择职位分类', true);
            return;
          }
          var locationId = form.locationId.value ? Number(form.locationId.value) : null;
          var payload = {
            searchTermId: searchTermId,
            locationId: locationId,
            salaryRange: form.salaryRange.value || null,
            notifyEmail: form.notifyEmail.checked,
            notifyTelegram: form.notifyTelegram.checked
          };
          var id = idInput.value;
          var url = id ? ('/api/subscriptions/' + id) : '/api/subscriptions';
          var method = id ? 'PATCH' : 'POST';
          var response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          var data = await response.json().catch(function() { return {}; });
          if (!response.ok) {
            showMessage(data.error || (id ? '保存失败' : '添加失败'), true);
            return;
          }
          window.location.reload();
        });

        list.addEventListener('click', async function(event) {
          var editBtn = event.target.closest('.subscription-edit');
          if (editBtn) {
            var row = editBtn.closest('[data-subscription-id]');
            if (row) loadForEdit(row);
            return;
          }
          var testBtn = event.target.closest('.subscription-test');
          if (testBtn) {
            var row = testBtn.closest('[data-subscription-id]');
            var id = row && row.getAttribute('data-subscription-id');
            if (!id) return;
            var original = testBtn.textContent;
            testBtn.disabled = true;
            testBtn.textContent = '发送中…';
            try {
              var response = await fetch('/api/subscriptions/' + id + '/test', { method: 'POST' });
              var data = await response.json().catch(function() { return {}; });
              if (!response.ok) {
                alert(data.error || '发送失败');
              } else {
                var channels = (data.channels || []).join('、');
                var msg = '已通过 ' + channels + ' 发送：' + (data.jobTitle || '');
                if (data.warning) msg += '\\n' + data.warning;
                alert(msg);
              }
            } finally {
              testBtn.disabled = false;
              testBtn.textContent = original;
            }
            return;
          }
          var deleteBtn = event.target.closest('.subscription-delete');
          if (deleteBtn) {
            var row = deleteBtn.closest('[data-subscription-id]');
            var id = row && row.getAttribute('data-subscription-id');
            if (!id) return;
            if (!confirm('删除该订阅？')) return;
            var response = await fetch('/api/subscriptions/' + id, { method: 'DELETE' });
            if (response.ok) {
              row.remove();
              if (idInput.value === id) resetForm();
            }
          }
        });
      })();
    </script>`;

  const content = `${bc}${userCenterShell('/account', inner, user)}`;

  return layout('我的 - 远程岛', content, {
    gaId: options.gaId,
    staticUrl: options.staticUrl,
    description: '管理远程岛账户、职位订阅与 Telegram 绑定。',
    activePath: '/account',
    user,
  });
}
