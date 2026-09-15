import { layout } from './layout';
import { breadcrumb } from '../utils/helpers';

const CONTACT_EMAIL = 'yuanchengdao.com@gmail.com';

export function postJobPage(gaId?: string, staticUrl?: string): string {
  const bc = breadcrumb([
    { label: '首页', href: '/' },
    { label: '发布职位' },
  ]);

  const fieldClass =
    'w-full rounded border border-surface-200 px-3 py-2 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-1 focus:ring-brand-300 focus:border-brand-300';
  const labelClass = 'block text-sm font-medium text-surface-700 mb-1.5';

  const content = `
    ${bc}
    <div class="max-w-3xl mx-auto px-4 py-8">
      <div class="bg-white rounded shadow-sm border border-surface-200 p-6 sm:p-8">
        <h1 class="text-2xl sm:text-3xl font-bold mb-2">发布职位</h1>
        <p class="text-surface-600 text-sm sm:text-base mb-6 leading-relaxed">
          填写职位信息并预览邮件格式，按提示发送至
          <a href="mailto:${CONTACT_EMAIL}" class="text-brand-500 hover:text-brand-600 transition underline">${CONTACT_EMAIL}</a>。
          我们审核通过后会尽快上线。
        </p>

        <form id="post-job-form" class="space-y-5">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label for="job-title" class="${labelClass}">职位名称 <span class="text-brand-500">*</span></label>
              <input id="job-title" name="title" type="text" required maxlength="120" placeholder="例如：Senior Frontend Engineer" class="${fieldClass}">
            </div>
            <div>
              <label for="company-name" class="${labelClass}">公司名称 <span class="text-brand-500">*</span></label>
              <input id="company-name" name="company" type="text" required maxlength="120" placeholder="例如：Acme Inc." class="${fieldClass}">
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label for="job-location" class="${labelClass}">工作地点</label>
              <input id="job-location" name="location" type="text" maxlength="120" placeholder="例如：全球远程 / 美国 / 亚太" class="${fieldClass}">
            </div>
            <div>
              <label for="job-salary" class="${labelClass}">薪资范围</label>
              <input id="job-salary" name="salary" type="text" maxlength="80" placeholder="例如：$80k–$120k / 年" class="${fieldClass}">
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label for="job-type" class="${labelClass}">工作类型</label>
              <select id="job-type" name="jobType" class="${fieldClass}">
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
                <option value="">请选择</option>
                <option value="不限">不限</option>
                <option value="基础沟通">基础沟通</option>
                <option value="流利">流利</option>
                <option value="母语水平">母语水平</option>
              </select>
            </div>
          </div>

          <div>
            <label for="apply-url" class="${labelClass}">申请链接</label>
            <input id="apply-url" name="applyUrl" type="url" maxlength="500" placeholder="可选，也可写在职位描述里" class="${fieldClass}">
          </div>

          <div>
            <label for="contact-email" class="${labelClass}">联系邮箱</label>
            <input id="contact-email" name="contactEmail" type="email" maxlength="120" placeholder="方便我们联系你确认信息" class="${fieldClass}">
          </div>

          <div>
            <label for="job-description" class="${labelClass}">职位描述 <span class="text-brand-500">*</span></label>
            <textarea id="job-description" name="description" required rows="8" maxlength="8000" placeholder="职责、要求、福利等" class="${fieldClass} resize-y min-h-[160px]"></textarea>
          </div>

          <div class="pt-2">
            <button type="submit" class="inline-flex justify-center items-center bg-brand-500 text-white px-8 py-3 rounded font-semibold text-base hover:bg-brand-600 transition shadow-sm">
              预览
            </button>
          </div>
        </form>

        <div id="email-preview" class="hidden mt-8 border-t border-surface-200 pt-6">
          <h2 class="text-lg font-bold mb-3">请按照如下格式发送邮件</h2>
          <div class="rounded-lg border border-surface-200 bg-white shadow-sm overflow-hidden">
            <div class="divide-y divide-surface-200">
              <div class="flex items-start gap-3 px-4 py-3">
                <span class="shrink-0 w-14 text-xs font-medium text-surface-400 pt-0.5">收件人</span>
                <div id="preview-to" class="flex-1 min-w-0 text-sm text-surface-800 break-all"></div>
              </div>
              <div class="flex items-start gap-3 px-4 py-3">
                <span class="shrink-0 w-14 text-xs font-medium text-surface-400 pt-0.5">主题</span>
                <div id="preview-subject" class="flex-1 min-w-0 text-sm text-surface-800 break-words"></div>
              </div>
              <div class="px-4 py-3">
                <div class="text-xs font-medium text-surface-400 mb-2">正文</div>
                <pre id="preview-body" class="whitespace-pre-wrap break-words text-sm text-surface-800 leading-relaxed m-0 min-h-[160px] font-sans"></pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <script>
      (function () {
        var form = document.getElementById('post-job-form');
        if (!form) return;
        var contactEmail = ${JSON.stringify(CONTACT_EMAIL)};

        function value(name) {
          var el = form.elements.namedItem(name);
          return el && 'value' in el ? String(el.value).trim() : '';
        }

        function buildEmail() {
          var title = value('title');
          var company = value('company');
          var location = value('location') || '未填写';
          var salary = value('salary') || '未填写';
          var jobType = value('jobType') || '未填写';
          var englishLevel = value('englishLevel') || '未填写';
          var applyUrl = value('applyUrl') || '未填写';
          var contact = value('contactEmail') || '未填写';
          var description = value('description');

          var subject = '[远程岛职位发布] ' + company + ' - ' + title;
          var body = [
            '【职位名称】' + title,
            '【公司名称】' + company,
            '【工作地点】' + location,
            '【薪资范围】' + salary,
            '【工作类型】' + jobType,
            '【英语要求】' + englishLevel,
            '【申请链接】' + applyUrl,
            '【联系邮箱】' + contact,
            '',
            '【职位描述】',
            description,
            '',
            '——',
            '来自远程岛发布职位页'
          ].join('\\n');

          return { subject: subject, body: body };
        }

        form.addEventListener('submit', function (event) {
          event.preventDefault();
          if (!form.reportValidity()) return;

          var email = buildEmail();
          var preview = document.getElementById('email-preview');
          var toEl = document.getElementById('preview-to');
          var subjectEl = document.getElementById('preview-subject');
          var bodyEl = document.getElementById('preview-body');
          if (preview && toEl && subjectEl && bodyEl) {
            toEl.textContent = contactEmail;
            subjectEl.textContent = email.subject;
            bodyEl.textContent = email.body;
            preview.classList.remove('hidden');
            preview.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      })();
    </script>`;

  return layout('发布职位 - 远程岛', content, {
    gaId,
    description: '在远程岛免费发布远程职位。填写职位信息后按固定格式发送邮件，审核通过后即可展示给求职者。',
    keywords: '发布职位,远程招聘,招聘远程员工,岗位发布,远程岛招聘',
    staticUrl,
    activePath: '/post-job',
  });
}
