function dateCutoff(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 19).replace('T', ' ');
}

export function activeCutoff(): string {
  return dateCutoff(30);
}

export function expiredCutoff(): string {
  return dateCutoff(90);
}

export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '最近';
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 30) return `${days}天前`;
  if (days < 365) return `${Math.floor(days / 30)}个月前`;
  return `${Math.floor(days / 365)}年前`;
}

export function formatBeijingTime(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

const CYCLE_LABELS: Record<string, string> = {
  hour: '/时',
  day: '/天',
  week: '/周',
  month: '/月',
  year: '/年',
};

export function formatSalary(lower: number, upper: number, currency: string, payCycle: string): string {
  if (!lower && !upper) return '';
  const sym = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : `${currency} `;
  const fmt = (n: number) => {
    if (n >= 10000) return `${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}万`;
    if (n >= 1000) return `${Math.round(n / 1000)}k`;
    return n.toString();
  };
  const cycle = CYCLE_LABELS[payCycle] || '/年';
  if (lower && upper) return `${sym}${fmt(lower)} - ${sym}${fmt(upper)}${cycle}`;
  if (lower) return `${sym}${fmt(lower)}+${cycle}`;
  if (upper) return `最高 ${sym}${fmt(upper)}${cycle}`;
  return '';
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.substring(0, len) + '...';
}

export function resolveThumbnail(thumb: string | null | undefined, staticUrl: string): string | undefined {
  if (!thumb) return undefined;
  if (thumb.startsWith('http://') || thumb.startsWith('https://')) return thumb;
  return `${staticUrl}/${thumb}`;
}

export function breadcrumb(items: Array<{ label: string; href?: string }>): string {
  const parts = items.map((item, i) => {
    if (i === items.length - 1) {
      return `<span class="text-surface-500">${escapeHtml(item.label)}</span>`;
    }
    return `<a href="${item.href || '/'}" class="text-surface-400 hover:text-brand-500 transition no-underline">${escapeHtml(item.label)}</a>`;
  });
  return `<nav class="max-w-5xl mx-auto px-4 mt-4 text-xs flex items-center gap-1.5">${parts.join('<span class="text-surface-300">/</span>')}</nav>`;
}

export function companyLogo(name: string | null | undefined, thumbnail: string | null | undefined, size: 'sm' | 'md' | 'lg' = 'md'): string {
  const companyName = name || '?';
  const firstWord = companyName.split(/\s+/)[0];
  const label = firstWord.length <= 7 ? firstWord : companyName[0];
  const escaped = escapeHtml(label);
  const alt = escapeHtml(companyName);

  const cfg: Record<string, { wh: string; rounded: string; pad: string; fontSize: string }> = {
    sm:  { wh: 'w-8 h-8',   rounded: 'rounded-lg', pad: 'p-0.5', fontSize: label.length <= 2 ? 'text-xs' : 'text-[9px]' },
    md:  { wh: 'w-12 h-12', rounded: 'rounded-lg', pad: 'p-1.5', fontSize: label.length <= 2 ? 'text-lg' : label.length <= 5 ? 'text-xs' : 'text-[10px]' },
    lg:  { wh: 'w-16 h-16', rounded: 'rounded-xl', pad: 'p-2',   fontSize: label.length <= 2 ? 'text-xl' : label.length <= 5 ? 'text-sm' : 'text-xs' },
  };
  const c = cfg[size];

  const fallbackDisplay = thumbnail ? 'hidden' : 'flex';
  const fallback = `<div class="${fallbackDisplay} ${c.wh} ${c.rounded} bg-brand-50 items-center justify-center ${c.fontSize} font-bold text-brand-500 leading-tight text-center overflow-hidden ${c.pad}">${escaped}</div>`;

  const img = thumbnail
    ? `<img src="${escapeHtml(thumbnail)}" alt="${alt}" class="${c.wh} ${c.rounded} object-contain bg-surface-100 flex-shrink-0" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';

  return `<div class="flex-shrink-0 ${c.wh}">${img}${fallback}</div>`;
}

const LOCATION_REQ_LABELS: Record<string, { icon: string; label: string; css: string }> = {
  country:    { icon: '📍', label: '限本国',      css: 'bg-amber-50 text-amber-700' },
  region:     { icon: '🗺️', label: '限特定地区',  css: 'bg-orange-50 text-orange-700' },
  timezone:   { icon: '🕐', label: '限时区',      css: 'bg-violet-50 text-violet-700' },
  authorized: { icon: '📋', label: '需工作许可',  css: 'bg-red-50 text-red-700' },
};

export function locationReqBadge(req: string | null | undefined): string {
  if (!req) return '';
  const cfg = LOCATION_REQ_LABELS[req];
  if (!cfg) return '';
  return `<span class="tag-pill ${cfg.css} text-xs font-semibold">${cfg.icon} ${cfg.label}</span>`;
}

export function rewriteUtm(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set('utm_source', 'yuanchengdao.com');
    u.searchParams.set('utm_medium', 'referral');
    u.searchParams.set('utm_campaign', 'yuanchengdao');
    return u.toString();
  } catch {
    return url;
  }
}
