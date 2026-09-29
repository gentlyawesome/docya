// Runs every top-level flow in e2e/ against the LOCAL Supabase, resetting test data before each one.
// Prereqs: `supabase start`, a booted simulator with the Debug app installed, Metro running.
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
if (!/SUPABASE_URL=http:\/\/(127\.0\.0\.1|localhost)/.test(env)) {
  throw new Error('Refusing to run: e2e resets data and only runs against a local Supabase.');
}
const DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const only = process.argv[2];
const flows = readdirSync(new URL('.', import.meta.url))
  .filter(f => f.endsWith('.yaml') && (!only || f.includes(only)))
  .sort();

const reset = () =>
  execFileSync('psql', [
    DB, '-X', '-q', '-c',
    "delete from public.appointments; delete from auth.users where email like 'e2e-%@doctora.test';",
  ]);

const results = [];
for (const flow of flows) {
  reset();
  const started = Date.now();
  const run = spawnSync('maestro', ['test', `e2e/${flow}`], { stdio: 'inherit' });
  results.push({ flow, ok: run.status === 0, seconds: Math.round((Date.now() - started) / 1000) });
}
reset();

console.log('\nSummary');
results.forEach(r => console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.flow}  (${r.seconds}s)`));
process.exit(results.every(r => r.ok) ? 0 : 1);
