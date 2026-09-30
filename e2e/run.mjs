// Runs every top-level flow in e2e/ against the database in .env, resetting test data before each one.
// Works with the local Docker copy or a hosted DEVELOPMENT project; the shared helper refuses production.
// Prereqs: a booted simulator with the Debug app installed, Metro running, and the database from .env
// (hosted dev: `npm run dev:reset` once; local: `supabase start`).
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { sql, target } from '../supabase/tools/target.mjs';

// These flows read a code from an email, which only the local mail catcher can show
const NEEDS_MAIL_CATCHER = ['password-reset.yaml'];

const only = process.argv[2];
const flows = readdirSync(new URL('.', import.meta.url))
  .filter(f => f.endsWith('.yaml') && (!only || f.includes(only)))
  .sort();

console.log(`Running against the ${target.label}\n`);

const reset = () => {
  if (target.hasMailCatcher) {
    // Emails are caught by the local Mailpit (never sent anywhere); start each flow with an empty inbox
    spawnSync('curl', ['-s', '-X', 'DELETE', 'http://127.0.0.1:54324/api/v1/messages'], { stdio: 'ignore' });
  }
  sql("delete from public.appointments; delete from auth.users where email like 'e2e-%@doctora.test'");
};

const results = [];
for (const flow of flows) {
  if (!target.hasMailCatcher && NEEDS_MAIL_CATCHER.includes(flow)) {
    console.log(`Skipping ${flow}: it needs the local mail catcher (Docker).`);
    results.push({ flow, skipped: true, ok: true, seconds: 0 });
    continue;
  }
  reset();
  const started = Date.now();
  const run = spawnSync('maestro', ['test', `e2e/${flow}`], { stdio: 'inherit' });
  results.push({ flow, ok: run.status === 0, seconds: Math.round((Date.now() - started) / 1000) });
}
reset();

console.log('\nSummary');
results.forEach(r => console.log(`${r.skipped ? 'SKIP' : r.ok ? 'PASS' : 'FAIL'}  ${r.flow}  (${r.seconds}s)`));
process.exit(results.every(r => r.ok) ? 0 : 1);
