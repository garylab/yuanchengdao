import { Env } from '../types';

function averageVectors(vectors: number[][]): number[] | null {
  if (vectors.length === 0) return null;
  const dim = vectors[0].length;
  const sum = new Array<number>(dim).fill(0);
  for (const v of vectors) {
    if (v.length !== dim) continue;
    for (let i = 0; i < dim; i++) sum[i] += v[i];
  }
  let norm = 0;
  for (let i = 0; i < dim; i++) {
    sum[i] /= vectors.length;
    norm += sum[i] * sum[i];
  }
  norm = Math.sqrt(norm) || 1;
  return sum.map((x) => x / norm);
}

export async function recommendJobIdsForUser(
  env: Env,
  userId: number,
  limit = 10,
): Promise<number[]> {
  const favResult = await env.DB.prepare(
    `SELECT job_id FROM favorites
     WHERE user_id = ? AND job_id IS NOT NULL AND status != 'archived'
     ORDER BY updated_at DESC LIMIT 20`
  ).bind(userId).all<{ job_id: number }>();
  const favIds = (favResult.results || []).map((r) => r.job_id);
  if (favIds.length === 0) return [];

  let vectors: number[][] = [];
  try {
    const fetched = await env.VECTORIZE.getByIds(favIds.map(String));
    vectors = fetched.map((v) => Array.from(v.values as ArrayLike<number>)).filter((v) => v.length > 0);
  } catch (err) {
    console.error('Vectorize getByIds failed', err);
    return [];
  }
  const centroid = averageVectors(vectors);
  if (!centroid) return [];

  const exclude = new Set(favIds);
  const results = await env.VECTORIZE.query(centroid, {
    topK: Math.min(limit + favIds.length + 10, 100),
    returnValues: false,
    returnMetadata: 'none',
  });
  const ids: number[] = [];
  for (const match of results.matches) {
    const id = parseInt(match.id, 10);
    if (!Number.isFinite(id) || exclude.has(id)) continue;
    ids.push(id);
    if (ids.length >= limit * 2) break;
  }
  return ids;
}
