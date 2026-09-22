import { AuthUser } from '../types';
import { layout } from './layout';
import { breadcrumb, escapeHtml } from '../utils/helpers';

export type SalaryStatRow = {
  term_cn: string;
  slug: string;
  count: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
};

export type SalaryOverall = {
  sampleCount: number;
  totalActive: number;
  median: number;
  p25: number;
  p75: number;
  buckets: Array<{ label: string; count: number }>;
};

function fmtMonthly(v: number): string {
  if (!v) return '—';
  if (v >= 10000) return `¥${(v / 10000).toFixed(1).replace(/\.0$/, '')}万`;
  return `¥${Math.round(v / 100) * 100}`;
}

export function salaryPage(
  rows: SalaryStatRow[],
  overall: SalaryOverall,
  opts: { gaId?: string; siteUrl?: string; staticUrl?: string; user?: AuthUser | null },
): string {
  const bc = breadcrumb([
    { label: '首页', href: '/' },
    { label: '薪资报告', href: '/salary-report' },
  ]);

  const maxBucket = Math.max(1, ...overall.buckets.map((b) => b.count));
  const bucketBars = overall.buckets.map((b) => {
    const width = Math.max(2, Math.round((b.count / maxBucket) * 100));
    return `
      <div class="flex items-center gap-3 text-sm">
        <div class="w-24 text-surface-600 text-right flex-shrink-0">${escapeHtml(b.label)}</div>
        <div class="flex-1 h-5 bg-surface-100 rounded overflow-hidden"><div class="h-full bg-brand-400" style="width:${width}%"></div></div>
        <div class="w-12 text-surface-500 text-xs">${b.count}</div>
      </div>`;
  }).join('');

  const tableRows = rows.map((r, i) => `
    <tr class="border-b border-surface-100 last:border-0 hover:bg-brand-50/40">
      <td class="py-2.5 pr-3 text-surface-400 text-xs">${i + 1}</td>
      <td class="py-2.5 pr-3"><a href="/category/${escapeHtml(r.slug)}" class="text-surface-900 font-medium hover:text-brand-600 no-underline">${escapeHtml(r.term_cn)}</a></td>
      <td class="py-2.5 pr-3 text-right text-surface-500">${r.count}</td>
      <td class="py-2.5 pr-3 text-right text-surface-600">${fmtMonthly(r.p25)}</td>
      <td class="py-2.5 pr-3 text-right font-semibold text-surface-900">${fmtMonthly(r.median)}</td>
      <td class="py-2.5 pr-3 text-right text-surface-600">${fmtMonthly(r.p75)}</td>
      <td class="py-2.5 text-right text-surface-500">${fmtMonthly(r.max)}</td>
    </tr>`).join('');

  const content = `
    ${bc}
    <div class="max-w-5xl mx-auto px-4 mt-4">
      <h1 class="text-xl font-bold text-surface-900 mb-1">远程工作薪资报告</h1>
      <p class="text-sm text-surface-500 mb-5">基于近 30 天在招且标注薪资的 ${overall.sampleCount} 个岗位（占在招岗位 ${overall.totalActive > 0 ? Math.round(overall.sampleCount * 100 / overall.totalActive) : 0}%），统一折算为 <strong>人民币 / 月</strong>；区间型薪资取中位值。仅供参考。</p>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="bg-white rounded shadow-sm border border-surface-200 p-4">
          <div class="text-xs text-surface-500 mb-1">中位数（月薪）</div>
          <div class="text-2xl font-bold text-brand-600">${fmtMonthly(overall.median)}</div>
        </div>
        <div class="bg-white rounded shadow-sm border border-surface-200 p-4">
          <div class="text-xs text-surface-500 mb-1">25% – 75% 分位</div>
          <div class="text-2xl font-bold text-surface-900">${fmtMonthly(overall.p25)} <span class="text-surface-300 text-lg">–</span> ${fmtMonthly(overall.p75)}</div>
        </div>
        <div class="bg-white rounded shadow-sm border border-surface-200 p-4">
          <div class="text-xs text-surface-500 mb-1">有薪资标注的岗位</div>
          <div class="text-2xl font-bold text-surface-900">${overall.sampleCount}</div>
        </div>
      </div>

      <div class="bg-white rounded shadow-sm border border-surface-200 p-5 mb-6">
        <h2 class="text-sm font-semibold text-surface-700 mb-3">月薪分布</h2>
        <div class="space-y-2">${bucketBars}</div>
      </div>

      <div class="bg-white rounded shadow-sm border border-surface-200 p-5 overflow-x-auto">
        <h2 class="text-sm font-semibold text-surface-700 mb-3">按职位（样本 ≥ 5）</h2>
        <table class="w-full text-sm">
          <thead>
            <tr class="text-xs text-surface-500 border-b border-surface-200">
              <th class="py-2 pr-3 text-left font-medium">#</th>
              <th class="py-2 pr-3 text-left font-medium">职位</th>
              <th class="py-2 pr-3 text-right font-medium">样本</th>
              <th class="py-2 pr-3 text-right font-medium">P25</th>
              <th class="py-2 pr-3 text-right font-medium">中位数</th>
              <th class="py-2 pr-3 text-right font-medium">P75</th>
              <th class="py-2 text-right font-medium">最高</th>
            </tr>
          </thead>
          <tbody>${tableRows || '<tr><td colspan="7" class="py-8 text-center text-surface-400">样本不足</td></tr>'}</tbody>
        </table>
      </div>

      <p class="text-xs text-surface-400 mt-4">数据由招聘方公开信息整理，汇率按抓取时的近似值折算；时薪按 160 小时/月、日薪按 21 天/月、年薪按 12 个月折算。</p>
    </div>`;

  return layout('远程工作薪资报告 - 远程岛', content, {
    gaId: opts.gaId,
    description: `远程工作薪资报告：按职位统计近 30 天远程岗位的月薪中位数、25%/75% 分位与分布，统一折算为人民币，帮助你判断报价是否合理。`,
    keywords: '远程工作薪资,远程岗位工资,remote salary,薪资报告,远程岛',
    canonical: opts.siteUrl ? `${opts.siteUrl}/salary-report` : undefined,
    staticUrl: opts.staticUrl,
    activePath: '/salary-report',
    user: opts.user,
  });
}
