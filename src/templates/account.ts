import { AuthUser } from '../types';
import { layout } from './layout';
import { breadcrumb, escapeHtml } from '../utils/helpers';
import { userCenterShell } from './userCenter';
import { SALARY_OPTIONS, salaryLabel } from '../constants/salary';
import { SUBSCRIPTION_KINDS, subscriptionKindLabel, KEYWORD_QUERY_MAX_LENGTH } from '../constants/subscriptions';

export type AccountSubscription = {
  id: number;
  kind: string;
  search_term_id: number | null;
  query_text: string | null;
  company_id: number | null;
  location_id: number | null;
  salary_range: string | null;
  notify_email: number;
  notify_telegram: number;
  term_cn: string | null;
  company_name: string | null;
  location_name_cn: string | null;
};

export type AccountSearchTerm = { id: number; term_cn: string; slug: string };
export type AccountLocation = { id: number; name_cn: string; slug: string };

export type AccountPrefill = {
  kind?: string | null;
  searchTermId?: number | null;
  searchTermLabel?: string | null;
  queryText?: string | null;
  companyId?: number | null;
  companyLabel?: string | null;
  locationId?: number | null;
  locationLabel?: string | null;
  salaryRange?: string | null;
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

  const describeTarget = (s: AccountSubscription): string => {
    if (s.kind === 'keyword') return `关键词「${escapeHtml(s.query_text || '')}」`;
    if (s.kind === 'company') return `公司 ${escapeHtml(s.company_name || '')}`;
    return escapeHtml(s.term_cn || '职位');
  };

  const subscriptionRows = subscriptions.length > 0
    ? subscriptions.map((s) => `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 border-b border-surface-100 last:border-0"
             data-subscription-id="${s.id}"
             data-kind="${escapeHtml(s.kind)}"
             data-term-id="${s.search_term_id ?? ''}"
             data-term-label="${escapeHtml(s.term_cn || '')}"
             data-query-text="${escapeHtml(s.query_text || '')}"
             data-company-id="${s.company_id ?? ''}"
             data-company-label="${escapeHtml(s.company_name || '')}"
             data-location-id="${s.location_id ?? ''}"
             data-location-label="${escapeHtml(s.location_name_cn || '')}"
             data-salary-range="${escapeHtml(s.salary_range || '')}"
             data-notify-email="${s.notify_email ? '1' : '0'}"
             data-notify-telegram="${s.notify_telegram ? '1' : '0'}">
          <div class="text-sm min-w-0">
            <div class="font-medium text-surface-900 flex flex-wrap items-center gap-2">
              <span class="tag-pill bg-surface-100 text-surface-600 text-xs">${escapeHtml(subscriptionKindLabel(s.kind))}</span>
              ${describeTarget(s)}
            </div>
            <div class="text-surface-500 mt-0.5">
              ${s.location_name_cn ? escapeHtml(s.location_name_cn) : '不限地点'}
              · 薪资${escapeHtml(salaryLabel(s.salary_range))}
              · ${s.notify_email ? '邮件' : ''}${s.notify_email && s.notify_telegram ? ' / ' : ''}${s.notify_telegram ? 'Telegram' : ''}
            </div>
          </div>
          <div class="flex items-center gap-3 self-start sm:self-auto flex-shrink-0">
            <button type="button" class="subscription-test text-sm text-surface-500 hover:text-brand-600">发送测试</button>
            <button type="button" class="subscription-edit text-sm text-brand-500 hover:text-brand-600">编辑</button>
            <button type="button" class="subscription-delete text-sm text-red-500 hover:text-red-600">删除</button>
          </div>
        </div>
      `).join('')
    : `<p class="text-sm text-surface-500 py-4">暂无订阅。添加后，匹配的新职位会通过邮件（每天早上）或 Telegram（实时）通知你。</p>`;

  const comboboxData = {
    searchTermId: searchTerms.map((t) => ({ id: t.id, label: t.term_cn })),
    locationId: [{ id: 0, label: '不限地点' }, ...locations.map((l) => ({ id: l.id, label: l.name_cn }))],
  };

  const kindTabs = SUBSCRIPTION_KINDS.map((k) =>
    `<button type="button" data-kind="${k.value}" class="kind-tab px-3 py-1.5 rounded text-sm border transition">${escapeHtml(k.label)}</button>`
  ).join('');

  const combobox = (name: string, placeholder: string, remote = false) => `
    <div class="combobox relative" data-name="${name}" ${remote ? 'data-remote="/api/companies/search"' : ''}>
      <input type="hidden" name="${name}" value="">
      <input type="text" data-combobox-input placeholder="${escapeHtml(placeholder)}" autocomplete="off"
        class="w-full border border-surface-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-400">
      <button type="button" data-combobox-clear tabindex="-1" aria-label="清除"
        class="hidden absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 text-lg leading-none">×</button>
      <ul data-combobox-list class="hidden absolute z-20 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-surface-200 rounded shadow-lg py-1"></ul>
    </div>`;

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
          <div class="flex flex-wrap items-center gap-3 pt-2">
            <span class="text-surface-400">周报</span>
            <label class="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="weekly-digest-toggle" class="rounded border-surface-300" ${user.weekly_digest ? 'checked' : ''}>
              <span>每周一早上发送远程岛周报到邮箱</span>
            </label>
            <span id="weekly-digest-status" class="text-xs text-surface-400"></span>
            <a href="/weekly" class="text-xs text-brand-500 hover:text-brand-600 no-underline">查看最新一期</a>
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
          <input type="hidden" name="kind" id="subscription-kind" value="category">
          <div class="flex items-center justify-between">
            <h3 id="subscription-form-title" class="text-sm font-semibold text-surface-800">添加订阅</h3>
            <button type="button" id="subscription-cancel" class="hidden text-sm text-surface-500 hover:text-surface-700">取消编辑</button>
          </div>
          <p id="subscription-message" class="hidden text-sm"></p>

          <div class="flex flex-wrap gap-2" id="kind-tabs">${kindTabs}</div>

          <div data-kind-panel="category">
            <label class="block text-sm text-surface-600 mb-1">职位（必选）</label>
            ${combobox('searchTermId', '搜索职位')}
          </div>
          <div data-kind-panel="keyword" class="hidden">
            <label class="block text-sm text-surface-600 mb-1">关键词（必填）</label>
            <input type="text" name="queryText" maxlength="${KEYWORD_QUERY_MAX_LENGTH}" placeholder="例如：AI infra、日语、Rust、Web3 产品经理"
              class="w-full border border-surface-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-400">
            <p class="text-xs text-surface-400 mt-1">按语义匹配新职位的标题与描述，不局限于固定职位。</p>
          </div>
          <div data-kind-panel="company" class="hidden">
            <label class="block text-sm text-surface-600 mb-1">公司（必选）</label>
            ${combobox('companyId', '输入公司名搜索', true)}
            <p class="text-xs text-surface-400 mt-1">该公司发布任何新的远程职位都会通知你。</p>
          </div>

          <div>
            <label class="block text-sm text-surface-600 mb-1">地点（可选）</label>
            ${combobox('locationId', '搜索地点，留空为不限')}
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
              邮件通知（每天早上汇总）
            </label>
            <label class="inline-flex items-center gap-2">
              <input type="checkbox" name="notifyTelegram" class="rounded border-surface-300" ${user.telegram_chat_id ? '' : 'disabled'}>
              Telegram 通知（实时）${user.telegram_chat_id ? '' : '（需先绑定）'}
            </label>
          </div>
          <button type="submit" id="subscription-submit" class="bg-brand-500 text-white rounded px-4 py-2 text-sm font-medium hover:bg-brand-600 transition">添加订阅</button>
        </form>
      </div>
    <script>
      window.__comboboxData = ${JSON.stringify(comboboxData)};
      window.__subscriptionPrefill = ${JSON.stringify(prefill || null)};
    </script>
    <script>
      (function() {
        var comboboxData = window.__comboboxData || {};

        function initCombobox(el) {
          var name = el.getAttribute('data-name');
          var remote = el.getAttribute('data-remote');
          var options = comboboxData[name] || [];
          var input = el.querySelector('[data-combobox-input]');
          var hidden = el.querySelector('input[type="hidden"]');
          var list = el.querySelector('[data-combobox-list]');
          var clear = el.querySelector('[data-combobox-clear]');
          var activeIndex = -1;
          var visible = [];
          var remoteTimer = null;

          function paint() {
            if (visible.length === 0) {
              list.innerHTML = '<li class="px-3 py-2 text-sm text-surface-400">' + (remote ? '输入关键字搜索' : '无匹配项') + '</li>';
            } else {
              list.innerHTML = visible.map(function(o, i) {
                var li = document.createElement('li');
                li.className = 'combobox-option px-3 py-2 text-sm cursor-pointer hover:bg-brand-50' + (i === activeIndex ? ' bg-brand-50' : '');
                li.setAttribute('data-value', String(o.id));
                li.textContent = o.label + (o.extra ? ' ' : '');
                if (o.extra) { var sp = document.createElement('span'); sp.className = 'text-xs text-surface-400'; sp.textContent = o.extra; li.appendChild(sp); }
                return li.outerHTML;
              }).join('');
            }
            list.classList.remove('hidden');
          }

          function render(filter) {
            var q = (filter || '').toLowerCase().trim();
            if (remote) {
              if (remoteTimer) clearTimeout(remoteTimer);
              if (!q) { visible = []; paint(); return; }
              remoteTimer = setTimeout(function() {
                fetch(remote + '?q=' + encodeURIComponent(q)).then(function(r) { return r.json(); }).then(function(data) {
                  visible = (data.companies || []).map(function(c) { return { id: c.id, label: c.name, extra: c.job_count + ' 个职位' }; });
                  paint();
                }).catch(function() { visible = []; paint(); });
              }, 180);
              return;
            }
            visible = options.filter(function(o) {
              return !q || String(o.label).toLowerCase().indexOf(q) !== -1;
            }).slice(0, 100);
            paint();
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

          input.addEventListener('focus', function() { activeIndex = -1; render(input.value); });
          input.addEventListener('input', function() {
            hidden.value = '';
            activeIndex = -1;
            render(input.value);
            if (clear) clear.classList.toggle('hidden', !input.value);
          });
          input.addEventListener('blur', function() { setTimeout(function() { list.classList.add('hidden'); }, 150); });
          input.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, visible.length - 1); paint(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); paint(); }
            else if (e.key === 'Enter') { if (!list.classList.contains('hidden') && activeIndex >= 0) { e.preventDefault(); selectByIndex(activeIndex); } }
            else if (e.key === 'Escape') { list.classList.add('hidden'); }
          });
          list.addEventListener('mousedown', function(e) {
            var target = e.target.closest('[data-value]');
            if (!target) return;
            e.preventDefault();
            var value = target.getAttribute('data-value');
            for (var i = 0; i < visible.length; i++) { if (String(visible[i].id) === value) { selectByIndex(i); break; } }
          });
          if (clear) {
            clear.addEventListener('click', function() { hidden.value = ''; input.value = ''; clear.classList.add('hidden'); input.focus(); });
          }

          el.__setValue = function(id, label) {
            if (id == null || id === '' || id === 0 || id === '0') { hidden.value = ''; input.value = ''; }
            else { hidden.value = String(id); input.value = label || ''; }
            if (clear) clear.classList.toggle('hidden', !input.value);
            list.classList.add('hidden');
          };
        }

        var termCombo = document.querySelector('.combobox[data-name="searchTermId"]');
        var locationCombo = document.querySelector('.combobox[data-name="locationId"]');
        var companyCombo = document.querySelector('.combobox[data-name="companyId"]');
        if (termCombo) initCombobox(termCombo);
        if (locationCombo) initCombobox(locationCombo);
        if (companyCombo) initCombobox(companyCombo);

        var form = document.getElementById('subscription-form');
        var idInput = document.getElementById('subscription-id');
        var kindInput = document.getElementById('subscription-kind');
        var titleEl = document.getElementById('subscription-form-title');
        var submitBtn = document.getElementById('subscription-submit');
        var cancelBtn = document.getElementById('subscription-cancel');
        var messageEl = document.getElementById('subscription-message');
        var list = document.getElementById('subscription-list');
        var kindTabs = document.querySelectorAll('.kind-tab');

        function setKind(kind) {
          kindInput.value = kind;
          kindTabs.forEach(function(tab) {
            var active = tab.dataset.kind === kind;
            tab.className = 'kind-tab px-3 py-1.5 rounded text-sm border transition ' + (active ? 'border-brand-500 bg-brand-50 text-brand-600 font-medium' : 'border-surface-200 text-surface-600 hover:bg-surface-50');
          });
          document.querySelectorAll('[data-kind-panel]').forEach(function(panel) {
            panel.classList.toggle('hidden', panel.dataset.kindPanel !== kind);
          });
        }
        kindTabs.forEach(function(tab) { tab.addEventListener('click', function() { setKind(tab.dataset.kind); }); });

        function showMessage(text, isError) {
          messageEl.textContent = text;
          messageEl.className = 'text-sm ' + (isError ? 'text-red-600' : 'text-green-600');
          messageEl.classList.remove('hidden');
        }

        function resetForm() {
          idInput.value = '';
          setKind('category');
          if (termCombo) termCombo.__setValue('', '');
          if (locationCombo) locationCombo.__setValue('', '');
          if (companyCombo) companyCombo.__setValue('', '');
          form.queryText.value = '';
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
          setKind(row.getAttribute('data-kind') || 'category');
          if (termCombo) termCombo.__setValue(row.getAttribute('data-term-id'), row.getAttribute('data-term-label'));
          if (companyCombo) companyCombo.__setValue(row.getAttribute('data-company-id'), row.getAttribute('data-company-label'));
          form.queryText.value = row.getAttribute('data-query-text') || '';
          if (locationCombo) locationCombo.__setValue(row.getAttribute('data-location-id'), row.getAttribute('data-location-label'));
          form.salaryRange.value = row.getAttribute('data-salary-range') || '';
          form.notifyEmail.checked = row.getAttribute('data-notify-email') === '1';
          if (!form.notifyTelegram.disabled) form.notifyTelegram.checked = row.getAttribute('data-notify-telegram') === '1';
          titleEl.textContent = '编辑订阅';
          submitBtn.textContent = '保存修改';
          cancelBtn.classList.remove('hidden');
          messageEl.classList.add('hidden');
          form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        cancelBtn.addEventListener('click', resetForm);
        setKind('category');

        var prefill = window.__subscriptionPrefill;
        if (prefill) {
          if (prefill.kind) setKind(prefill.kind);
          if (termCombo && prefill.searchTermId) termCombo.__setValue(prefill.searchTermId, prefill.searchTermLabel || '');
          if (companyCombo && prefill.companyId) companyCombo.__setValue(prefill.companyId, prefill.companyLabel || '');
          if (prefill.queryText) form.queryText.value = prefill.queryText;
          if (locationCombo && prefill.locationId) locationCombo.__setValue(prefill.locationId, prefill.locationLabel || '');
          if (prefill.salaryRange) form.salaryRange.value = prefill.salaryRange;
          form.scrollIntoView({ behavior: 'smooth', block: 'center' });
          var focusEl = prefill.kind === 'keyword' ? form.queryText : (prefill.kind === 'company' ? companyCombo : termCombo);
          if (focusEl) { var fi = focusEl.querySelector ? focusEl.querySelector('[data-combobox-input]') : focusEl; if (fi && !fi.value) fi.focus(); }
        }

        var weeklyToggle = document.getElementById('weekly-digest-toggle');
        var weeklyStatus = document.getElementById('weekly-digest-status');
        if (weeklyToggle) {
          weeklyToggle.addEventListener('change', async function() {
            weeklyToggle.disabled = true;
            try {
              var res = await fetch('/api/account/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ weeklyDigest: weeklyToggle.checked }) });
              weeklyStatus.textContent = res.ok ? (weeklyToggle.checked ? '已开启' : '已关闭') : '保存失败';
            } catch (e) { weeklyStatus.textContent = '保存失败'; }
            finally { weeklyToggle.disabled = false; setTimeout(function() { weeklyStatus.textContent = ''; }, 1500); }
          });
        }

        var linkBtn = document.getElementById('telegram-link');
        if (linkBtn) {
          linkBtn.addEventListener('click', async function() {
            var response = await fetch('/api/telegram/link-token', { method: 'POST' });
            var data = await response.json().catch(function() { return {}; });
            if (!response.ok) { alert(data.error || '生成绑定链接失败'); return; }
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
          var kind = kindInput.value;
          var payload = {
            kind: kind,
            searchTermId: form.searchTermId.value ? Number(form.searchTermId.value) : null,
            queryText: form.queryText.value.trim() || null,
            companyId: form.companyId.value ? Number(form.companyId.value) : null,
            locationId: form.locationId.value ? Number(form.locationId.value) : null,
            salaryRange: form.salaryRange.value || null,
            notifyEmail: form.notifyEmail.checked,
            notifyTelegram: form.notifyTelegram.checked
          };
          if (kind === 'category' && !payload.searchTermId) { showMessage('请选择职位', true); return; }
          if (kind === 'keyword' && (!payload.queryText || payload.queryText.length < 2)) { showMessage('请输入至少 2 个字符的关键词', true); return; }
          if (kind === 'company' && !payload.companyId) { showMessage('请选择公司', true); return; }
          var id = idInput.value;
          var url = id ? ('/api/subscriptions/' + id) : '/api/subscriptions';
          var response = await fetch(url, { method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          var data = await response.json().catch(function() { return {}; });
          if (!response.ok) { showMessage(data.error || (id ? '保存失败' : '添加失败'), true); return; }
          window.location.href = '/account';
        });

        list.addEventListener('click', async function(event) {
          var editBtn = event.target.closest('.subscription-edit');
          if (editBtn) { var row = editBtn.closest('[data-subscription-id]'); if (row) loadForEdit(row); return; }
          var testBtn = event.target.closest('.subscription-test');
          if (testBtn) {
            var row2 = testBtn.closest('[data-subscription-id]');
            var id2 = row2 && row2.getAttribute('data-subscription-id');
            if (!id2) return;
            var original = testBtn.textContent;
            testBtn.disabled = true; testBtn.textContent = '发送中…';
            try {
              var response = await fetch('/api/subscriptions/' + id2 + '/test', { method: 'POST' });
              var data = await response.json().catch(function() { return {}; });
              if (!response.ok) alert(data.error || '发送失败');
              else { var msg = '已通过 ' + (data.channels || []).join('、') + ' 发送：' + (data.jobTitle || ''); if (data.warning) msg += '\\n' + data.warning; alert(msg); }
            } finally { testBtn.disabled = false; testBtn.textContent = original; }
            return;
          }
          var deleteBtn = event.target.closest('.subscription-delete');
          if (deleteBtn) {
            var row3 = deleteBtn.closest('[data-subscription-id]');
            var id3 = row3 && row3.getAttribute('data-subscription-id');
            if (!id3) return;
            if (!confirm('删除该订阅？')) return;
            var response2 = await fetch('/api/subscriptions/' + id3, { method: 'DELETE' });
            if (response2.ok) { row3.remove(); if (idInput.value === id3) resetForm(); }
          }
        });
      })();
    </script>`;

  const content = `${bc}${userCenterShell('/account', inner, user)}`;

  return layout('我的 - 远程岛', content, {
    gaId: options.gaId,
    staticUrl: options.staticUrl,
    description: '管理远程岛账户、职位订阅、周报与 Telegram 绑定。',
    activePath: '/account',
    user,
  });
}
