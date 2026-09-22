export const FAVORITE_STATUSES = [
  { value: 'saved', label: '感兴趣', css: 'bg-surface-100 text-surface-700' },
  { value: 'applied', label: '已申请', css: 'bg-sky-50 text-sky-700' },
  { value: 'interviewing', label: '面试中', css: 'bg-amber-50 text-amber-700' },
  { value: 'offer', label: '已拿 Offer', css: 'bg-green-50 text-green-700' },
  { value: 'rejected', label: '未通过', css: 'bg-red-50 text-red-600' },
  { value: 'archived', label: '已归档', css: 'bg-surface-50 text-surface-400' },
] as const;

export type FavoriteStatus = (typeof FAVORITE_STATUSES)[number]['value'];

const STATUS_SET = new Set<string>(FAVORITE_STATUSES.map((s) => s.value));

export function isFavoriteStatus(value: unknown): value is FavoriteStatus {
  return typeof value === 'string' && STATUS_SET.has(value);
}

export function favoriteStatusMeta(value: string): { label: string; css: string } {
  const found = FAVORITE_STATUSES.find((s) => s.value === value);
  return found ? { label: found.label, css: found.css } : { label: value, css: 'bg-surface-100 text-surface-700' };
}
