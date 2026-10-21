import { Env } from '../types';

const TITLE_LIKE_LIMIT = 100;

// Search is a plain substring match on the title, newest first. Titles are
// stored in Chinese with technical terms kept verbatim, so both "前端" and
// "React" hit; the query is matched as one string, not split into words.
export function titleLikePattern(query: string): string {
  return `%${query.trim().replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
}

export async function searchJobIdsByTitle(
  env: Env,
  query: string,
  activeCutoff: string,
): Promise<number[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const result = await env.DB.prepare(
    `SELECT id FROM jobs
     WHERE posted_at >= ? AND title LIKE ? ESCAPE '\\'
     ORDER BY posted_at DESC
     LIMIT ${TITLE_LIKE_LIMIT}`
  ).bind(activeCutoff, titleLikePattern(trimmed)).all<{ id: number }>();
  return (result.results || []).map((row) => row.id);
}
