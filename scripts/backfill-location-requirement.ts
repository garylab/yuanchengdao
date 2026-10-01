/**
 * Re-derives jobs.location_requirement / location_requirement_label from the
 * ORIGINAL English description using the deterministic rules in
 * src/services/locationRequirement.ts.
 *
 *   npx tsx scripts/backfill-location-requirement.ts            # dry run
 *   npx tsx scripts/backfill-location-requirement.ts --apply    # write
 *
 * Only rows the rules match are touched, and only when the value actually
 * changes. The rules never produce "anywhere", so this can add a restriction
 * but never silently remove one.
 */
import { execFileSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { detectLocationRequirement, mergeLocationRequirement } from '../src/services/locationRequirement';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');
const DB = 'yuanchengdao';
const PAGE = 400;

// Both templated feeds put the sentence near the top, but windowing off the
// marker rather than the start keeps it correct if that ever changes.
const MARKERS = ['open to candidates in', 'the offer is available from:'];

interface Row { id: number; lr: number; label: string | null; w0: string | null; w1: string | null }

function d1(sql: string): Record<string, unknown>[] {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB, '--remote', '--json', '--command', sql],
    { cwd: rootDir, encoding: 'utf-8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const match = out.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (!match) throw new Error(`Unexpected wrangler output:\n${out.slice(0, 500)}`);
  return JSON.parse(match[0])[0].results as Record<string, unknown>[];
}

function fetchPage(afterId: number): Row[] {
  const windows = MARKERS
    .map((m, i) => `substr(c.description, instr(lower(c.description), '${m}'), 220) w${i}`)
    .join(', ');
  const filter = MARKERS.map((m) => `instr(lower(c.description), '${m}') > 0`).join(' OR ');
  return d1(
    `SELECT j.id, j.location_requirement lr, j.location_requirement_label label, ${windows}
     FROM jobs j JOIN jobs_crawled c ON j.crawled_id = c.id
     WHERE j.id > ${afterId} AND (${filter})
     ORDER BY j.id LIMIT ${PAGE}`,
  ) as unknown as Row[];
}

function sqlQuote(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

async function main() {
  const updates: Array<{ id: number; req: number; label: string; fromReq: number; fromLabel: string | null }> = [];
  const conflicts: string[] = [];
  const byLabel = new Map<string, number>();
  let scanned = 0;
  let afterId = 0;

  for (;;) {
    const rows = fetchPage(afterId);
    if (rows.length === 0) break;
    scanned += rows.length;
    afterId = rows[rows.length - 1].id;

    for (const row of rows) {
      const text = [row.w0, row.w1].filter(Boolean).join('\n');
      const ruled = detectLocationRequirement(text);
      if (!ruled) continue;
      // Same merge rule as the sync path, so a backfilled row and a freshly
      // synced one can never disagree.
      const match = mergeLocationRequirement(ruled, row.lr, row.label);
      if (row.lr === match.requirement && (row.label || '') === match.label) continue;
      updates.push({ id: row.id, req: match.requirement, label: match.label, fromReq: row.lr, fromLabel: row.label });
      if (row.lr !== 0 && conflicts.length < 12) {
        conflicts.push(`id=${row.id} was ${row.lr}/${row.label ?? '-'} -> ${match.requirement}/${match.label} :: ${text.slice(0, 100).replace(/\s+/g, ' ')}`);
      }
      const key = `${match.requirement}:${match.label}`;
      byLabel.set(key, (byLabel.get(key) || 0) + 1);
    }
    if (rows.length < PAGE) break;
  }

  console.log(`scanned candidate rows : ${scanned}`);
  console.log(`rows to update         : ${updates.length}`);
  const from0 = updates.filter((u) => u.fromReq === 0).length;
  console.log(`  currently "anywhere" : ${from0}`);
  console.log(`  currently other      : ${updates.length - from0}`);
  if (conflicts.length > 0) {
    console.log('samples where a non-zero value is being changed:');
    conflicts.forEach((c) => console.log('  ' + c));
  }
  console.log('resulting labels:');
  [...byLabel.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${String(n).padStart(5)}  ${k}`));

  if (!APPLY) {
    console.log('\ndry run — pass --apply to write these rows');
    return;
  }
  if (updates.length === 0) return;

  // Write an undo script before touching anything.
  const undoPath = resolve(rootDir, `backfill-location-requirement.undo.${Date.now()}.sql`);
  writeFileSync(
    undoPath,
    updates
      .map((u) => `UPDATE jobs SET location_requirement = ${u.fromReq}, location_requirement_label = ${u.fromLabel === null ? 'NULL' : sqlQuote(u.fromLabel)} WHERE id = ${u.id};`)
      .join('\n'),
  );
  console.log(`\nundo script written to ${undoPath}`);

  const statements = updates.map(
    (u) => `UPDATE jobs SET location_requirement = ${u.req}, location_requirement_label = ${sqlQuote(u.label)} WHERE id = ${u.id};`,
  );
  const file = join(tmpdir(), `backfill-location-req-${Date.now()}.sql`);
  writeFileSync(file, statements.join('\n'));
  try {
    execFileSync('npx', ['wrangler', 'd1', 'execute', DB, '--remote', '--file', file, '--yes'], {
      cwd: rootDir,
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    console.log(`\napplied ${updates.length} updates`);
  } finally {
    unlinkSync(file);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
