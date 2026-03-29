import { Job } from '../types';
import { layout } from './layout';
import { timeAgo, formatSalary, escapeHtml, rewriteUtm, breadcrumb, companyLogo, locationRequirementBadge } from '../utils/helpers';

function payCycleToUnitText(cycle: string): string {
  switch (cycle) {
    case 'hour': return 'HOUR';
    case 'day': return 'DAY';
    case 'week': return 'WEEK';
    case 'month': return 'MONTH';
    default: return 'YEAR';
  }
}

function buildJobJsonLd(job: Job, siteUrl?: string): string {
  const location = [job.location_name_cn, job.country_name_cn].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ') || '远程';

  const datePosted = job.posted_at || job.created_at;
  const validThrough = new Date(new Date(datePosted).getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description,
    datePosted,
    validThrough,
    jobLocationType: 'TELECOMMUTE',
    employmentType: 'FULL_TIME',
    applicantLocationRequirements: {
      '@type': 'Country',
      name: (job.country_code || 'CN').toUpperCase(),
    },
    jobLocation: {
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressLocality: location },
    },
  };

  if (siteUrl && job.slug) {
    ld.url = `${siteUrl}/job/${job.slug}`;
  }

  if (job.company_name) {
    const org: Record<string, unknown> = {
      '@type': 'Organization',
      name: job.company_name,
    };
    if (job.company_thumbnail) org.logo = job.company_thumbnail;
    ld.hiringOrganization = org;
  }

  if (job.salary_lower || job.salary_upper) {
    ld.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: job.salary_currency || 'USD',
      value: {
        '@type': 'QuantitativeValue',
        ...(job.salary_lower ? { minValue: job.salary_lower } : {}),
        ...(job.salary_upper ? { maxValue: job.salary_upper } : {}),
        unitText: payCycleToUnitText(job.salary_pay_cycle),
      },
    };
  }

  const applyOptions = job.apply_options ? JSON.parse(job.apply_options) as Array<{ title: string; link: string }> : [];
  if (applyOptions.length > 0) {
    ld.directApply = true;
  }

  return JSON.stringify(ld);
}

