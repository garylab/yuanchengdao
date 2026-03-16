const MAX_BUFFER_SIZE = 500;
const buffer = new Map<string, number>();

export function recordSearch(query: string): void {
  if (!query || query.length > 100) return;
  if (buffer.size >= MAX_BUFFER_SIZE) return;
  buffer.set(query, (buffer.get(query) || 0) + 1);
}

export async function flushSearchBuffer(db: D1Database): Promise<number> {
  if (buffer.size === 0) return 0;

  const entries = Array.from(buffer.entries());
  buffer.clear();

  let flushed = 0;
  for (const [query, count] of entries) {
    try {
      await db.prepare(
        `INSERT INTO user_searches (query, search_count) VALUES (?, ?)
         ON CONFLICT(query) DO UPDATE SET search_count = search_count + ?, updated_at = datetime('now')`
      ).bind(query, count, count).run();
      flushed++;
    } catch {
      // ignore individual failures
    }
  }

  if (flushed > 0) {
    console.log(`Flushed ${flushed} search queries to DB`);
  }
  return flushed;
}
