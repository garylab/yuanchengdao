const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;
const SESSION_DAYS = 30;
const OTP_TTL_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const OTP_SEND_COOLDOWN_SECONDS = 60;
const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX = 20;
const SESSION_COOKIE = 'session';

export { SESSION_COOKIE };

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}

async function derivePasswordKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    KEY_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await derivePasswordKey(password, salt);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(key)}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = parseInt(parts[1], 10);
  if (iterations !== PBKDF2_ITERATIONS) return false;
  const salt = hexToBytes(parts[2]);
  const expected = hexToBytes(parts[3]);
  const actual = await derivePasswordKey(password, salt);
  if (actual.length !== expected.length) return false;
  let different = 0;
  for (let index = 0; index < actual.length; index++) {
    different |= actual[index] ^ expected[index];
  }
  return different === 0;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function hashToken(token: string, sessionSecret: string): Promise<string> {
  return sha256Hex(`${sessionSecret}:${token}`);
}

function randomToken(byteLength = 32): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(byteLength)));
}

function toSqliteDatetime(date: Date): string {
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
}

function parseSqliteDatetime(value: string): number {
  if (value.includes('T')) return Date.parse(value);
  return Date.parse(value.replace(' ', 'T') + 'Z');
}

function otpCode(): string {
  const value = crypto.getRandomValues(new Uint8Array(4));
  const number = ((value[0] << 24) | (value[1] << 16) | (value[2] << 8) | value[3]) >>> 0;
  return String(number % 1000000).padStart(6, '0');
}

export type UserRow = {
  id: number;
  email: string;
  password_hash: string | null;
  google_id: string | null;
  name: string | null;
  avatar_url: string | null;
  telegram_chat_id: string | null;
  role: 'admin' | 'user';
};

const USER_COLUMNS = 'id, email, password_hash, google_id, name, avatar_url, telegram_chat_id, role';

export async function findUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  return db.prepare(
    `SELECT ${USER_COLUMNS} FROM users WHERE email = ?`
  ).bind(normalizeEmail(email)).first<UserRow>();
}

export async function findUserById(db: D1Database, userId: number): Promise<UserRow | null> {
  return db.prepare(
    `SELECT ${USER_COLUMNS} FROM users WHERE id = ?`
  ).bind(userId).first<UserRow>();
}

export async function findUserByGoogleId(db: D1Database, googleId: string): Promise<UserRow | null> {
  return db.prepare(
    `SELECT ${USER_COLUMNS} FROM users WHERE google_id = ?`
  ).bind(googleId).first<UserRow>();
}

export async function createUserWithPassword(
  db: D1Database,
  email: string,
  password: string,
  name?: string | null,
): Promise<UserRow> {
  const passwordHash = await hashPassword(password);
  const result = await db.prepare(
    `INSERT INTO users (email, password_hash, name, role) VALUES (
       ?, ?, ?,
       CASE WHEN NOT EXISTS (SELECT 1 FROM users) THEN 'admin' ELSE 'user' END
     ) RETURNING id, email, password_hash, google_id, name, avatar_url, telegram_chat_id, role`
  ).bind(normalizeEmail(email), passwordHash, name || null).first<UserRow>();
  if (!result) throw new Error('Failed to create user');
  return result;
}

export async function createOrLinkGoogleUser(
  db: D1Database,
  profile: { googleId: string; email: string; name: string | null; avatarUrl: string | null },
): Promise<UserRow> {
  const email = normalizeEmail(profile.email);
  const byGoogle = await findUserByGoogleId(db, profile.googleId);
  if (byGoogle) {
    if (profile.name || profile.avatarUrl) {
      await db.prepare(
        'UPDATE users SET name = COALESCE(?, name), avatar_url = COALESCE(?, avatar_url) WHERE id = ?'
      ).bind(profile.name, profile.avatarUrl, byGoogle.id).run();
      return (await findUserById(db, byGoogle.id))!;
    }
    return byGoogle;
  }

  const byEmail = await findUserByEmail(db, email);
  if (byEmail) {
    await db.prepare(
      'UPDATE users SET google_id = ?, name = COALESCE(?, name), avatar_url = COALESCE(?, avatar_url) WHERE id = ?'
    ).bind(profile.googleId, profile.name, profile.avatarUrl, byEmail.id).run();
    return (await findUserById(db, byEmail.id))!;
  }

  const created = await db.prepare(
    `INSERT INTO users (email, google_id, name, avatar_url, role) VALUES (
       ?, ?, ?, ?,
       CASE WHEN NOT EXISTS (SELECT 1 FROM users) THEN 'admin' ELSE 'user' END
     ) RETURNING id, email, password_hash, google_id, name, avatar_url, telegram_chat_id, role`
  ).bind(email, profile.googleId, profile.name, profile.avatarUrl).first<UserRow>();
  if (!created) throw new Error('Failed to create Google user');
  return created;
}

