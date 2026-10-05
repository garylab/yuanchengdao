import { layout } from './layout';
import { breadcrumb, escapeHtml } from '../utils/helpers';
import { breadcrumbJsonLd } from '../utils/jsonLd';
import { AuthUser } from '../types';

export function postJobPage(options: {
  gaId?: string;
  siteUrl?: string;
  staticUrl?: string;
  /** Null for signed-out visitors: the page is the employer-facing landing page,
   *  so it has to render (and be indexable) without an account. */
  user: AuthUser | null;
}): string {
  const { user } = options;
  const crumbs = [
    { label: '首页', href: '/' },
    { label: '发布职位', href: '/post-job' },
  ];
  const bc = breadcrumb(crumbs);

  const fieldClass =
    'w-full rounded border border-surface-200 px-3 py-2 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-1 focus:ring-brand-300 focus:border-brand-300';
  const labelClass = 'block text-sm font-medium text-surface-700 mb-1.5';

  const formSection = `
        <form id="post-job-form" class="space-y-5">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label for="job-title" class="${labelClass}">职位名称 <span class="text-brand-500">*</span></label>
              <input id="job-title" name="title" type="text" required minlength="2" maxlength="120" placeholder="例如：Senior Frontend Engineer" class="${fieldClass}">
            </div>
            <div>
              <label for="company-name" class="${labelClass}">公司名称 <span class="text-brand-500">*</span></label>
              <input id="company-name" name="companyName" type="text" required minlength="2" maxlength="120" placeholder="例如：Acme Inc." class="${fieldClass}">
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label for="company-website" class="${labelClass}">公司官网</label>
              <input id="company-website" name="companyWebsite" type="text" maxlength="200" placeholder="https://example.com" class="${fieldClass}">
            </div>
            <div>
              <label for="job-location" class="${labelClass}">工作地点 / 时区</label>
              <input id="job-location" name="locationText" type="text" maxlength="120" placeholder="例如：全球远程 / 亚太时区 / 美国" class="${fieldClass}">
            </div>
          </div>

          <div>
            <label class="${labelClass}">公司 Logo</label>
            <div class="flex items-center gap-4">
              <div id="logo-preview" class="w-16 h-16 rounded border border-dashed border-surface-300 bg-surface-50 flex items-center justify-center text-xs text-surface-400 overflow-hidden">未上传</div>
              <div class="flex-1 min-w-0">
                <input id="logo-file" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="text-sm">
                <input type="hidden" name="companyLogo" id="logo-key" value="">
                <p id="logo-status" class="text-xs text-surface-400 mt-1">PNG / JPG / WebP / SVG，≤ 2MB</p>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label for="location-requirement" class="${labelClass}">地点限制</label>
              <select id="location-requirement" name="locationRequirement" class="${fieldClass}">
                <option value="0">不限，全球可申请</option>
                <option value="3">需在特定时区工作</option>
                <option value="2">限特定地区</option>
                <option value="1">限本国居民</option>
                <option value="4">需当地工作许可</option>
              </select>
              <input type="text" id="location-requirement-label" name="locationRequirementLabel" maxlength="40"
                class="${fieldClass} mt-2 hidden" placeholder="限哪里？如：美国 / 欧盟 / 美东时区">
            </div>
            <div>
              <label for="job-type" class="${labelClass}">工作类型</label>
              <select id="job-type" name="scheduleType" class="${fieldClass}">
                <option value="">请选择</option>
                <option value="全职">全职</option>
                <option value="兼职">兼职</option>
                <option value="合同制">合同制</option>
                <option value="实习">实习</option>
              </select>
            </div>
            <div>
              <label for="english-level" class="${labelClass}">英语要求</label>
              <select id="english-level" name="englishLevel" class="${fieldClass}">
                <option value="none">不要求</option>
                <option value="basic">基础沟通</option>
                <option value="intermediate">中级</option>
                <option value="fluent">流利</option>
                <option value="native">母语水平</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-4 gap-5">
            <div class="sm:col-span-2">
              <label for="job-salary" class="${labelClass}">薪资说明</label>
              <input id="job-salary" name="salaryText" type="text" maxlength="80" placeholder="例如：$80k–$120k / 年，或 面议" class="${fieldClass}">
            </div>
            <div>
              <label for="salary-lower" class="${labelClass}">月薪下限（¥）</label>
              <input id="salary-lower" name="salaryLower" type="number" min="0" step="100" placeholder="可选" class="${fieldClass}">
            </div>
            <div>
              <label for="salary-upper" class="${labelClass}">月薪上限（¥）</label>
              <input id="salary-upper" name="salaryUpper" type="number" min="0" step="100" placeholder="可选" class="${fieldClass}">
            </div>
          </div>
          <p class="text-xs text-surface-400 -mt-3">填写人民币月薪区间可进入薪资筛选与薪资报告；只填"薪资说明"也可以。</p>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label for="apply-url" class="${labelClass}">申请链接</label>
              <input id="apply-url" name="applyUrl" type="text" maxlength="500" placeholder="https://…（与申请邮箱至少填一项）" class="${fieldClass}">
            </div>
            <div>
              <label for="apply-email" class="${labelClass}">申请邮箱</label>
              <input id="apply-email" name="applyEmail" type="email" maxlength="120" placeholder="hr@example.com" class="${fieldClass}">
            </div>
          </div>

          <div>
            <label for="job-description" class="${labelClass}">职位描述 <span class="text-brand-500">*</span></label>
            <textarea id="job-description" name="description" required minlength="50" rows="10" maxlength="8000" placeholder="职责、要求、福利、面试流程等。支持中文或英文，至少 50 字。" class="${fieldClass} resize-y min-h-[200px]"></textarea>
          </div>

          <div>
            <label for="contact-email" class="${labelClass}">联系邮箱 <span class="text-brand-500">*</span></label>
            <input id="contact-email" name="contactEmail" type="email" required maxlength="120" value="${user?.email ? escapeHtml(user.email) : ''}" placeholder="用于接收审核结果，不会公开" class="${fieldClass}">
          </div>

          <p id="post-job-status" class="hidden text-sm"></p>

          <div class="pt-2 flex items-center gap-4">
            <button type="submit" id="post-job-submit" class="inline-flex justify-center items-center bg-brand-500 text-white px-8 py-3 rounded font-semibold text-base hover:bg-brand-600 transition shadow-sm">
              提交审核
            </button>
            <span class="text-xs text-surface-400">免费 · 审核通常 1–2 个工作日</span>
          </div>
        </form>

        <div id="post-job-success" class="hidden mt-6 rounded border border-green-200 bg-green-50 p-5 text-sm text-green-800">
          <p class="font-semibold mb-1">已收到，感谢投递！</p>
          <p>编号 <span id="post-job-id"></span>。我们会尽快审核，结果会发送到你的联系邮箱。想再发一条？<button type="button" id="post-job-again" class="text-brand-600 underline">继续发布</button></p>
        </div>`;

  const signInGate = `
        <div class="rounded border border-brand-200 bg-brand-50 p-5 sm:p-6">
          <p class="text-sm text-surface-700 leading-relaxed mb-4">
            发布前需要先登录，我们用它把审核结果发给你，也方便你之后管理已发布的职位。登录后直接填写表单，大约 3 分钟。
          </p>
          <a href="/login?next=%2Fpost-job" class="inline-flex items-center bg-brand-500 text-white px-6 py-2.5 rounded font-semibold text-sm hover:bg-brand-600 transition no-underline">
            登录后发布职位
          </a>
        </div>

        <div class="mt-8 pt-6 border-t border-surface-100">
          <h2 class="text-lg font-bold text-surface-900 mb-3">发布后会发生什么</h2>
          <ol class="text-sm text-surface-600 space-y-2 list-decimal list-inside leading-relaxed">
            <li>我们在 1–2 个工作日内人工审核，确认是真实的远程岗位</li>
            <li>通过后职位上线 30 天，出现在首页、对应职能与地区页</li>
            <li>同步推送给订阅了该职能的求职者，并发布到 Telegram 频道</li>
            <li>审核结果发送到你填写的联系邮箱，未通过会说明原因</li>
          </ol>
        </div>

        <div class="mt-6">
          <h2 class="text-lg font-bold text-surface-900 mb-3">需要准备的信息</h2>
          <ul class="text-sm text-surface-600 space-y-2 list-disc list-inside leading-relaxed">
            <li>职位名称、公司名称与公司官网</li>
            <li>申请链接或申请邮箱（至少一项）</li>
            <li>岗位描述，至少 50 字，中英文均可</li>
            <li>可选：薪资区间、英语水平要求、可申请的国家或地区</li>
          </ul>
          <p class="text-xs text-surface-500 mt-4 leading-relaxed">
            远程岛的读者以华人求职者为主，分布在国内与海外。如果岗位接受中文沟通或不要求英语流利，记得在描述里写明，这类岗位在站内有单独的入口。
          </p>
        </div>`;

  const content = `
    ${bc}
    <div class="max-w-3xl mx-auto px-4 py-8">
      <div class="bg-white rounded shadow-sm border border-surface-200 p-6 sm:p-8">
        <h1 class="text-2xl sm:text-3xl font-bold mb-2">发布远程职位</h1>
        <p class="text-surface-600 text-sm sm:text-base mb-2 leading-relaxed">
          面向华人求职者免费发布远程岗位。提交后我们会在 <strong>1–2 个工作日</strong>内审核，通过后上线 30 天，并推送给订阅了相关职位的求职者。
        </p>
        <ul class="text-xs text-surface-500 mb-6 space-y-1 list-disc list-inside">
          <li>仅接受可远程完成的岗位（全远程或以远程为主）</li>
          <li>需提供可访问的申请链接或申请邮箱</li>
          <li>审核结果会发送到你填写的联系邮箱</li>
        </ul>

        ${user ? formSection : signInGate}
      </div>
    </div>
    <script>
      (function () {
        var form = document.getElementById('post-job-form');
        if (!form) return;
        var statusEl = document.getElementById('post-job-status');
        var submitBtn = document.getElementById('post-job-submit');
        var successEl = document.getElementById('post-job-success');

        function showStatus(text, isError) {
          statusEl.textContent = text;
          statusEl.className = 'text-sm ' + (isError ? 'text-red-600' : 'text-green-600');
          statusEl.classList.remove('hidden');
        }
        function value(name) {
          var el = form.elements.namedItem(name);
          return el && 'value' in el ? String(el.value).trim() : '';
        }

        var reqSelect = document.getElementById('location-requirement');
        var reqLabel = document.getElementById('location-requirement-label');
        if (reqSelect && reqLabel) {
          var syncReqLabel = function () { reqLabel.classList.toggle('hidden', reqSelect.value === '0'); };
          reqSelect.addEventListener('change', syncReqLabel);
          syncReqLabel();
        }

        form.addEventListener('submit', async function (event) {
          event.preventDefault();
          if (!form.reportValidity()) return;
          if (!value('applyUrl') && !value('applyEmail')) { showStatus('请填写申请链接或申请邮箱', true); return; }
          var payload = {
            title: value('title'),
            companyName: value('companyName'),
            companyWebsite: value('companyWebsite'),
            companyLogo: value('companyLogo'),
            locationText: value('locationText'),
            locationRequirement: Number(value('locationRequirement') || 0),
            locationRequirementLabel: value('locationRequirementLabel'),
            scheduleType: value('scheduleType'),
            englishLevel: value('englishLevel'),
            salaryText: value('salaryText'),
            salaryLower: Number(value('salaryLower') || 0),
            salaryUpper: Number(value('salaryUpper') || 0),
            salaryPayCycle: 'month',
            applyUrl: value('applyUrl'),
            applyEmail: value('applyEmail'),
            description: value('description'),
            contactEmail: value('contactEmail'),
          };
          submitBtn.disabled = true;
          var original = submitBtn.textContent;
          submitBtn.textContent = '提交中…';
          try {
            var res = await fetch('/api/job-submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            var data = await res.json().catch(function () { return {}; });
            if (!res.ok) {
              showStatus(data.error || '提交失败', true);
              return;
            }
            statusEl.classList.add('hidden');
            document.getElementById('post-job-id').textContent = '#' + data.id;
            form.classList.add('hidden');
            successEl.classList.remove('hidden');
            successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = original;
          }
        });

        var logoFile = document.getElementById('logo-file');
        var logoKey = document.getElementById('logo-key');
        var logoStatus = document.getElementById('logo-status');
        var logoPreview = document.getElementById('logo-preview');
        if (logoFile) {
          logoFile.addEventListener('change', async function () {
            var f = logoFile.files && logoFile.files[0];
            if (!f) return;
            if (f.size > 2 * 1024 * 1024) { logoStatus.textContent = '文件超过 2MB'; logoStatus.className = 'text-xs text-red-600 mt-1'; return; }
            logoStatus.textContent = '上传中…'; logoStatus.className = 'text-xs text-surface-500 mt-1';
            var fd = new FormData(); fd.append('file', f);
            try {
              var res = await fetch('/api/job-submissions/logo', { method: 'POST', body: fd });
              var data = await res.json().catch(function () { return {}; });
              if (!res.ok) { logoStatus.textContent = data.error || '上传失败'; logoStatus.className = 'text-xs text-red-600 mt-1'; return; }
              logoKey.value = data.key;
              logoStatus.textContent = '已上传，审核后随公司一起展示。'; logoStatus.className = 'text-xs text-green-600 mt-1';
              var reader = new FileReader();
              reader.onload = function (e) {
                logoPreview.innerHTML = '<img src="' + e.target.result + '" alt="logo" class="w-full h-full object-contain">';
              };
              reader.readAsDataURL(f);
            } catch (err) {
              logoStatus.textContent = '上传失败'; logoStatus.className = 'text-xs text-red-600 mt-1';
            }
          });
        }

        var again = document.getElementById('post-job-again');
        if (again) again.addEventListener('click', function () {
          form.reset();
          if (logoPreview) logoPreview.innerHTML = '未上传';
          if (logoStatus) { logoStatus.textContent = 'PNG / JPG / WebP / SVG，≤ 2MB'; logoStatus.className = 'text-xs text-surface-400 mt-1'; }
          form.classList.remove('hidden');
          successEl.classList.add('hidden');
          form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      })();
    </script>`;

  return layout('发布远程职位 - 远程岛', content, {
    gaId: options.gaId,
    description: '在远程岛免费发布远程职位，1–2 个工作日审核，通过后展示 30 天并推送给订阅了相关职位的华人求职者。',
    keywords: '发布职位,远程招聘,招聘远程员工,岗位发布,远程岛招聘',
    canonical: options.siteUrl ? `${options.siteUrl}/post-job` : undefined,
    jsonLd: breadcrumbJsonLd(crumbs, options.siteUrl),
    staticUrl: options.staticUrl,
    activePath: '/post-job',
    user,
  });
}
