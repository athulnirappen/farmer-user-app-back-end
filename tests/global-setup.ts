import { execSync } from 'node:child_process';
import type { TestProject } from 'vitest/node';

// Runs once before all tests. The name check is what stops the table wipes in
// helpers.ts from ever reaching a development database.
export default (project: TestProject) => {
  const databaseUrl = project.config.env.DATABASE_URL;
  const databaseName = new URL(databaseUrl).pathname.slice(1);

  if (!databaseName.endsWith('_test')) {
    console.error(`Refusing to run tests against "${databaseName}"; its name must end in _test`);
    process.exit(1);
  }

  execSync('npx prisma migrate deploy --config prisma7.config.ts', {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
};
