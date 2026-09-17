import { AuthUser } from '../types';
import { layout } from './layout';
import { breadcrumb, escapeHtml } from '../utils/helpers';

export type AccountSubscription = {
  id: number;
  search_term_id: number;
  location_id: number | null;
  notify_email: number;
  notify_telegram: number;
  term_cn: string | null;
  location_name_cn: string | null;
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
  gaId?: string;
  staticUrl?: string;
}): string {
  const { user, subscriptions, searchTerms, locations } = options;
  const bc = breadcrumb([
    { label: '首页', href: '/' },
    { label: '账户', href: '/account' },
  ]);

  const telegramStatus = user.telegram_chat_id
    ? `<span class="text-green-600 text-sm">已绑定</span>
       <button type="button" id="telegram-unlink" class="ml-3 text-sm text-surface-500 hover:text-red-600">解除绑定</button>`
    : `<button type="button" id="telegram-link" class="text-sm text-brand-500 hover:text-brand-600">绑定 Telegram</button>
       <p id="telegram-link-hint" class="hidden mt-2 text-xs text-surface-500"></p>`;

  const subscriptionRows = subscriptions.length > 0
    ? subscriptions.map((subscription) => `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 border-b border-surface-100 last:border-0" data-subscription-id="${subscription.id}">
          <div class="text-sm">
            <div class="font-medium text-surface-900">${escapeHtml(subscription.term_cn || '分类')}</div>
            <div class="text-surface-500 mt-0.5">
              ${subscription.location_name_cn ? escapeHtml(subscription.location_name_cn) : '不限地点'}
              · ${subscription.notify_email ? '邮件' : ''}${subscription.notify_email && subscription.notify_telegram ? ' / ' : ''}${subscription.notify_telegram ? 'Telegram' : ''}
            </div>
          </div>
          <button type="button" class="subscription-delete text-sm text-red-500 hover:text-red-600 self-start sm:self-auto">删除</button>
        </div>
      `).join('')
    : `<p class="text-sm text-surface-500 py-4">暂无订阅。添加后，匹配的新职位会通知你。</p>`;

  const termOptions = searchTerms.map((term) =>
    `<option value="${term.id}">${escapeHtml(term.term_cn)}</option>`
  ).join('');
  const locationOptions = locations.map((location) =>
    `<option value="${location.id}">${escapeHtml(location.name_cn)}</option>`
  ).join('');

  const content = `
    ${bc}
    <div class="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div class="bg-white rounded shadow-sm border border-surface-200 p-6">
        <h1 class="text-2xl font-bold mb-4">账户</h1>
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
          <p id="subscription-message" class="hidden text-sm"></p>
          <div>
            <label class="block text-sm text-surface-600 mb-1">职位分类（必选）</label>
            <select name="searchTermId" required class="w-full border border-surface-200 rounded px-3 py-2 text-sm">
              <option value="">选择分类</option>
              ${termOptions}
            </select>
          </div>
          <div>
            <label class="block text-sm text-surface-600 mb-1">地点（可选）</label>
            <select name="locationId" class="w-full border border-surface-200 rounded px-3 py-2 text-sm">
              <option value="">不限地点</option>
              ${locationOptions}
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
          <button type="submit" class="bg-brand-500 text-white rounded px-4 py-2 text-sm font-medium hover:bg-brand-600 transition">添加订阅</button>
        </form>
      </div>
    </div>
    <script>
      (function() {
        var messageEl = document.getElementById('subscription-message');
        function showMessage(text, isError) {
          messageEl.textContent = text;
          messageEl.className = 'text-sm ' + (isError ? 'text-red-600' : 'text-green-600');
          messageEl.classList.remove('hidden');
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

        document.getElementById('subscription-form').addEventListener('submit', async function(event) {
          event.preventDefault();
          var form = event.target;
          var payload = {
            searchTermId: Number(form.searchTermId.value),
            locationId: form.locationId.value ? Number(form.locationId.value) : null,
            notifyEmail: form.notifyEmail.checked,
            notifyTelegram: form.notifyTelegram.checked
          };
          var response = await fetch('/api/subscriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          var data = await response.json().catch(function() { return {}; });
          if (!response.ok) {
            showMessage(data.error || '添加失败', true);
            return;
          }
          window.location.reload();
        });

        document.getElementById('subscription-list').addEventListener('click', async function(event) {
          var btn = event.target.closest('.subscription-delete');
          if (!btn) return;
          var row = btn.closest('[data-subscription-id]');
          var id = row && row.getAttribute('data-subscription-id');
          if (!id) return;
          if (!confirm('删除该订阅？')) return;
          var response = await fetch('/api/subscriptions/' + id, { method: 'DELETE' });
          if (response.ok) row.remove();
        });
      })();
    </script>`;

  return layout('账户 - 远程岛', content, {
    gaId: options.gaId,
    staticUrl: options.staticUrl,
    description: '管理远程岛账户、职位订阅与 Telegram 绑定。',
    activePath: '/account',
    user,
  });
}
