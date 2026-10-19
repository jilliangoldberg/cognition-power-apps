import { backup, DatabaseSync } from 'node:sqlite';
import { chmodSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const source = resolve(process.env.WORKBENCH_DB ?? '.workbench/workbench.sqlite');
const destination = process.argv[2] && resolve(process.argv[2]);
if (
  !existsSync(source) ||
  !destination ||
  existsSync(destination) ||
  !statSync(dirname(destination)).isDirectory()
) {
  throw new Error(
    'Use an existing source database and a new backup filename in an existing directory. Existing files are never replaced.',
  );
}
process.umask(0o077);
const db = new DatabaseSync(source, { readOnly: true });
try {
  await backup(db, destination);
  chmodSync(destination, 0o600);
  console.log(
    'Backup created. Protect it like the source: it includes password hashes, sessions, and synthetic history.',
  );
} finally {
  db.close();
}
