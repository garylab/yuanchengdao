import Database from 'better-sqlite3';
import nodejieba from 'nodejieba';
import { execSync } from 'child_process';
import { readdirSync } from 'fs';
import { join } from 'path';

const DB_NAME = 'yuanchengdao';
const D1_DIR = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf]+/;
const SEGMENT_RE = /([\u4e00-\u9fff\u3400-\u4dbf]+)/;
const BATCH_SIZE = 50;
const REMOTE_FETCH_PAGE = 300;
const EXEC_MAX_BUFFER_BYTES = 32 * 1024 * 1024;

function tokenize(text: string): string {
  return text
    .split(SEGMENT_RE)
    .flatMap((seg) => {
      if (CJK_RE.test(seg)) {
        return nodejieba.cut(seg).filter((w: string) => w.trim().length > 0);
      }
      const trimmed = seg.trim();
      return trimmed ? [trimmed] : [];
    })
    .join(' ');
}

function escSql(s: string): string {
  return s.replace(/'/g, "''");
}

function findLocalDb(): string {
  const files = readdirSync(D1_DIR).filter((f) => f.endsWith('.sqlite'));
  if (files.length === 0) throw new Error(`No .sqlite files found in ${D1_DIR}`);
  return join(D1_DIR, files[0]);
}

function buildLocal() {
  const dbPath = findLocalDb();
  console.log(`Opening local database: ${dbPath}`);

  const db = new Database(dbPath);
  nodejieba.load();

  db.exec('DROP TABLE IF EXISTS jobs_fts');
  db.exec(
    'CREATE VIRTUAL TABLE jobs_fts USING fts5(title, posted_at UNINDEXED, created_at UNINDEXED)'
  );

  const jobs = db.prepare('SELECT id, title, posted_at, created_at FROM jobs').all() as Array<{
    id: number;
    title: string;
    posted_at: string | null;
    created_at: string;
  }>;

  const insert = db.prepare(
    'INSERT INTO jobs_fts(rowid, title, posted_at, created_at) VALUES (?, ?, ?, ?)'
  );

  const insertAll = db.transaction(
    (rows: Array<{ id: number; title: string; posted_at: string | null; created_at: string }>) => {
      for (const row of rows) {
        insert.run(row.id, tokenize(row.title), row.posted_at, row.created_at);
      }
    }
  );

  insertAll(jobs);
  console.log(`Indexed ${jobs.length} jobs into jobs_fts`);
  db.close();
}

function wranglerExec(sql: string): string {
  return execSync(
    `npx wrangler d1 execute ${DB_NAME} --remote --json --command="${sql.replace(/"/g, '\\"')}"`,
    { encoding: 'utf-8', maxBuffer: EXEC_MAX_BUFFER_BYTES },
  );
}

function parseD1SelectResults<T extends Record<string, unknown>>(raw: string): T[] {
  const parsed = JSON.parse(raw) as Array<{ results?: T[]; success?: boolean; error?: string }>;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`Unexpected D1 JSON (not an array): ${raw.slice(0, 200)}`);
  }
  const first = parsed[0];
  if (first?.success === false) {
    throw new Error(`D1 query failed: ${first?.error || raw.slice(0, 500)}`);
  }
  return (first?.results ?? []) as T[];
}

type JobFtsSourceRow = {
  id: number;
  title: string;
  posted_at: string | null;
  created_at: string;
};

function fetchAllJobsRemote(): JobFtsSourceRow[] {
  const all: JobFtsSourceRow[] = [];
  let offset = 0;
  for (;;) {
    const sql = `SELECT id, title, posted_at, created_at FROM jobs ORDER BY id LIMIT ${REMOTE_FETCH_PAGE} OFFSET ${offset}`;
    const raw = wranglerExec(sql);
    const batch = parseD1SelectResults<JobFtsSourceRow>(raw);
    if (batch.length === 0) break;
    all.push(...batch);
    offset += batch.length;
    console.log(`  Loaded ${all.length} job rows from remote...`);
    if (batch.length < REMOTE_FETCH_PAGE) break;
  }
  return all;
}

function buildRemote() {
  console.log('Building FTS index on remote D1...');
  nodejieba.load();

  wranglerExec('DROP TABLE IF EXISTS jobs_fts');
  wranglerExec(
    'CREATE VIRTUAL TABLE jobs_fts USING fts5(title, posted_at UNINDEXED, created_at UNINDEXED)'
  );

  const jobs = fetchAllJobsRemote();

  console.log(`Found ${jobs.length} jobs to index`);
  if (jobs.length === 0) {
    console.log('jobs table is empty — nothing to put in jobs_fts. Add jobs via sync first.');
  }

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);
    const values = batch
      .map((row) => {
        const title = escSql(tokenize(row.title));
        const posted = row.posted_at ? `'${escSql(row.posted_at)}'` : 'NULL';
        const created = row.created_at ? `'${escSql(row.created_at)}'` : 'NULL';
        return `(${row.id}, '${title}', ${posted}, ${created})`;
      })
      .join(',');
    wranglerExec(
      `INSERT INTO jobs_fts(rowid, title, posted_at, created_at) VALUES ${values}`
    );
    console.log(`  Indexed ${Math.min(i + BATCH_SIZE, jobs.length)}/${jobs.length}`);
  }

  const countRaw = wranglerExec('SELECT COUNT(*) as c FROM jobs_fts');
  const countRows = parseD1SelectResults<{ c: number }>(countRaw);
  const ftsCount = countRows[0]?.c ?? 0;
  console.log(`Done — indexed ${jobs.length} jobs into remote jobs_fts (rows in jobs_fts: ${ftsCount})`);
}

const remote = process.argv.includes('--remote');
if (remote) {
  buildRemote();
} else {
  buildLocal();
}
