/**
 * Build an FTS5 MATCH query from user input.
 *
 * At index-time, nodejieba segments Chinese text into space-separated tokens
 * stored in the FTS5 table. At query-time we split user input on whitespace
 * and wrap each part in double-quotes so FTS5 treats them as exact tokens
 * (AND-ed together). This means:
 *   - "工程师"      →  "工程师"       → matches the indexed token
 *   - "前端 工程师"  →  "前端" "工程师" → matches both tokens
 *   - "Golang"      →  "Golang"       → matches English tokens
 */
export function tokenizeForFtsMatch(text: string): string {
  const terms = text.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return '""';
  return terms.map((t) => `"${t.replace(/"/g, '""')}"`).join(' ');
}
