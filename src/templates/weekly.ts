import { AuthUser } from '../types';
import { layout } from './layout';
import { breadcrumb, escapeHtml } from '../utils/helpers';
import type { WeeklyReport } from '../services/weekly';

export function weeklyPage(
  report: WeeklyReport | null,
  weeks: string[],
  opts: { gaId?: string; siteUrl?: string; staticUrl?: string; user?: AuthUser | null; isLatest?: boolean },
): string {
  const bc = breadcrumb([
    { label: '首页', href: '/' },
    { label: '周报', href: '/weekly-reports' },
  ]);

  const weekNav = weeks.length > 0 ? `
    <div class="flex flex-wrap gap-2 text-xs mb-4">
      ${weeks.map((w) => {
        const active = report && report.weekStart === w;
        return `<a href="/weekly-reports/${escapeHtml(w)}" class="px-2.5 py-1 rounded-full no-underline transition ${active ? 'bg-brand-500 text-white' : 'bg-white border border-surface-200 text-surface-600 hover:border-brand-300 hover:text-brand-600'}">${escapeHtml(w)} 起</a>`;
      }).join('')}
    </div>` : '';

  let body: string;
  if (!report) {
    body = `<div class="bg-white rounded shadow-sm border border-surface-200 px-6 py-16 text-center text-surface-500">周报还没有生成，每周一早上会自动生成上周的汇总。</div>`;
  } else {
    const salaryList = report.topSalaryJobs.map((j, i) => `
      <li class="flex items-start gap-3 py-2.5 border-b border-surface-100 last:border-0">
        <span class="text-xs text-surface-400 w-5 pt-0.5 text-right">${i + 1}</span>
        <div class="min-w-0 flex-1">
          <a href="/job/${escapeHtml(j.slug)}" class="text-sm font-medium text-surface-900 hover:text-brand-600 no-underline line-clamp-1">${escapeHtml(j.title)}</a>
          <div class="text-xs text-surface-500 mt-0.5">${escapeHtml(j.company_name)} · ${escapeHtml(j.location_label)}${j.salary_label ? ` · <span class="text-green-700">${escapeHtml(j.salary_label)}</span>` : ''}</div>
        </div>
      </li>`).join('');

    const catChips = report.topCategories.map((c) => `<a href="/category/${escapeHtml(c.slug)}" class="px-3 py-1.5 rounded bg-white border border-surface-200 text-sm text-surface-700 hover:border-brand-300 hover:text-brand-600 transition no-underline">${escapeHtml(c.term_cn)} <span class="text-surface-400 text-xs">+${c.count}</span></a>`).join('');
    const countryChips = report.topCountries.map((c) => `<a href="/country/${escapeHtml(c.slug)}" class="px-3 py-1.5 rounded bg-white border border-surface-200 text-sm text-surface-700 hover:border-brand-300 hover:text-brand-600 transition no-underline">${c.flag} ${escapeHtml(c.name_cn)} <span class="text-surface-400 text-xs">+${c.count}</span></a>`).join('');
    const companyChips = report.newCompanyList.map((c) => `<a href="/company/${escapeHtml(c.slug)}" class="px-3 py-1.5 rounded bg-white border border-surface-200 text-sm text-surface-700 hover:border-brand-300 hover:text-brand-600 transition no-underline">${escapeHtml(c.name)} <span class="text-surface-400 text-xs">${c.job_count}</span></a>`).join('');

    body = `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div class="bg-white rounded shadow-sm border border-surface-200 p-4"><div class="text-xs text-surface-500">本周新增职位</div><div class="text-2xl font-bold text-brand-600 mt-1">${report.newJobs}</div></div>
        <div class="bg-white rounded shadow-sm border border-surface-200 p-4"><div class="text-xs text-surface-500">新入驻雇主</div><div class="text-2xl font-bold text-surface-900 mt-1">${report.newCompanies}</div></div>
        <div class="bg-white rounded shadow-sm border border-surface-200 p-4"><div class="text-xs text-surface-500">未标明英语要求</div><div class="text-2xl font-bold text-surface-900 mt-1">${report.noEnglishNew}</div></div>
        <div class="bg-white rounded shadow-sm border border-surface-200 p-4"><div class="text-xs text-surface-500">中文优先</div><div class="text-2xl font-bold text-surface-900 mt-1">${report.chineseFriendlyNew}</div></div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 bg-white rounded shadow-sm border border-surface-200 p-5">
          <h2 class="text-sm font-semibold text-surface-700 mb-2">本周高薪 Top 10</h2>
          <ol>${salaryList || '<li class="py-6 text-center text-sm text-surface-400">本周暂无标注薪资的新岗位</li>'}</ol>
        </div>
        <div class="space-y-6">
          <div class="bg-white rounded shadow-sm border border-surface-200 p-5">
            <h2 class="text-sm font-semibold text-surface-700 mb-3">活跃职位</h2>
            <div class="flex flex-wrap gap-2">${catChips || '<span class="text-sm text-surface-400">—</span>'}</div>
          </div>
          <div class="bg-white rounded shadow-sm border border-surface-200 p-5">
            <h2 class="text-sm font-semibold text-surface-700 mb-3">新增最多的国家</h2>
            <div class="flex flex-wrap gap-2">${countryChips || '<span class="text-sm text-surface-400">—</span>'}</div>
          </div>
          <div class="bg-white rounded shadow-sm border border-surface-200 p-5">
            <h2 class="text-sm font-semibold text-surface-700 mb-3">新入驻雇主</h2>
            <div class="flex flex-wrap gap-2">${companyChips || '<span class="text-sm text-surface-400">—</span>'}</div>
          </div>
        </div>
      </div>

      ${opts.user ? '' : `<div class="mt-6 bg-brand-50 border border-brand-100 rounded p-4 text-sm text-surface-700 flex flex-wrap items-center justify-between gap-3">
        <span>想每周一早上收到这份周报？登录后默认开启，可在"我的"里关闭。</span>
        <a href="/login?next=%2Fweekly" class="px-3 py-1.5 rounded bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition no-underline">登录 / 注册</a>
      </div>`}`;
  }

  const title = report ? `远程工作周报 ${report.weekStart} ~ ${report.weekEnd}` : '远程工作周报';
  const content = `
    ${bc}
    <div class="max-w-5xl mx-auto px-4 mt-4">
      <div class="flex flex-wrap items-baseline justify-between gap-3 mb-1">
        <h1 class="text-xl font-bold text-surface-900">${escapeHtml(title)}</h1>
        ${report ? `<span class="text-xs text-surface-400">在招职位 ${report.activeJobs} 个</span>` : ''}
      </div>
      <p class="text-sm text-surface-500 mb-4">每周一汇总过去 7 天的远程职位变化：新增岗位、高薪机会、活跃职位与新入驻雇主。</p>
      ${weekNav}
      ${body}
    </div>`;

  return layout(`${title} - 远程岛`, content, {
    gaId: opts.gaId,
    description: report
      ? `${report.weekStart} 至 ${report.weekEnd} 远程岛周报：新增 ${report.newJobs} 个远程职位、${report.newCompanies} 家新雇主，本周高薪 Top 10 与活跃职位一览。`
      : '远程岛每周汇总远程职位市场变化：新增岗位、高薪机会、活跃职位与新入驻雇主。',
    keywords: '远程工作周报,远程职位汇总,remote jobs weekly,远程岛',
    canonical: opts.siteUrl ? `${opts.siteUrl}${opts.isLatest || !report ? '/weekly-reports' : `/weekly-reports/${report.weekStart}`}` : undefined,
    staticUrl: opts.staticUrl,
    activePath: '/weekly-reports',
    user: opts.user,
  });
}
