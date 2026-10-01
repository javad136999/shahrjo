// Structural check for Step 1-2.
import { existsSync, readFileSync } from 'node:fs';

const mustExist = [
  'package.json', 'pnpm-workspace.yaml', '.gitignore', '.env.example', 'docker-compose.yml',
  'README.md', 'apps/web/package.json', 'apps/api/package.json', 'apps/admin/package.json',
  'packages/types/src/index.ts', 'packages/config/tsconfig.base.json', 'packages/ui/package.json',
  'prisma', 'prisma/schema.prisma', 'prisma/seed/index.ts', 'docker/nginx/nginx.conf',
  'docs/architecture.md', 'docs/api.md', 'docs/database.md',
];
let fail = 0;
for (const p of mustExist) if (!existsSync(p)) { console.error('MISSING', p); fail++; }

const ig = readFileSync('.gitignore', 'utf8');
if (!ig.includes('.env') || !ig.includes('!.env.example')) { console.error('.gitignore must protect .env'); fail++; }

if (existsSync('.env.example')) {
  const ex = readFileSync('.env.example', 'utf8');
  if (/(sk_|AKIA|BEGIN PRIVATE KEY)/.test(ex)) { console.error('Possible real secret in .env.example'); fail++; }
}
if (fail) { console.error(`\nStep 1-2 FAILED (${fail})`); process.exit(1); }
console.log('Step 1-2 OK');