export function jobDetailPage(job: Job, similarJobs: Job[] = [], gaId?: string, siteUrl?: string, staticUrl?: string, isExpired = false): string {
  const salary = formatSalary(job.salary_lower, job.salary_upper, job.salary_currency, job.salary_pay_cycle);
  const posted = timeAgo(job.posted_at || job.created_at);

  const highlights = job.job_highlights ? JSON.parse(job.job_highlights) as Array<{ title: string; items: string[] }> : [];
  const applyOptions = job.apply_options ? JSON.parse(job.apply_options) as Array<{ title: string; link: string }> : [];
  const primaryApply = applyOptions[0]?.link ? rewriteUtm(applyOptions[0].link) : null;

  const descriptionHtml = escapeHtml(job.description)
    .replace(/\n\n/g, '</p><p class="mb-3">')
    .replace(/\n/g, '<br>');

  const bc = breadcrumb([
    { label: '首页', href: '/' },
    { label: job.company_name || '', href: job.company_slug ? `/company/${job.company_slug}` : undefined },
    { label: job.title },
  ]);

  const similarSection = similarJobs.length > 0 ? `
    <aside class="w-full lg:w-72 flex-shrink-0">
      <div>
        <div class="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden">
          <div class="px-3 py-2.5">
            <h2 class="text-sm font-bold text-surface-900">相似职位</h2>
          </div>
          <div class="divide-y divide-surface-100">
          ${similarJobs.map(sj => {
            const sjLocation = [sj.location_name_cn, sj.country_name_cn].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ') || '远程';
            const sjPosted = timeAgo(sj.posted_at || '');
            return `
              <a href="/job/${escapeHtml(sj.slug)}" class="flex items-center gap-2.5 px-3 py-2.5 hover:bg-brand-50 transition no-underline text-inherit">
                ${companyLogo(sj.company_name, sj.company_thumbnail, 'sm')}
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-medium text-surface-900 line-clamp-2 leading-snug">${escapeHtml(sj.title)}</div>
                  <div class="text-[11px] text-surface-400 mt-0.5 truncate">${escapeHtml(sj.company_name || '')} · ${escapeHtml(sjLocation)} · ${sjPosted}</div>
                </div>
              </a>`;
          }).join('')}
          </div>
        </div>
      </div>
    </aside>` : '';

  const expiredBanner = isExpired ? `
    <div class="max-w-5xl mx-auto px-4 mt-4">
      <div class="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
        ⚠️ 此职位已过期，信息仅供参考。
      </div>
    </div>` : '';

  const content = `
    ${bc}
    ${expiredBanner}
    <div class="max-w-5xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">
      <div class="flex-1 min-w-0 max-w-3xl">
        <div class="bg-white rounded-xl shadow-sm border border-surface-200 p-6">
          <!-- Header -->
          <div class="flex items-start gap-4">
            ${companyLogo(job.company_name, job.company_thumbnail, 'lg')}
            <div class="flex-1">
              <h1 class="text-xl sm:text-2xl font-bold text-surface-900 mb-1">${escapeHtml(job.title)}</h1>
              <div class="flex flex-wrap items-center gap-3 text-sm text-surface-500 mt-1">
                ${job.company_slug
                  ? `<a href="/company/${escapeHtml(job.company_slug)}" class="font-medium text-surface-700 hover:text-brand-500 transition no-underline">${escapeHtml(job.company_name || '')}</a>`
                  : `<span class="font-medium text-surface-700">${escapeHtml(job.company_name || '')}</span>`
                }
                ${(() => {
                  const f = job.country_flag_emoji || '🌍';
                  const loc = escapeHtml([job.location_name_cn, job.country_name_cn].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ') || '远程');
                  return job.location_slug
                    ? `<a href="/location/${escapeHtml(job.location_slug)}" class="hover:text-brand-500 transition no-underline">${f} ${loc}</a>`
                    : `<span>${f} ${loc}</span>`;
                })()}
                ${salary ? `<span class="text-green-600 font-medium">💰 ${salary}</span>` : ''}
                ${locationRequirementBadge(job.location_requirement)}
                <span>${posted}</span>
              </div>
            </div>
          </div>

          ${primaryApply ? `
            <div class="mt-6">
              <a href="${escapeHtml(primaryApply)}" target="_blank" rel="noopener noreferrer"
                class="apply-btn inline-block bg-brand-500 text-white px-8 py-3 rounded-xl font-semibold text-base hover:bg-brand-600 transition shadow-sm"
                data-from="detail-top" data-job="${escapeHtml(job.title)}" data-company="${escapeHtml(job.company_name || '')}">
                立即申请
              </a>
            </div>
          ` : ''}

          <!-- Highlights -->
          ${highlights.length > 0 ? `
            <div class="mt-6 pt-6 border-t border-surface-100">
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
          <div class="mt-6 pt-6 border-t border-surface-100">
            <h2 class="text-lg font-bold mb-4">职位描述</h2>
            <div class="text-surface-700 leading-relaxed text-sm">
              <p class="mb-3">${descriptionHtml}</p>
            </div>
          </div>

          <!-- Apply options -->
          ${applyOptions.length > 0 ? `
            <div class="mt-6 pt-6 border-t border-surface-100">
              <h2 class="text-lg font-bold mb-3">申请渠道</h2>
              <div class="space-y-2">
                ${applyOptions.map((opt, i) => `
                  <a href="${escapeHtml(rewriteUtm(opt.link))}" target="_blank" rel="noopener noreferrer"
                    class="apply-btn flex items-center p-3 rounded-lg hover:bg-brand-50 transition no-underline text-inherit"
                    data-from="detail-${escapeHtml(opt.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))}-link" data-job="${escapeHtml(job.title)}" data-company="${escapeHtml(job.company_name || '')}">
                    <span class="text-sm font-medium">${escapeHtml(opt.title)}</span>
                    <span class="flex-1 border-b border-dashed border-surface-200 mx-3"></span>
                    <span class="text-xs text-brand-500 flex-shrink-0">前往申请</span>
                  </a>
                `).join('')}
              </div>
            </div>
          ` : ''}

          ${primaryApply ? `
            <div class="mt-6 pt-6 border-t border-surface-100 text-center">
              <a href="${escapeHtml(primaryApply)}" target="_blank" rel="noopener noreferrer"
                class="apply-btn inline-block bg-brand-500 text-white px-10 py-3.5 rounded-xl font-semibold text-lg hover:bg-brand-600 transition shadow-md"
                data-from="detail-bottom" data-job="${escapeHtml(job.title)}" data-company="${escapeHtml(job.company_name || '')}">
                立即申请
              </a>
              <p class="text-xs text-surface-400 mt-2">将跳转至招聘方页面</p>
            </div>
          ` : ''}
        </div>
      </div>

      ${similarSection}
    </div>`;

  const locationLabel = [job.location_name_cn, job.country_name_cn].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ') || '远程';
  const salarySnippet = salary ? `，薪资 ${salary}` : '';
  const pageDesc = `${job.company_name || ''} 招聘 ${job.title}（远程）${locationLabel !== '远程' ? `，地点 ${locationLabel}` : ''}${salarySnippet}。查看完整职位描述、福利待遇，直接申请。`;
  const canonical = siteUrl ? `${siteUrl}/job/${job.slug}` : undefined;
  const jsonLd = buildJobJsonLd(job, siteUrl);

  const pageTitle = [job.title, job.company_name ? `${job.company_name} 远程工作` : '远程工作', '远程岛'].filter(Boolean).join(' - ');

  return layout(pageTitle, content, {
    description: pageDesc,
    gaId,
    canonical,
    jsonLd,
    ogImage: job.company_thumbnail || undefined,
    keywords: [job.title, job.company_name, locationLabel, '远程工作', 'remote job'].filter(Boolean).join(','),
    staticUrl,
    activePath: '/',
  });
}
