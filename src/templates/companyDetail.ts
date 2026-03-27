import { Job } from '../types';
import { layout } from './layout';
import { timeAgo, formatSalary, escapeHtml, rewriteUtm, breadcrumb } from '../utils/helpers';

interface CompanyInfo {
  id: number;
  name: string;
  slug: string;
  thumbnail: string | null;
  location_name_cn: string | null;
  country_name_cn: string | null;
}

function renderJobRow(job: Job): string {
  const salary = formatSalary(job.salary_lower, job.salary_upper, job.salary_currency, job.salary_pay_cycle);
  const posted = timeAgo(job.posted_at || job.created_at);

  const locationLabel = [job.location_name_cn, job.country_name_cn]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ') || '远程';
  const flag = job.country_flag_emoji || '🌍';
  const locationLink = job.location_slug
    ? `<a href="/location/${escapeHtml(job.location_slug)}" class="text-xs text-surface-400 hover:text-brand-500 transition no-underline flex-shrink-0">${flag} ${escapeHtml(locationLabel)}</a>`
    : `<span class="text-xs text-surface-400 flex-shrink-0">${flag} ${escapeHtml(locationLabel)}</span>`;

  const highlights = job.job_highlights ? JSON.parse(job.job_highlights) as Array<{ title: string; items: string[] }> : [];
  const applyOptions = job.apply_options ? JSON.parse(job.apply_options) as Array<{ title: string; link: string }> : [];
  const primaryApply = applyOptions[0]?.link ? rewriteUtm(applyOptions[0].link) : null;

  return `
    <div class="job-row border-b border-surface-100" data-job-id="${job.id}">
      <div class="job-row-header flex items-center gap-4 px-4 py-4 cursor-pointer select-none">
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <a href="/job/${escapeHtml(job.slug)}" class="job-title font-semibold text-surface-900 text-sm sm:text-base hover:text-brand-500 transition no-underline">${escapeHtml(job.title)}</a>
          </div>
          <div class="flex flex-wrap items-center gap-2 mt-1.5">
            ${salary ? `<span class="tag-pill bg-green-50 text-green-700 text-xs font-semibold">💰 ${salary}</span>` : ''}
            ${locationLink}
          </div>
        </div>
        <div class="flex items-center gap-3 flex-shrink-0">
          <div class="text-xs text-surface-400 hidden sm:block text-right">${posted}</div>
        </div>
      </div>

      <div class="job-expand hidden px-4 pb-4">
        <div class="border-t border-surface-100 pt-4">
          <div class="text-sm text-surface-600 leading-relaxed mb-4 whitespace-pre-line">${escapeHtml(job.description)}</div>
          ${highlights.length > 0 ? `
            <div class="mb-4 space-y-3">
              ${highlights.map(h => `
                <div>
                  <h4 class="text-xs font-semibold text-surface-500 uppercase mb-1">${escapeHtml(h.title)}</h4>
                  <ul class="list-disc list-inside text-sm text-surface-600 space-y-0.5">
                    ${h.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
                  </ul>
                </div>
              `).join('')}
            </div>
          ` : ''}
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              ${primaryApply ? `
                <a href="${escapeHtml(primaryApply)}" target="_blank" rel="noopener noreferrer"
                  class="apply-btn inline-block bg-brand-500 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition no-underline"
                  data-from="company-list" data-job="${escapeHtml(job.title)}" data-company="${escapeHtml(job.company_name || '')}">
                  申请
                </a>
              ` : ''}
              <a href="/job/${escapeHtml(job.slug)}" class="text-sm text-brand-500 hover:text-brand-600 transition no-underline">
                详情
              </a>
            </div>
            <button class="job-collapse p-2 rounded-full hover:bg-surface-100 transition text-surface-400 hover:text-surface-600" title="收起">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

export function companyDetailPage(company: CompanyInfo, jobs: Job[], page: number, totalPages: number, totalJobs: number, gaId?: string, siteUrl?: string, staticUrl?: string): string {
  const firstWord = (company.name || '?').split(/\s+/)[0];
  const logoFontSize = firstWord.length <= 2 ? 'text-xl' : firstWord.length <= 5 ? 'text-sm' : 'text-xs';
  const locationParts = [company.location_name_cn, company.country_name_cn].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
  const location = locationParts.join(', ') || '';

  const logo = company.thumbnail
    ? `<img src="${escapeHtml(company.thumbnail)}" alt="${escapeHtml(company.name)}" class="w-16 h-16 rounded-xl object-contain bg-surface-100 flex-shrink-0" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';

  const bc = breadcrumb([
    { label: '首页', href: '/' },
    { label: '企业', href: '/companies' },
    { label: company.name },
  ]);

  const content = `
    ${bc}
    <div class="max-w-5xl mx-auto px-4 mt-4">
      <div class="bg-white rounded-xl shadow-sm border border-surface-200 p-6 mb-4">
        <div class="flex items-center gap-4">
          <div class="flex-shrink-0 w-16 h-16">
            ${logo}
            <div class="${company.thumbnail ? 'hidden' : 'flex'} w-16 h-16 rounded-xl bg-brand-50 items-center justify-center ${logoFontSize} font-bold text-brand-500 leading-tight text-center overflow-hidden p-2">${escapeHtml(firstWord)}</div>
          </div>
          <div>
            <h1 class="text-xl font-bold text-surface-900">${escapeHtml(company.name)}</h1>
            <div class="flex items-center gap-3 mt-1 text-sm text-surface-400">
              ${location ? `<span>🌍 ${escapeHtml(location)}</span>` : ''}
              <span>${totalJobs} 个在招职位</span>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden">
        ${jobs.map(j => renderJobRow(j)).join('')}
      </div>
      ${totalPages > 1 ? `
        <div class="flex justify-center gap-2 mt-6">
          ${page > 1 ? `<a href="/company/${escapeHtml(company.slug)}?page=${page - 1}" class="px-4 py-2 rounded-lg bg-white border border-surface-200 text-sm hover:bg-surface-50 transition no-underline text-surface-600">← 上一页</a>` : ''}
          <span class="px-4 py-2 text-sm text-surface-500">${page} / ${totalPages}</span>
          ${page < totalPages ? `<a href="/company/${escapeHtml(company.slug)}?page=${page + 1}" class="px-4 py-2 rounded-lg bg-white border border-surface-200 text-sm hover:bg-surface-50 transition no-underline text-surface-600">下一页 →</a>` : ''}
        </div>
      ` : ''}
    </div>`;

  const pageTitle = `${company.name} 远程工作 - 远程岛`;
  const pageDesc = `${company.name} 目前有 ${totalJobs} 个远程岗位正在招聘${location ? `，总部位于${location}` : ''}。查看所有在招职位并直接申请。`;

  return layout(pageTitle, content, {
    gaId,
    description: pageDesc,
    keywords: `${company.name},远程工作,远程招聘,远程岛`,
    canonical: siteUrl ? `${siteUrl}/company/${company.slug}${page > 1 ? `?page=${page}` : ''}` : undefined,
    ogImage: company.thumbnail || undefined,
    staticUrl,
    activePath: '/companies',
  });
}
