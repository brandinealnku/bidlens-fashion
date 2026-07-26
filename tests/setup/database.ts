import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';

const databasePath = path.join(process.cwd(), 'prisma', 'test.db');
export default function setup() {
  for (const suffix of ['', '-journal', '-shm', '-wal']) {
    const target = databasePath + suffix;
    if (existsSync(target)) rmSync(target, { force: true });
  }
  execFileSync(
    path.join(process.cwd(), 'node_modules', '.bin', 'prisma'),
    ['db', 'push', '--skip-generate'],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: 'file:./test.db' },
      stdio: 'inherit',
    },
  );
  return () => {
    for (const suffix of ['', '-journal', '-shm', '-wal'])
      rmSync(databasePath + suffix, { force: true });
  };
}
