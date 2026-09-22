import { AuthUser, Job } from '../types';
import { layout } from './layout';
import { timeAgo, jobDisplayTimestamp, formatSalary, escapeHtml, rewriteUtm, breadcrumb, companyLogo, locationRequirementBadge, englishLevelBadge } from '../utils/helpers';

interface CompanyInfo {
  id: number;
  name: string;
  slug: string;
  thumbnail: string | null;
  location_name_cn: string | null;
  country_name_cn: string | null;
  country_flag_emoji: string | null;
  description?: string | null;
  website?: string | null;
  job_count?: number;
}

export interface CompanyStats {
  activeJobs: number;
  firstSeen: string | null;
  lastPosted: string | null;
  salaryMin: number;
  salaryMax: number;
  topLocations: Array<{ name_cn: string; slug: string; count: number }>;
  topCategories: Array<{ term_cn: string; slug: string; count: number }>;
}

function renderJobRow(job: Job): string {
  const salary = formatSalary(job.salary_lower, job.salary_upper, job.salary_currency, job.salary_pay_cycle);
  const posted = timeAgo(jobDisplayTimestamp(job));

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
            ${locationLink}
            ${salary ? `<span class="tag-pill bg-green-50 text-green-700 text-xs">💰 ${salary}</span>` : ''}
            ${locationRequirementBadge(job.location_requirement)}
            ${englishLevelBadge(job.english_level_required)}
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
                  class="apply-btn inline-block bg-brand-500 text-white px-6 py-2 rounded text-sm font-medium hover:bg-brand-600 transition no-underline"
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

export function companyDetailPage(company: CompanyInfo, jobs: Job[], page: number, hasMore: boolean, gaId?: string, siteUrl?: string, staticUrl?: string, user?: AuthUser | null, stats?: CompanyStats | null): string {
  const logo = companyLogo(company.name, company.thumbnail, 'lg');
  const locationParts = [company.location_name_cn, company.country_name_cn].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
  const location = locationParts.join(', ') || '';
  let websiteHost = '';
  if (company.website) {
    try { websiteHost = new URL(company.website).hostname.replace(/^www\./, ''); } catch { websiteHost = company.website; }
  }
  const salaryRange = stats && stats.salaryMax > 0
    ? `¥${Math.round(stats.salaryMin / 1000)}k – ¥${Math.round(stats.salaryMax / 1000)}k / 月`
    : '';
  const statsHtml = stats ? `
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-surface-100 text-sm">
          <div><div class="text-xs text-surface-400">在招职位</div><div class="font-semibold text-surface-900 mt-0.5">${stats.activeJobs}</div></div>
          <div><div class="text-xs text-surface-400">最近发布</div><div class="font-semibold text-surface-900 mt-0.5">${stats.lastPosted ? timeAgo(stats.lastPosted) : '—'}</div></div>
          <div><div class="text-xs text-surface-400">首次出现</div><div class="font-semibold text-surface-900 mt-0.5">${stats.firstSeen ? timeAgo(stats.firstSeen) : '—'}</div></div>
          <div><div class="text-xs text-surface-400">月薪区间</div><div class="font-semibold text-surface-900 mt-0.5">${salaryRange || '未标注'}</div></div>
        </div>
        ${stats.topCategories.length > 0 || stats.topLocations.length > 0 ? `
        <div class="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-xs text-surface-500">
          ${stats.topCategories.length > 0 ? `<div class="flex flex-wrap items-center gap-1.5"><span class="font-semibold text-surface-600">常招岗位：</span>${stats.topCategories.map((c) => `<a href="/category/${escapeHtml(c.slug)}" class="px-2 py-0.5 rounded bg-surface-100 hover:bg-brand-50 hover:text-brand-600 transition no-underline">${escapeHtml(c.term_cn)} ${c.count}</a>`).join('')}</div>` : ''}
          ${stats.topLocations.length > 0 ? `<div class="flex flex-wrap items-center gap-1.5"><span class="font-semibold text-surface-600">地点：</span>${stats.topLocations.map((l) => `<a href="/location/${escapeHtml(l.slug)}" class="px-2 py-0.5 rounded bg-surface-100 hover:bg-brand-50 hover:text-brand-600 transition no-underline">${escapeHtml(l.name_cn)} ${l.count}</a>`).join('')}</div>` : ''}
        </div>` : ''}` : '';

  const bc = breadcrumb([
    { label: '首页', href: '/' },
    { label: '企业', href: '/companies' },
    { label: company.name, href: `/company/${company.slug}` },
  ]);

  const content = `
    ${bc}
    <div class="max-w-5xl mx-auto px-4 mt-4">
      <div class="bg-white rounded shadow-sm border border-surface-200 p-6 mb-4">
        <div class="flex flex-col sm:flex-row sm:items-start gap-4">
          ${logo}
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h1 class="text-xl font-bold text-surface-900">${escapeHtml(company.name)}</h1>
              <a href="/account?kind=company&company=${company.id}" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-brand-200 bg-brand-50 text-brand-600 text-sm font-medium hover:bg-brand-100 transition no-underline">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                订阅该公司新职位
              </a>
            </div>
            <div class="flex flex-wrap items-center gap-3 mt-1 text-sm text-surface-400">
              ${location ? `<span>${company.country_flag_emoji || '🌍'} ${escapeHtml(location)}</span>` : ''}
              ${company.website ? `<a href="${escapeHtml(company.website)}" target="_blank" rel="noopener nofollow" class="text-brand-500 hover:text-brand-600 no-underline">${escapeHtml(websiteHost)} ↗</a>` : ''}
              <span>远程招聘中</span>
            </div>
            ${company.description ? `<p class="text-sm text-surface-600 leading-relaxed mt-3">${escapeHtml(company.description)}</p>` : ''}
          </div>
        </div>
        ${statsHtml}
      </div>

      <div class="bg-white rounded shadow-sm border border-surface-200 overflow-hidden">
        ${jobs.map(j => renderJobRow(j)).join('')}
      </div>
      ${(page > 1 || hasMore) ? `
        <div class="flex justify-center gap-2 mt-6">
          ${page > 1 ? `<a href="/company/${escapeHtml(company.slug)}?page=${page - 1}" class="px-4 py-2 rounded bg-white border border-surface-200 text-sm hover:bg-surface-50 transition no-underline text-surface-600">← 上一页</a>` : ''}
          ${hasMore ? `<a href="/company/${escapeHtml(company.slug)}?page=${page + 1}" class="px-4 py-2 rounded bg-white border border-surface-200 text-sm hover:bg-surface-50 transition no-underline text-surface-600">下一页 →</a>` : ''}
        </div>
      ` : ''}
    </div>`;

  const pageTitle = `${company.name} 远程工作 - 远程岛`;
  const pageDesc = company.description
    ? `${company.description.slice(0, 90)}${company.description.length > 90 ? '…' : ''} 查看 ${company.name} 全部在招远程职位。`
    : `${company.name} 远程岗位正在招聘${location ? `，总部位于${location}` : ''}。查看所有在招职位并直接申请。`;

  return layout(pageTitle, content, {
    gaId,
    description: pageDesc,
    keywords: `${company.name},远程工作,远程招聘,远程岛`,
    canonical: siteUrl ? `${siteUrl}/company/${company.slug}${page > 1 ? `?page=${page}` : ''}` : undefined,
    ogImage: company.thumbnail || undefined,
    staticUrl,
    activePath: '/companies',
    user,
  });
}
