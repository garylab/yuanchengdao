export const DEFAULT_MAX_LIST_PAGE = 10;

export function maxListPage(env: { MAX_LIST_PAGE?: string } | undefined): number {
  const raw = env?.MAX_LIST_PAGE?.trim();
  if (!raw) return DEFAULT_MAX_LIST_PAGE;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_MAX_LIST_PAGE;
  return Math.min(parsed, 500);
}

export function normalizedListPage(
  url: URL,
  env: { MAX_LIST_PAGE?: string } | undefined,
): { page: number; redirectPath: string | null } {
  const cap = maxListPage(env);
  const parsed = parseInt(url.searchParams.get('page') || '1', 10);
  const rawPage = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
  if (rawPage > cap) {
    const next = new URL(url.toString());
    next.searchParams.set('page', String(cap));
    return { page: cap, redirectPath: `${next.pathname}${next.search}` };
  }
  return { page: rawPage, redirectPath: null };
}

export function clampedListPage(url: URL, env: { MAX_LIST_PAGE?: string } | undefined): number {
  const cap = maxListPage(env);
  const parsed = parseInt(url.searchParams.get('page') || '1', 10);
  const rawPage = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
  return Math.min(cap, rawPage);
}
