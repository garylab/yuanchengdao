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
