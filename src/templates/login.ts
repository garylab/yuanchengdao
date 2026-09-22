import { layout } from './layout';
import { AuthUser } from '../types';
import { escapeHtml } from '../utils/helpers';

export function loginPage(options: {
  gaId?: string;
  staticUrl?: string;
  siteUrl?: string;
  turnstileSiteKey?: string;
  nextPath?: string;
  error?: string;
  user?: AuthUser | null;
}): string {
  const nextPath = options.nextPath && options.nextPath.startsWith('/') ? options.nextPath : '/';
  const turnstileSiteKey = options.turnstileSiteKey || '';
  const errorBanner = options.error
    ? `<div class="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">${escapeHtml(options.error)}</div>`
    : '';

  const content = `
    <div class="max-w-md mx-auto px-4 py-10">
      <div class="bg-white rounded shadow-sm border border-surface-200 p-6 sm:p-8">
        <h1 class="text-2xl font-bold text-surface-900 mb-1">登录远程岛</h1>
        <p class="text-sm text-surface-500 mb-6">收藏与订阅职位，第一时间收到新机会</p>
        ${errorBanner}

        <a href="/api/auth/google?next=${encodeURIComponent(nextPath)}"
          class="flex items-center justify-center gap-2 w-full border border-surface-200 rounded px-4 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-50 transition no-underline mb-6">
          <svg class="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          使用 Google 登录
        </a>

        <div class="relative mb-6">
          <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-surface-200"></div></div>
          <div class="relative flex justify-center text-xs"><span class="bg-white px-2 text-surface-400">或使用邮箱</span></div>
        </div>

        <div class="flex gap-2 mb-4 text-sm">
          <button type="button" data-auth-tab="password" class="auth-tab flex-1 py-2 rounded border border-brand-500 text-brand-600 font-medium bg-brand-50">密码登录</button>
          <button type="button" data-auth-tab="otp" class="auth-tab flex-1 py-2 rounded border border-surface-200 text-surface-600 hover:bg-surface-50">验证码登录</button>
          <button type="button" data-auth-tab="register" class="auth-tab flex-1 py-2 rounded border border-surface-200 text-surface-600 hover:bg-surface-50">注册</button>
        </div>

        <p id="auth-message" class="hidden mb-3 text-sm"></p>

        <form id="form-password" class="auth-panel space-y-3" data-mode="password">
          <input type="email" name="email" required placeholder="邮箱" autocomplete="email"
            class="w-full border border-surface-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-400">
          <input type="password" name="password" required placeholder="密码" autocomplete="current-password" minlength="8"
            class="w-full border border-surface-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-400">
          <div class="cf-turnstile" data-sitekey="${escapeHtml(turnstileSiteKey)}" data-theme="light"></div>
          <button type="submit" class="w-full bg-brand-500 text-white rounded py-2.5 text-sm font-semibold hover:bg-brand-600 transition">登录</button>
        </form>

        <form id="form-otp" class="auth-panel space-y-3 hidden" data-mode="otp">
          <input type="email" name="email" required placeholder="邮箱" autocomplete="email"
            class="w-full border border-surface-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-400">
          <div class="flex gap-2">
            <input type="text" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="6 位验证码"
              class="flex-1 border border-surface-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-400">
            <button type="button" id="otp-send-btn" class="px-3 py-2 rounded border border-surface-200 text-sm text-surface-700 hover:bg-surface-50 whitespace-nowrap">发送验证码</button>
          </div>
          <div class="cf-turnstile" data-sitekey="${escapeHtml(turnstileSiteKey)}" data-theme="light"></div>
          <button type="submit" class="w-full bg-brand-500 text-white rounded py-2.5 text-sm font-semibold hover:bg-brand-600 transition">验证并登录</button>
        </form>

        <form id="form-register" class="auth-panel space-y-3 hidden" data-mode="register">
          <input type="text" name="name" placeholder="昵称（可选）" autocomplete="nickname"
            class="w-full border border-surface-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-400">
          <input type="email" name="email" required placeholder="邮箱" autocomplete="email"
            class="w-full border border-surface-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-400">
          <input type="password" name="password" required placeholder="密码（至少 8 位）" autocomplete="new-password" minlength="8"
            class="w-full border border-surface-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-400">
          <div class="cf-turnstile" data-sitekey="${escapeHtml(turnstileSiteKey)}" data-theme="light"></div>
          <button type="submit" class="w-full bg-brand-500 text-white rounded py-2.5 text-sm font-semibold hover:bg-brand-600 transition">注册并登录</button>
        </form>
      </div>
    </div>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
    <script>
      (function() {
        var nextPath = ${JSON.stringify(nextPath)};
        var messageEl = document.getElementById('auth-message');
        var tabs = document.querySelectorAll('.auth-tab');
        var panels = document.querySelectorAll('.auth-panel');

        function showMessage(text, isError) {
          messageEl.textContent = text;
          messageEl.className = 'mb-3 text-sm ' + (isError ? 'text-red-600' : 'text-green-600');
          messageEl.classList.remove('hidden');
        }

        function getTurnstileToken(form) {
          var input = form.querySelector('input[name="cf-turnstile-response"]');
          return input ? input.value : '';
        }

        function resetTurnstile(form) {
          if (window.turnstile) {
            var widget = form.querySelector('.cf-turnstile');
            if (widget) window.turnstile.reset(widget);
          }
        }

        tabs.forEach(function(tab) {
          tab.addEventListener('click', function() {
            var mode = tab.getAttribute('data-auth-tab');
            tabs.forEach(function(item) {
              var active = item.getAttribute('data-auth-tab') === mode;
              item.className = active
                ? 'auth-tab flex-1 py-2 rounded border border-brand-500 text-brand-600 font-medium bg-brand-50'
                : 'auth-tab flex-1 py-2 rounded border border-surface-200 text-surface-600 hover:bg-surface-50';
            });
            panels.forEach(function(panel) {
              panel.classList.toggle('hidden', panel.getAttribute('data-mode') !== mode);
            });
            messageEl.classList.add('hidden');
          });
        });

        document.getElementById('form-password').addEventListener('submit', async function(event) {
          event.preventDefault();
          var form = event.target;
          var payload = {
            email: form.email.value,
            password: form.password.value,
            turnstileToken: getTurnstileToken(form)
          };
          var response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          var data = await response.json().catch(function() { return {}; });
          if (!response.ok) {
            showMessage(data.error || '登录失败', true);
            resetTurnstile(form);
            return;
          }
          window.location.href = nextPath;
        });

        document.getElementById('otp-send-btn').addEventListener('click', async function() {
          var form = document.getElementById('form-otp');
          var email = form.email.value;
          if (!email) { showMessage('请先填写邮箱', true); return; }
          var response = await fetch('/api/auth/otp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, turnstileToken: getTurnstileToken(form) })
          });
          var data = await response.json().catch(function() { return {}; });
          if (!response.ok) {
            showMessage(data.error || '发送失败', true);
            resetTurnstile(form);
            return;
          }
          showMessage('验证码已发送，请查收邮箱', false);
          resetTurnstile(form);
        });

        document.getElementById('form-otp').addEventListener('submit', async function(event) {
          event.preventDefault();
          var form = event.target;
          var response = await fetch('/api/auth/otp/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: form.email.value,
              code: form.code.value,
              turnstileToken: getTurnstileToken(form)
            })
          });
          var data = await response.json().catch(function() { return {}; });
          if (!response.ok) {
            showMessage(data.error || '验证失败', true);
            resetTurnstile(form);
            return;
          }
          window.location.href = nextPath;
        });

        document.getElementById('form-register').addEventListener('submit', async function(event) {
          event.preventDefault();
          var form = event.target;
          var response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: form.name.value,
              email: form.email.value,
              password: form.password.value,
              turnstileToken: getTurnstileToken(form)
            })
          });
          var data = await response.json().catch(function() { return {}; });
          if (!response.ok) {
            showMessage(data.error || '注册失败', true);
            resetTurnstile(form);
            return;
          }
          window.location.href = nextPath;
        });
      })();
    </script>`;

  return layout('登录 - 远程岛', content, {
    gaId: options.gaId,
    staticUrl: options.staticUrl,
    description: '登录远程岛，收藏远程职位并订阅新机会提醒。',
    activePath: '/login',
    user: options.user,
  });
}
