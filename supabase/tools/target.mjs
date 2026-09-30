// Shared by the scripts that WRITE test data or wipe it (backend checks, E2E runner, demo data, dev reset).
// It reads .env and works out which database that is:
//   - "local":  the Docker copy from `supabase start`  (SQL through psql, emails caught by Mailpit)
//   - "hosted": a hosted DEVELOPMENT project             (SQL through `supabase db query --linked`)
// and it REFUSES the production project, whose ref is in supabase/production-ref.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const env = Object.fromEntries(
  readFileSync(new URL('.env', root), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);

const url = env.SUPABASE_URL;
const key = env.SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY in .env');

const production = readFileSync(new URL('supabase/production-ref', root), 'utf8').trim();
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)/.test(url);
const ref = isLocal ? null : new URL(url).hostname.split('.')[0];

if (!isLocal && ref === production) {
  throw new Error(
    `Refusing to run: .env points at the PRODUCTION project (${ref}). These scripts create and delete data. ` +
      'Point .env at the development project (see docs/HOSTING.md).',
  );
}
if (!isLocal) {
  const linkFile = new URL('supabase/.temp/project-ref', root);
  const linked = existsSync(linkFile) ? readFileSync(linkFile, 'utf8').trim() : '';
  if (linked !== ref) {
    throw new Error(`The Supabase CLI is linked to "${linked || 'nothing'}" but .env points at "${ref}". Run: supabase link --project-ref ${ref}`);
  }
}

const LOCAL_DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

export const target = {
  kind: isLocal ? 'local' : 'hosted',
  url,
  key,
  ref,
  // Confirmation and reset codes can only be read from the local mail catcher
  hasMailCatcher: isLocal,
  label: isLocal ? 'local Docker Supabase' : `hosted development project ${ref}`,
};

// Runs SQL against that database. Returns the rows for a single SELECT.
export const sql = query => {
  if (isLocal) {
    return execFileSync('psql', [LOCAL_DB, '-X', '-q', '-t', '-A', '-c', query], { encoding: 'utf8' });
  }
  const out = execFileSync('supabase', ['db', 'query', '--linked', '-o', 'json', query], { encoding: 'utf8', maxBuffer: 50_000_000 });
  const parsed = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1));
  return parsed.rows ?? [];
};

export const sqlFile = path => {
  if (isLocal) {
    execFileSync('psql', [LOCAL_DB, '-X', '-q', '-f', path], { stdio: 'inherit' });
  } else {
    execFileSync('supabase', ['db', 'query', '--linked', '-o', 'json', '-f', path], { stdio: ['ignore', 'ignore', 'inherit'] });
  }
};
