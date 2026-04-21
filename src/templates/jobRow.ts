import { Job } from '../types';
import { timeAgo, jobDisplayTimestamp, formatSalary, escapeHtml, rewriteUtm, companyLogo, locationRequirementBadge, englishLevelBadge, scheduleTypeBadge } from '../utils/helpers';

export interface JobRowOptions {
  dataFrom: string;
  showLogo?: boolean;
  showCompany?: boolean;
  showLocation?: boolean;
  showScheduleBadge?: boolean;
  showNewBadge?: boolean;
  isNew?: boolean;
}

const CSS_JOB_ROW = 'job-row border-b border-surface-100';
const CSS_JOB_ROW_HEADER = 'job-row-header flex items-center gap-4 px-4 py-4 cursor-pointer select-none';
const CSS_TITLE_ROW = 'flex flex-wrap items-baseline gap-x-3 gap-y-1';
const CSS_JOB_TITLE = 'job-title font-semibold text-surface-900 text-sm sm:text-base hover:text-brand-500 transition no-underline';
const CSS_COMPANY_LINK = 'text-sm text-surface-500 hover:text-brand-500 transition no-underline flex-shrink-0';
const CSS_COMPANY_SPAN = 'text-sm text-surface-500 flex-shrink-0';
const CSS_LOCATION_LINK = 'text-xs text-surface-400 hover:text-brand-500 transition no-underline flex-shrink-0';
const CSS_LOCATION_SPAN = 'text-xs text-surface-400 flex-shrink-0';
const CSS_BADGE_ROW = 'flex flex-wrap items-center gap-2 mt-1.5';
const CSS_SALARY_BADGE = 'tag-pill bg-green-50 text-green-700 text-xs';
const CSS_POSTED = 'text-xs text-surface-400';
const CSS_EXPAND_PANEL = 'job-expand hidden px-4 pb-4';
const CSS_DESCRIPTION = 'text-sm text-surface-600 leading-relaxed mb-4 whitespace-pre-line';
const CSS_HIGHLIGHTS_WRAP = 'mb-4 space-y-3';
const CSS_HIGHLIGHT_TITLE = 'text-xs font-semibold text-surface-500 uppercase mb-1';
const CSS_HIGHLIGHT_LIST = 'list-disc list-inside text-sm text-surface-600 space-y-0.5';
const CSS_APPLY_BTN = 'apply-btn inline-block bg-brand-500 text-white px-6 py-2 rounded text-sm font-medium hover:bg-brand-600 transition no-underline';
const CSS_DETAIL_LINK = 'text-sm text-brand-500 hover:text-brand-600 transition no-underline';
const CSS_COLLAPSE_BTN = 'job-collapse p-2 rounded-full hover:bg-surface-100 transition text-surface-400 hover:text-surface-600';

const COLLAPSE_ICON = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>';

export function renderJobRow(job: Job, options: JobRowOptions): string {
  const {
    dataFrom,
    showLogo = true,
    showCompany = true,
    showLocation = true,
    showScheduleBadge = true,
    showNewBadge = false,
    isNew = false,
  } = options;

  const salary = formatSalary(job.salary_lower, job.salary_upper, job.salary_currency, job.salary_pay_cycle);
  const posted = timeAgo(jobDisplayTimestamp(job));
  const logo = showLogo ? companyLogo(job.company_name, job.company_thumbnail) : '';
  const scheduleBadge = showScheduleBadge ? scheduleTypeBadge(job.detected_extensions) : '';

  const locationLabel = [job.location_name_cn, job.country_name_cn]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ') || '远程';
  const flag = job.country_flag_emoji || '🌍';
  const locationHtml = showLocation
    ? (job.location_slug
      ? `<a href="/location/${escapeHtml(job.location_slug)}" class="${CSS_LOCATION_LINK}">${flag} ${escapeHtml(locationLabel)}</a>`
      : `<span class="${CSS_LOCATION_SPAN}">${flag} ${escapeHtml(locationLabel)}</span>`)
    : '';

  const companyHtml = showCompany
    ? (job.company_slug
      ? `<a href="/company/${escapeHtml(job.company_slug)}" class="${CSS_COMPANY_LINK}">${escapeHtml(job.company_name || '')}</a>`
      : `<span class="${CSS_COMPANY_SPAN}">${escapeHtml(job.company_name || '')}</span>`)
    : '';

  const highlights = job.job_highlights ? JSON.parse(job.job_highlights) as Array<{ title: string; items: string[] }> : [];
  const applyOptions = job.apply_options ? JSON.parse(job.apply_options) as Array<{ title: string; link: string }> : [];
  const primaryApply = applyOptions[0]?.link ? rewriteUtm(applyOptions[0].link) : null;

  const expandIndent = showLogo ? 'ml-16 ' : '';

  return `
    <div class="${CSS_JOB_ROW}" data-job-id="${job.id}">
      <div class="${CSS_JOB_ROW_HEADER}">
        ${logo}
        <div class="flex-1 min-w-0">
          <div class="${CSS_TITLE_ROW}">
            <a href="/job/${escapeHtml(job.slug)}" class="${CSS_JOB_TITLE}">${escapeHtml(job.title)}</a>
            ${companyHtml}
            ${showNewBadge && isNew ? '<img src="/new2x.webp" alt="New" class="h-4 flex-shrink-0">' : ''}
          </div>
          <div class="${CSS_BADGE_ROW}">
            ${locationHtml}
            ${scheduleBadge}
            ${salary ? `<span class="${CSS_SALARY_BADGE}">💰 ${salary}</span>` : ''}
            ${locationRequirementBadge(job.location_requirement)}
            ${englishLevelBadge(job.english_level_required)}
            <span class="${CSS_POSTED} flex-shrink-0 sm:hidden">${posted}</span>
          </div>
        </div>
        <div class="hidden sm:flex items-center gap-3 flex-shrink-0">
          <div class="${CSS_POSTED} text-right">${posted}</div>
        </div>
      </div>

      <div class="${CSS_EXPAND_PANEL}">
        <div class="${expandIndent}border-t border-surface-100 pt-4">
          <div class="${CSS_DESCRIPTION}">${escapeHtml(job.description)}</div>
          ${highlights.length > 0 ? `
            <div class="${CSS_HIGHLIGHTS_WRAP}">
              ${highlights.map(h => `
                <div>
                  <h4 class="${CSS_HIGHLIGHT_TITLE}">${escapeHtml(h.title)}</h4>
                  <ul class="${CSS_HIGHLIGHT_LIST}">
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
                  class="${CSS_APPLY_BTN}"
                  data-from="${dataFrom}" data-job="${escapeHtml(job.title)}" data-company="${escapeHtml(job.company_name || '')}">
                  申请
                </a>
              ` : ''}
              <a href="/job/${escapeHtml(job.slug)}" class="${CSS_DETAIL_LINK}">详情</a>
            </div>
            <button class="${CSS_COLLAPSE_BTN}" title="收起">${COLLAPSE_ICON}</button>
          </div>
        </div>
      </div>
    </div>`;
}