export async function createSession(
  db: D1Database,
  userId: number,
  sessionSecret: string,
): Promise<{ token: string; expiresAt: string }> {
  const token = randomToken(32);
  const tokenHash = await hashToken(token, sessionSecret);
  const expiresAt = toSqliteDatetime(new Date(Date.now() + SESSION_DAYS * 86400000));
  await db.prepare(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)'
  ).bind(tokenHash, userId, expiresAt).run();
  return { token, expiresAt };
}

export async function destroySession(
  db: D1Database,
  token: string,
  sessionSecret: string,
): Promise<void> {
  const tokenHash = await hashToken(token, sessionSecret);
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
}

export async function resolveSessionUser(
  db: D1Database,
  token: string,
  sessionSecret: string,
): Promise<UserRow | null> {
  const tokenHash = await hashToken(token, sessionSecret);
  const row = await db.prepare(`
    SELECT u.id, u.email, u.password_hash, u.google_id, u.name, u.avatar_url, u.telegram_chat_id, u.role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > datetime('now')
  `).bind(tokenHash).first<UserRow>();
  return row || null;
}

export async function checkRateLimit(
  db: D1Database,
  rateKey: string,
  maxAttempts = RATE_LIMIT_MAX,
  windowMinutes = RATE_LIMIT_WINDOW_MINUTES,
): Promise<boolean> {
  const windowStart = toSqliteDatetime(new Date(Date.now() - windowMinutes * 60 * 1000));
  const countRow = await db.prepare(
    'SELECT COUNT(*) as count FROM auth_rate_limits WHERE rate_key = ? AND created_at >= ?'
  ).bind(rateKey, windowStart).first<{ count: number }>();
  const count = countRow?.count ?? 0;
  if (count >= maxAttempts) return false;
  await db.prepare(
    'INSERT INTO auth_rate_limits (rate_key) VALUES (?)'
  ).bind(rateKey).run();
  return true;
}

export async function createEmailOtp(
  db: D1Database,
  email: string,
): Promise<{ code: string; error?: string }> {
  const normalized = normalizeEmail(email);
  const recent = await db.prepare(
    `SELECT created_at FROM email_otps WHERE email = ? ORDER BY created_at DESC LIMIT 1`
  ).bind(normalized).first<{ created_at: string }>();
  if (recent) {
    const elapsedMs = Date.now() - parseSqliteDatetime(recent.created_at);
    if (Number.isFinite(elapsedMs) && elapsedMs < OTP_SEND_COOLDOWN_SECONDS * 1000) {
      return { code: '', error: '请稍后再发送验证码' };
    }
  }

  const code = otpCode();
  const codeHash = await sha256Hex(code);
  const expiresAt = toSqliteDatetime(new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000));
  await db.batch([
    db.prepare('DELETE FROM email_otps WHERE email = ?').bind(normalized),
    db.prepare(
      'INSERT INTO email_otps (email, code_hash, expires_at) VALUES (?, ?, ?)'
    ).bind(normalized, codeHash, expiresAt),
  ]);
  return { code };
}

export async function verifyEmailOtp(
  db: D1Database,
  email: string,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const normalized = normalizeEmail(email);
  const row = await db.prepare(
    `SELECT id, code_hash, expires_at, attempts FROM email_otps
     WHERE email = ? ORDER BY created_at DESC LIMIT 1`
  ).bind(normalized).first<{ id: number; code_hash: string; expires_at: string; attempts: number }>();

  if (!row) return { ok: false, error: '验证码无效或已过期' };
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    await db.prepare('DELETE FROM email_otps WHERE id = ?').bind(row.id).run();
    return { ok: false, error: '验证码尝试次数过多' };
  }
  if (parseSqliteDatetime(row.expires_at) < Date.now()) {
    await db.prepare('DELETE FROM email_otps WHERE id = ?').bind(row.id).run();
    return { ok: false, error: '验证码无效或已过期' };
  }

  const codeHash = await sha256Hex(code.trim());
  if (codeHash !== row.code_hash) {
    await db.prepare('UPDATE email_otps SET attempts = attempts + 1 WHERE id = ?').bind(row.id).run();
    return { ok: false, error: '验证码错误' };
  }

  await db.prepare('DELETE FROM email_otps WHERE email = ?').bind(normalized).run();
  return { ok: true };
}

export async function findOrCreateUserByEmailOtp(
  db: D1Database,
  email: string,
): Promise<UserRow> {
  const existing = await findUserByEmail(db, email);
  if (existing) return existing;
  const created = await db.prepare(
    `INSERT INTO users (email, role) VALUES (
       ?,
       CASE WHEN NOT EXISTS (SELECT 1 FROM users) THEN 'admin' ELSE 'user' END
     ) RETURNING id, email, password_hash, google_id, name, avatar_url, telegram_chat_id, role`
  ).bind(normalizeEmail(email)).first<UserRow>();
  if (!created) throw new Error('Failed to create user');
  return created;
}

export function sessionCookieHeader(token: string, expiresAt: string): string {
  const expiresDate = new Date(expiresAt.includes('T') ? expiresAt : expiresAt.replace(' ', 'T') + 'Z');
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expiresDate.toUTCString()}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function createTelegramLinkToken(): string {
  return randomToken(16);
}
