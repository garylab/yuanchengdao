import { AuthUser } from '../types';
import { layout } from './layout';
import { breadcrumb, escapeHtml } from '../utils/helpers';
import { FEEDBACK_CATEGORIES } from '../constants/feedback';

export function feedbackPage(options: {
  user?: AuthUser | null;
  turnstileSiteKey?: string;
  gaId?: string;
  staticUrl?: string;
  prefillCategory?: string;
  prefillPageUrl?: string;
}): string {
  const { user, turnstileSiteKey = '', prefillCategory = '', prefillPageUrl = '' } = options;
  const bc = breadcrumb([
    { label: '首页', href: '/' },
    { label: '意见反馈', href: '/feedback' },
  ]);

  const categoryOptions = FEEDBACK_CATEGORIES.map((c) =>
    `<option value="${escapeHtml(c.value)}" data-placeholder="${escapeHtml(c.placeholder)}" ${c.value === prefillCategory ? 'selected' : ''}>${escapeHtml(c.label)}</option>`
  ).join('');

  const content = `
    ${bc}
    <div class="max-w-2xl mx-auto px-4 py-6">
      <div class="bg-white rounded shadow-sm border border-surface-200 p-6 sm:p-8">
        <h1 class="text-2xl font-bold text-surface-900 mb-2">意见反馈</h1>
        <p class="text-sm text-surface-500 mb-6">
          发现漏掉的职位、地区，或者有其它使用建议？告诉我们，帮助远程岛越来越好。
        </p>

        <form id="feedback-form" class="space-y-4">
          <div>
            <label class="block text-sm text-surface-700 mb-1">反馈类型</label>
            <select id="feedback-category" name="category" required
              class="w-full border border-surface-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-400">
              <option value="">请选择</option>
              ${categoryOptions}
            </select>
          </div>

          <div>
            <label class="block text-sm text-surface-700 mb-1">详细描述</label>
            <textarea id="feedback-message" name="message" required rows="5" maxlength="2000"
              placeholder="请具体描述场景，比如缺失的职位名称、地区名称，或想要的功能"
              class="w-full border border-surface-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-400 resize-y"></textarea>
          </div>

          <div>
            <label class="block text-sm text-surface-700 mb-1">相关链接（可选）</label>
            <input type="url" id="feedback-reference" name="referenceUrl" maxlength="500"
              placeholder="如相关职位、地区页面或参考网站"
              class="w-full border border-surface-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-400">
          </div>

          <div>
            <label class="block text-sm text-surface-700 mb-1">
              联系邮箱${user ? '' : '<span class="text-surface-400">（可选，用于回复）</span>'}
            </label>
            <input type="email" id="feedback-email" name="email" maxlength="200"
              value="${user?.email ? escapeHtml(user.email) : ''}"
              ${user ? 'readonly' : ''}
              placeholder="你的邮箱"
              class="w-full border border-surface-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-400 ${user ? 'bg-surface-50 text-surface-500' : ''}">
          </div>

          <input type="hidden" name="pageUrl" value="${escapeHtml(prefillPageUrl)}">

          ${turnstileSiteKey && !user ? `<div class="cf-turnstile" data-sitekey="${escapeHtml(turnstileSiteKey)}" data-theme="light"></div>` : ''}

          <p id="feedback-message-status" class="hidden text-sm"></p>

          <div class="flex items-center gap-3">
            <button type="submit" id="feedback-submit"
              class="bg-brand-500 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-brand-600 transition">
              提交
            </button>
            <a href="/" class="text-sm text-surface-500 hover:text-surface-700">返回首页</a>
          </div>
        </form>
      </div>
    </div>
    ${turnstileSiteKey && !user ? `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>` : ''}
    <script>
      (function() {
        var form = document.getElementById('feedback-form');
        var categoryEl = document.getElementById('feedback-category');
        var messageEl = document.getElementById('feedback-message');
        var refEl = document.getElementById('feedback-reference');
        var emailEl = document.getElementById('feedback-email');
        var statusEl = document.getElementById('feedback-message-status');
        var submitBtn = document.getElementById('feedback-submit');
        var loggedIn = ${user ? 'true' : 'false'};

        function showStatus(text, isError) {
          statusEl.textContent = text;
          statusEl.className = 'text-sm ' + (isError ? 'text-red-600' : 'text-green-600');
          statusEl.classList.remove('hidden');
        }

        function updatePlaceholder() {
          var opt = categoryEl.options[categoryEl.selectedIndex];
          if (opt && opt.dataset.placeholder) {
            messageEl.placeholder = opt.dataset.placeholder;
          }
        }
        categoryEl.addEventListener('change', updatePlaceholder);
        updatePlaceholder();

        function getTurnstileToken() {
          var input = form.querySelector('input[name="cf-turnstile-response"]');
          return input ? input.value : '';
        }

        form.addEventListener('submit', async function(event) {
          event.preventDefault();
          var payload = {
            category: categoryEl.value,
            message: messageEl.value.trim(),
            referenceUrl: refEl.value.trim() || null,
            email: emailEl.value.trim() || null,
            pageUrl: form.pageUrl.value || null,
            turnstileToken: getTurnstileToken()
          };
          if (!payload.category) { showStatus('请选择反馈类型', true); return; }
          if (!payload.message) { showStatus('请填写详细描述', true); return; }

          submitBtn.disabled = true;
          var originalText = submitBtn.textContent;
          submitBtn.textContent = '提交中…';
          try {
            var response = await fetch('/api/feedback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            var data = await response.json().catch(function() { return {}; });
            if (!response.ok) {
              showStatus(data.error || '提交失败', true);
              if (window.turnstile && !loggedIn) {
                var widget = form.querySelector('.cf-turnstile');
                if (widget) window.turnstile.reset(widget);
              }
              return;
            }
            form.reset();
            if (loggedIn) emailEl.value = ${user?.email ? JSON.stringify(user.email) : '""'};
            updatePlaceholder();
            showStatus('已收到你的反馈，感谢！', false);
          } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
          }
        });
      })();
    </script>`;

  return layout('意见反馈 - 远程岛', content, {
    gaId: options.gaId,
    staticUrl: options.staticUrl,
    description: '给远程岛提意见：缺失的职位、地区，或其它使用建议。',
    activePath: '/feedback',
    user,
  });
}
