import { Env } from '../types';
import { searchByVector } from './vectorSearch';

const AGGREGATOR_LIKE_LIMIT = 100;

export async function hybridSearchJobIds(
  env: Env,
  query: string,
  activeCutoff: string,
): Promise<number[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const likePattern = `%${trimmed.replace(/[%_]/g, (m) => `\\${m}`)}%`;
  const [likeResult, vectorIds] = await Promise.all([
    env.DB.prepare(
      `SELECT j.id FROM jobs j
       LEFT JOIN companies co ON co.id = j.company_id
       WHERE j.posted_at >= ?
         AND (j.title LIKE ? ESCAPE '\\' OR co.name LIKE ? ESCAPE '\\')
       ORDER BY j.created_at DESC
       LIMIT ${AGGREGATOR_LIKE_LIMIT}`
    ).bind(activeCutoff, likePattern, likePattern).all<{ id: number }>(),
    searchByVector(env.AI, env.VECTORIZE, trimmed).catch((err) => {
      console.error('Vector search failed', err);
      return [] as number[];
    }),
  ]);

  const ordered: number[] = [];
  const seen = new Set<number>();
  for (const row of likeResult.results || []) {
    if (!seen.has(row.id)) { seen.add(row.id); ordered.push(row.id); }
  }
  for (const id of vectorIds) {
    if (!seen.has(id)) { seen.add(id); ordered.push(id); }
  }
  return ordered;
}
