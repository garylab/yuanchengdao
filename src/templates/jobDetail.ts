import { Job } from '../types';
import { layout } from './layout';
import { timeAgo, formatSalary, escapeHtml, rewriteUtm } from '../utils/helpers';

export function jobDetailPage(job: Job, gaId?: string): string {
  const salary = formatSalary(job.salary_lower, job.salary_upper, job.salary_currency, job.salary_pay_cycle);
  const posted = timeAgo(job.posted_at || job.created_at);

  const highlights = job.job_highlights ? JSON.parse(job.job_highlights) as Array<{ title: string; items: string[] }> : [];
  const applyOptions = job.apply_options ? JSON.parse(job.apply_options) as Array<{ title: string; link: string }> : [];
  const primaryApply = applyOptions[0]?.link ? rewriteUtm(applyOptions[0].link) : null;

  const descriptionHtml = escapeHtml(job.description)
    .replace(/\n\n/g, '</p><p class="mb-3">')
    .replace(/\n/g, '<br>');

  const content = `
    <div class="max-w-3xl mx-auto px-4 py-8">
      <a href="/" class="inline-flex items-center gap-1 text-sm text-surface-500 hover:text-brand-500 mb-6 transition">
        ← 返回职位列表
      </a>

      <!-- Header -->
      <div class="bg-white rounded-xl shadow-sm border border-surface-200 p-6 mb-6">
        <div class="flex items-start gap-4">
          ${job.company_thumbnail
            ? `<img src="${escapeHtml(job.company_thumbnail)}" alt="${escapeHtml(job.company_name || '')}" class="w-16 h-16 rounded-xl object-contain bg-surface-100 flex-shrink-0">`
            : `<div class="w-16 h-16 rounded-xl bg-brand-50 flex items-center justify-center text-2xl flex-shrink-0">💼</div>`
          }
          <div class="flex-1">
            <h1 class="text-xl sm:text-2xl font-bold text-surface-900 mb-1">${escapeHtml(job.title)}</h1>
            <div class="flex flex-wrap items-center gap-3 text-sm text-surface-500 mt-1">
              <span class="font-medium text-surface-700">${escapeHtml(job.company_name || '')}</span>
              <span>📍 ${escapeHtml([job.location_name_cn, job.country_name_cn].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ') || '远程')}</span>
              ${salary ? `<span class="text-green-600 font-medium">💰 ${salary}</span>` : ''}
              <span>${posted}</span>
            </div>
          </div>
        </div>

        ${primaryApply ? `
          <div class="mt-6">
            <a href="${escapeHtml(primaryApply)}" target="_blank" rel="noopener noreferrer"
              class="inline-block bg-brand-500 text-white px-8 py-3 rounded-xl font-semibold text-base hover:bg-brand-600 transition shadow-sm">
              申请该职位 →
            </a>
          </div>
        ` : ''}
      </div>

      <!-- Highlights -->
      ${highlights.length > 0 ? `
        <div class="bg-white rounded-xl shadow-sm border border-surface-200 p-6 mb-6">
          ${highlights.map(h => `
            <div class="mb-4 last:mb-0">
              <h3 class="font-semibold text-surface-800 mb-2">${escapeHtml(h.title)}</h3>
              <ul class="list-disc list-inside space-y-1 text-sm text-surface-600">
                ${h.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Description -->
      <div class="bg-white rounded-xl shadow-sm border border-surface-200 p-6">
        <h2 class="text-lg font-bold mb-4">职位描述</h2>
        <div class="text-surface-700 leading-relaxed text-sm">
          <p class="mb-3">${descriptionHtml}</p>
        </div>
      </div>

      <!-- Apply options -->
      ${applyOptions.length > 0 ? `
        <div class="mt-6 bg-white rounded-xl shadow-sm border border-surface-200 p-6">
          <h2 class="text-lg font-bold mb-3">申请渠道</h2>
          <div class="space-y-2">
            ${applyOptions.map((opt, i) => `
              <a href="${escapeHtml(rewriteUtm(opt.link))}" target="_blank" rel="noopener noreferrer"
                class="flex items-center justify-between p-3 rounded-lg border border-surface-200 hover:border-brand-300 hover:bg-brand-50 transition no-underline text-inherit">
                <span class="text-sm font-medium">${escapeHtml(opt.title)}</span>
                <span class="text-xs text-brand-500">前往申请 →</span>
              </a>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${primaryApply ? `
        <div class="mt-6 text-center">
          <a href="${escapeHtml(primaryApply)}" target="_blank" rel="noopener noreferrer"
            class="inline-block bg-brand-500 text-white px-10 py-3.5 rounded-xl font-semibold text-lg hover:bg-brand-600 transition shadow-md">
            立即申请 →
          </a>
          <p class="text-xs text-surface-400 mt-2">将跳转至招聘方页面</p>
        </div>
      ` : ''}
    </div>`;

  return layout(job.title, content, { description: `${job.title} - ${job.company_name || ''} | 远程岛`, gaId });
}
