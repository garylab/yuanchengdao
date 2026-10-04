import { Hono } from 'hono';
import { Env, AppVariables } from '../types';
import { toSlug } from '../services/jobSync';
import { BlockMatchType, isBlockMatchType, normalizePattern } from '../services/sourceBlocklist';

const taxonomy = new Hono<{ Bindings: Env; Variables: AppVariables }>();

type Guard = { ok: true } | { ok: false; error: string; status: 401 | 403 };

function requireAdmin(user: AppVariables['user']): Guard {
  if (!user) return { ok: false, error: '请先登录', status: 401 };
  if (user.role !== 'admin') return { ok: false, error: '无权限', status: 403 };
  return { ok: true };
}

function parseId(raw: string): number | null {
  const id = parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

// D1 surfaces UNIQUE violations as a raw SQLITE_CONSTRAINT message. Turn that
// into something an admin can act on instead of a 500.
function constraintMessage(err: unknown, fallback: string): string {
  const text = err instanceof Error ? err.message : String(err);
  if (!/UNIQUE constraint failed/i.test(text)) return fallback;
  if (/\.code/.test(text)) return '国家代码已存在';
  if (/\.term/.test(text)) return '该关键词已存在';
  if (/\.pattern/.test(text)) return '该屏蔽规则已存在';
  if (/\.slug/.test(text)) return 'slug 已被占用，请换一个';
  return '已存在重复记录';
}

/** Slug supplied by the admin wins; otherwise derive one from the latin name. */
function resolveSlug(explicit: string, fallbackSource: string): string {
  return toSlug(explicit || fallbackSource);
}

// ---------------------------------------------------------------- countries

taxonomy.post('/api/admin/countries', async (c) => {
  const guard = requireAdmin(c.get('user'));
  if (!guard.ok) return c.json({ error: guard.error }, guard.status);

  const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
  const code = str(body.code).toUpperCase();
  const name = str(body.name);
  const nameCn = str(body.nameCn);
  const slug = resolveSlug(str(body.slug), name);
  const flag = str(body.flagEmoji) || '🌍';
  const timezone = str(body.timezone) || 'UTC';

  if (!code || !name || !nameCn) return c.json({ error: '国家代码、英文名、中文名均为必填' }, 400);
  if (!slug) return c.json({ error: 'slug 无法从英文名生成，请手动填写' }, 400);

  try {
    const res = await c.env.DB.prepare(
      `INSERT INTO countries (code, name, name_cn, slug, flag_emoji, timezone)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(code, name, nameCn, slug, flag, timezone).run();
    return c.json({ ok: true, id: res.meta.last_row_id });
  } catch (err) {
    return c.json({ error: constraintMessage(err, '创建失败') }, 400);
  }
});

taxonomy.post('/api/admin/countries/:id', async (c) => {
  const guard = requireAdmin(c.get('user'));
  if (!guard.ok) return c.json({ error: guard.error }, guard.status);

  const id = parseId(c.req.param('id'));
  if (!id) return c.json({ error: '无效国家' }, 400);

  const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
  const name = str(body.name);
  const nameCn = str(body.nameCn);
  const slug = resolveSlug(str(body.slug), name);
  const flag = str(body.flagEmoji) || '🌍';
  const timezone = str(body.timezone) || 'UTC';

  if (!name || !nameCn) return c.json({ error: '英文名、中文名均为必填' }, 400);
  if (!slug) return c.json({ error: 'slug 不能为空' }, 400);

  try {
    const res = await c.env.DB.prepare(
      `UPDATE countries SET name = ?, name_cn = ?, slug = ?, flag_emoji = ?, timezone = ? WHERE id = ?`
    ).bind(name, nameCn, slug, flag, timezone, id).run();
    if (!res.meta.changes) return c.json({ error: '国家不存在' }, 404);
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: constraintMessage(err, '保存失败') }, 400);
  }
});

taxonomy.post('/api/admin/countries/:id/toggle', async (c) => {
  const guard = requireAdmin(c.get('user'));
  if (!guard.ok) return c.json({ error: guard.error }, guard.status);

  const id = parseId(c.req.param('id'));
  if (!id) return c.json({ error: '无效国家' }, 400);

  const row = await c.env.DB.prepare('SELECT is_active FROM countries WHERE id = ?')
    .bind(id).first<{ is_active: number }>();
  if (!row) return c.json({ error: '国家不存在' }, 404);

  const next = row.is_active ? 0 : 1;
  await c.env.DB.prepare('UPDATE countries SET is_active = ? WHERE id = ?').bind(next, id).run();
  return c.json({ ok: true, isActive: next === 1 });
});

// ---------------------------------------------------------------- locations

taxonomy.post('/api/admin/locations', async (c) => {
  const guard = requireAdmin(c.get('user'));
  if (!guard.ok) return c.json({ error: guard.error }, guard.status);

  const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
  const name = str(body.name);
  const nameCn = str(body.nameCn);
  const slug = resolveSlug(str(body.slug), name);
  const countryId = parseId(str(body.countryId));

  if (!name || !nameCn) return c.json({ error: '英文名、中文名均为必填' }, 400);
  if (!slug) return c.json({ error: 'slug 无法从英文名生成，请手动填写' }, 400);
  if (!countryId) return c.json({ error: '请选择所属国家' }, 400);

  const country = await c.env.DB.prepare('SELECT id FROM countries WHERE id = ?')
    .bind(countryId).first<{ id: number }>();
  if (!country) return c.json({ error: '所属国家不存在' }, 400);

  try {
    const res = await c.env.DB.prepare(
      `INSERT INTO locations (name, name_cn, slug, country_id) VALUES (?, ?, ?, ?)`
    ).bind(name, nameCn, slug, countryId).run();
    return c.json({ ok: true, id: res.meta.last_row_id });
  } catch (err) {
    return c.json({ error: constraintMessage(err, '创建失败') }, 400);
  }
});

taxonomy.post('/api/admin/locations/:id', async (c) => {
  const guard = requireAdmin(c.get('user'));
  if (!guard.ok) return c.json({ error: guard.error }, guard.status);

  const id = parseId(c.req.param('id'));
  if (!id) return c.json({ error: '无效地区' }, 400);

  const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
  const name = str(body.name);
  const nameCn = str(body.nameCn);
  const slug = resolveSlug(str(body.slug), name);
  const countryId = parseId(str(body.countryId));

  if (!name || !nameCn) return c.json({ error: '英文名、中文名均为必填' }, 400);
  if (!slug) return c.json({ error: 'slug 不能为空' }, 400);
  if (!countryId) return c.json({ error: '请选择所属国家' }, 400);

  const country = await c.env.DB.prepare('SELECT id FROM countries WHERE id = ?')
    .bind(countryId).first<{ id: number }>();
  if (!country) return c.json({ error: '所属国家不存在' }, 400);

  try {
    const res = await c.env.DB.prepare(
      `UPDATE locations SET name = ?, name_cn = ?, slug = ?, country_id = ?,
         updated_at = datetime('now')
       WHERE id = ?`
    ).bind(name, nameCn, slug, countryId, id).run();
    if (!res.meta.changes) return c.json({ error: '地区不存在' }, 404);
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: constraintMessage(err, '保存失败') }, 400);
  }
});

taxonomy.post('/api/admin/locations/:id/toggle', async (c) => {
  const guard = requireAdmin(c.get('user'));
  if (!guard.ok) return c.json({ error: guard.error }, guard.status);

  const id = parseId(c.req.param('id'));
  if (!id) return c.json({ error: '无效地区' }, 400);

  const row = await c.env.DB.prepare('SELECT is_active FROM locations WHERE id = ?')
    .bind(id).first<{ is_active: number }>();
  if (!row) return c.json({ error: '地区不存在' }, 404);

  const next = row.is_active ? 0 : 1;
  await c.env.DB.prepare("UPDATE locations SET is_active = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(next, id).run();
  return c.json({ ok: true, isActive: next === 1 });
});

// ------------------------------------------------------------- search terms

taxonomy.post('/api/admin/search-terms', async (c) => {
  const guard = requireAdmin(c.get('user'));
  if (!guard.ok) return c.json({ error: guard.error }, guard.status);

  const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
  const term = str(body.term);
  const termCn = str(body.termCn);
  const slug = resolveSlug(str(body.slug), term);

  if (!term) return c.json({ error: '采集关键词为必填' }, 400);
  if (!slug) return c.json({ error: 'slug 无法从关键词生成，请手动填写' }, 400);

  // `term` and `slug` are both UNIQUE; without this check a duplicate keyword
  // trips the slug index first and the admin is told to fix the wrong field.
  const dup = await c.env.DB.prepare('SELECT id FROM search_terms WHERE term = ?')
    .bind(term).first<{ id: number }>();
  if (dup) return c.json({ error: '该关键词已存在' }, 400);

  try {
    const res = await c.env.DB.prepare(
      `INSERT INTO search_terms (term, term_cn, slug) VALUES (?, ?, ?)`
    ).bind(term, termCn || null, slug).run();
    return c.json({ ok: true, id: res.meta.last_row_id });
  } catch (err) {
    return c.json({ error: constraintMessage(err, '创建失败') }, 400);
  }
});

taxonomy.post('/api/admin/search-terms/:id', async (c) => {
  const guard = requireAdmin(c.get('user'));
  if (!guard.ok) return c.json({ error: guard.error }, guard.status);

  const id = parseId(c.req.param('id'));
  if (!id) return c.json({ error: '无效关键词' }, 400);

  const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
  const term = str(body.term);
  const termCn = str(body.termCn);
  const slug = resolveSlug(str(body.slug), term);

  if (!term) return c.json({ error: '采集关键词为必填' }, 400);
  if (!slug) return c.json({ error: 'slug 不能为空' }, 400);

  const dup = await c.env.DB.prepare('SELECT id FROM search_terms WHERE term = ? AND id != ?')
    .bind(term, id).first<{ id: number }>();
  if (dup) return c.json({ error: '该关键词已存在' }, 400);

  try {
    const res = await c.env.DB.prepare(
      `UPDATE search_terms SET term = ?, term_cn = ?, slug = ? WHERE id = ?`
    ).bind(term, termCn || null, slug, id).run();
    if (!res.meta.changes) return c.json({ error: '关键词不存在' }, 404);
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: constraintMessage(err, '保存失败') }, 400);
  }
});

taxonomy.post('/api/admin/search-terms/:id/toggle', async (c) => {
  const guard = requireAdmin(c.get('user'));
  if (!guard.ok) return c.json({ error: guard.error }, guard.status);

  const id = parseId(c.req.param('id'));
  if (!id) return c.json({ error: '无效关键词' }, 400);

  const row = await c.env.DB.prepare('SELECT is_active FROM search_terms WHERE id = ?')
    .bind(id).first<{ is_active: number }>();
  if (!row) return c.json({ error: '关键词不存在' }, 404);

  const next = row.is_active ? 0 : 1;
  await c.env.DB.prepare('UPDATE search_terms SET is_active = ? WHERE id = ?').bind(next, id).run();
  return c.json({ ok: true, isActive: next === 1 });
});

// --------------------------------------------------------- blocked sources

/** Shared by create and update: validates and normalizes the rule fields. */
function parseBlockedSource(body: Record<string, unknown>):
  | { ok: true; pattern: string; matchType: BlockMatchType; note: string | null }
  | { ok: false; error: string } {
  const rawType = str(body.matchType) || 'via';
  if (!isBlockMatchType(rawType)) return { ok: false, error: '匹配方式只能是来源名称或域名' };

  const pattern = normalizePattern(str(body.pattern), rawType);
  if (!pattern) return { ok: false, error: '屏蔽内容为必填' };
  if (rawType === 'domain' && !pattern.includes('.')) {
    return { ok: false, error: '域名需要包含点，例如 lensa.com' };
  }

  return { ok: true, pattern, matchType: rawType, note: str(body.note) || null };
}

taxonomy.post('/api/admin/blocked-sources', async (c) => {
  const guard = requireAdmin(c.get('user'));
  if (!guard.ok) return c.json({ error: guard.error }, guard.status);

  const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
  const parsed = parseBlockedSource(body);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);

  try {
    const res = await c.env.DB.prepare(
      `INSERT INTO blocked_sources (pattern, match_type, note) VALUES (?, ?, ?)`
    ).bind(parsed.pattern, parsed.matchType, parsed.note).run();
    return c.json({ ok: true, id: res.meta.last_row_id });
  } catch (err) {
    return c.json({ error: constraintMessage(err, '创建失败') }, 400);
  }
});

taxonomy.post('/api/admin/blocked-sources/:id', async (c) => {
  const guard = requireAdmin(c.get('user'));
  if (!guard.ok) return c.json({ error: guard.error }, guard.status);

  const id = parseId(c.req.param('id'));
  if (!id) return c.json({ error: '无效规则' }, 400);

  const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
  const parsed = parseBlockedSource(body);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);

  try {
    const res = await c.env.DB.prepare(
      `UPDATE blocked_sources SET pattern = ?, match_type = ?, note = ? WHERE id = ?`
    ).bind(parsed.pattern, parsed.matchType, parsed.note, id).run();
    if (!res.meta.changes) return c.json({ error: '规则不存在' }, 404);
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: constraintMessage(err, '保存失败') }, 400);
  }
});

taxonomy.post('/api/admin/blocked-sources/:id/toggle', async (c) => {
  const guard = requireAdmin(c.get('user'));
  if (!guard.ok) return c.json({ error: guard.error }, guard.status);

  const id = parseId(c.req.param('id'));
  if (!id) return c.json({ error: '无效规则' }, 400);

  const row = await c.env.DB.prepare('SELECT is_active FROM blocked_sources WHERE id = ?')
    .bind(id).first<{ is_active: number }>();
  if (!row) return c.json({ error: '规则不存在' }, 404);

  const next = row.is_active ? 0 : 1;
  await c.env.DB.prepare('UPDATE blocked_sources SET is_active = ? WHERE id = ?').bind(next, id).run();
  return c.json({ ok: true, isActive: next === 1 });
});

export default taxonomy;
