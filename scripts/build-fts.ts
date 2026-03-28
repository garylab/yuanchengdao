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
    'CREATE VIRTUAL TABLE jobs_fts USING fts5(title, posted_at UNINDEXED)'
  );

  const jobs = db.prepare('SELECT id, title, posted_at FROM jobs').all() as Array<{
    id: number;
    title: string;
    posted_at: string | null;
  }>;

  const insert = db.prepare(
    'INSERT INTO jobs_fts(rowid, title, posted_at) VALUES (?, ?, ?)'
  );

  const insertAll = db.transaction(
    (rows: Array<{ id: number; title: string; posted_at: string | null }>) => {
      for (const row of rows) {
        insert.run(row.id, tokenize(row.title), row.posted_at);
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
    { encoding: 'utf-8' }
  );
}

function buildRemote() {
  console.log('Building FTS index on remote D1...');
  nodejieba.load();

  wranglerExec('DROP TABLE IF EXISTS jobs_fts');
  wranglerExec(
    'CREATE VIRTUAL TABLE jobs_fts USING fts5(title, posted_at UNINDEXED)'
  );

  const raw = wranglerExec('SELECT id, title, posted_at FROM jobs');
  const parsed = JSON.parse(raw);
  const jobs: Array<{ id: number; title: string; posted_at: string | null }> =
    parsed[0]?.results ?? [];

  console.log(`Found ${jobs.length} jobs to index`);

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);
    const values = batch
      .map((row) => {
        const title = escSql(tokenize(row.title));
        const posted = row.posted_at ? `'${escSql(row.posted_at)}'` : 'NULL';
        return `(${row.id}, '${title}', ${posted})`;
      })
      .join(',');
    wranglerExec(
      `INSERT INTO jobs_fts(rowid, title, posted_at) VALUES ${values}`
    );
    console.log(`  Indexed ${Math.min(i + BATCH_SIZE, jobs.length)}/${jobs.length}`);
  }

  console.log(`Done — indexed ${jobs.length} jobs into remote jobs_fts`);
}

const remote = process.argv.includes('--remote');
if (remote) {
  buildRemote();
} else {
  buildLocal();
}
