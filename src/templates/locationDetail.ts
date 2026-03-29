import { Job } from '../types';
import { layout } from './layout';
import { timeAgo, formatSalary, escapeHtml, rewriteUtm, breadcrumb, companyLogo, locationRequirementBadge } from '../utils/helpers';

interface LocationInfo {
  id: number;
  name: string;
  name_cn: string;
  slug: string;
  country_name_cn: string | null;
  country_flag_emoji: string | null;
}

function renderJobRow(job: Job): string {
  const salary = formatSalary(job.salary_lower, job.salary_upper, job.salary_currency, job.salary_pay_cycle);
  const posted = timeAgo(job.posted_at || job.created_at);
  const logo = companyLogo(job.company_name, job.company_thumbnail);

  const highlights = job.job_highlights ? JSON.parse(job.job_highlights) as Array<{ title: string; items: string[] }> : [];
  const applyOptions = job.apply_options ? JSON.parse(job.apply_options) as Array<{ title: string; link: string }> : [];
  const primaryApply = applyOptions[0]?.link ? rewriteUtm(applyOptions[0].link) : null;

  return `
    <div class="job-row border-b border-surface-100" data-job-id="${job.id}">
      <div class="job-row-header flex items-center gap-4 px-4 py-4 cursor-pointer select-none">
        ${logo}
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <a href="/job/${escapeHtml(job.slug)}" class="job-title font-semibold text-surface-900 text-sm sm:text-base hover:text-brand-500 transition no-underline">${escapeHtml(job.title)}</a>
            ${job.company_slug
              ? `<a href="/company/${escapeHtml(job.company_slug)}" class="text-sm text-surface-500 hover:text-brand-500 transition no-underline flex-shrink-0">${escapeHtml(job.company_name || '')}</a>`
              : `<span class="text-sm text-surface-500 flex-shrink-0">${escapeHtml(job.company_name || '')}</span>`
            }
          </div>
          <div class="flex flex-wrap items-center gap-2 mt-1.5">
            ${salary ? `<span class="tag-pill bg-green-50 text-green-700 text-xs font-semibold">💰 ${salary}</span>` : ''}
            ${locationRequirementBadge(job.location_requirement)}
            <span class="text-xs text-surface-400 flex-shrink-0 sm:hidden">${posted}</span>
          </div>
        </div>
        <div class="hidden sm:flex items-center gap-3 flex-shrink-0">
          <div class="text-xs text-surface-400 text-right">${posted}</div>
        </div>
      </div>

      <div class="job-expand hidden px-4 pb-4">
        <div class="ml-16 border-t border-surface-100 pt-4">
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
                  data-from="location-list" data-job="${escapeHtml(job.title)}" data-company="${escapeHtml(job.company_name || '')}">
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

export function locationDetailPage(location: LocationInfo, jobs: Job[], page: number, hasMore: boolean, gaId?: string, siteUrl?: string, staticUrl?: string): string {
  const displayName = location.name_cn || location.name;
  const subtitle = location.country_name_cn && location.country_name_cn !== location.name_cn
    ? location.country_name_cn
    : '';

  const bc = breadcrumb([
    { label: '首页', href: '/' },
    { label: displayName },
  ]);

  const pagination = (page > 1 || hasMore) ? `
    <div class="flex justify-center gap-2 mt-6">
      ${page > 1 ? `<a href="/location/${escapeHtml(location.slug)}?page=${page - 1}" class="px-4 py-2 rounded-lg bg-white border border-surface-200 text-sm hover:bg-surface-50 transition no-underline text-surface-600">← 上一页</a>` : ''}
      ${hasMore ? `<a href="/location/${escapeHtml(location.slug)}?page=${page + 1}" class="px-4 py-2 rounded-lg bg-white border border-surface-200 text-sm hover:bg-surface-50 transition no-underline text-surface-600">下一页 →</a>` : ''}
    </div>` : '';

  const content = `
    ${bc}
    <div class="max-w-5xl mx-auto px-4 mt-4">
      <div class="mb-4">
        <h1 class="text-xl font-bold text-surface-900">${location.country_flag_emoji || '🌍'} ${escapeHtml(displayName)}远程工作</h1>
        <p class="text-sm text-surface-400 mt-1">${subtitle ? escapeHtml(subtitle) : '远程工作'}</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden">
        ${jobs.length > 0
          ? jobs.map(j => renderJobRow(j)).join('')
          : `<div class="text-center py-20 text-surface-400">
              <p class="text-lg">暂无相关职位</p>
            </div>`
        }
      </div>
      ${pagination}
    </div>`;

  const pageTitle = `${displayName}远程工作 - 远程岛`;
  const pageDesc = `正在找${displayName}的远程工作？每天更新远程岗位，查看职位详情并直接申请。`;

  return layout(pageTitle, content, {
    gaId,
    description: pageDesc,
    keywords: `${displayName},远程工作,${location.name},remote jobs,远程岛`,
    canonical: siteUrl ? `${siteUrl}/location/${location.slug}${page > 1 ? `?page=${page}` : ''}` : undefined,
    staticUrl,
    activePath: '/locations',
  });
}
