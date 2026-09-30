// Puts the hosted DEVELOPMENT project back to a clean state: wipes it, applies every migration and loads
// the sample doctors from supabase/seed.sql. Run: npm run dev:reset
// The local Docker copy has its own command (`supabase db reset`). Production is refused by target.mjs.
import { readdirSync } from 'node:fs';
import { sql, sqlFile, target } from './target.mjs';

if (target.kind !== 'hosted') {
  throw new Error('dev:reset is for the hosted development project. For the Docker copy use: supabase db reset');
}
console.log(`Resetting ${target.label} ...`);

sql(`
  drop schema public cascade;
  create schema public;
  grant usage on schema public to postgres, anon, authenticated, service_role;
  grant all on schema public to postgres, service_role;
  delete from auth.users;
  delete from supabase_migrations.schema_migrations;
`);

const dir = new URL('../migrations/', import.meta.url);
for (const file of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
  const [version, ...rest] = file.replace(/\.sql$/, '').split('_');
  sqlFile(new URL(file, dir).pathname);
  sql(`insert into supabase_migrations.schema_migrations (version, name, statements) values ('${version}', '${rest.join('_')}', array[]::text[])`);
  console.log('applied', file);
}
sqlFile(new URL('../seed.sql', import.meta.url).pathname);
console.log('loaded the sample doctors. Done.');
