#!/usr/bin/env node
/**
 * scripts/build-bundle.mjs
 * Assembles the Snip deployment bundle and optionally pushes it.
 *
 * Usage (run from the snip-demo superproject root):
 *   node scripts/build-bundle.mjs          # assemble + commit locally
 *   node scripts/build-bundle.mjs --push   # also push bundle + main
 *
 * The script is a safe no-op when nothing has changed:
 *   - it checks staged diffs before every git commit
 *   - it only pushes when --push is passed
 */
import { execSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dirname, '..');          // snip-demo superproject root
const PUSH  = process.argv.includes('--push');

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Run a shell command, streaming stdio. Throws on non-zero exit. */
function run(cmd, cwd = ROOT) {
  console.log(`  \x1b[2m$ ${cmd}\x1b[0m`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

/** True when git's index has staged changes vs HEAD in the given directory. */
function hasStagedChanges(cwd) {
  return spawnSync('git', ['diff', '--cached', '--quiet'], { cwd }).status !== 0;
}

// ──────────────────────────────────────────────────────────────────────────
// 1 / 4  Update source submodules to their tracked branch tips
// ──────────────────────────────────────────────────────────────────────────
console.log('\n\x1b[1m[1/4] Pulling backend / frontend / cli to branch tips\x1b[0m');
run('git submodule update --init --remote backend frontend cli');

// ──────────────────────────────────────────────────────────────────────────
// 2 / 4  Build the Angular frontend
// ──────────────────────────────────────────────────────────────────────────
console.log('\n\x1b[1m[2/4] Building Angular frontend\x1b[0m');
const frontendDir = join(ROOT, 'frontend');
run('npm install',  frontendDir);
run('npx ng build', frontendDir);

const browserIdx = join(frontendDir, 'dist', 'snip-frontend', 'browser', 'index.html');
if (!existsSync(browserIdx)) {
  process.stderr.write(
    '\n\x1b[31mERROR: frontend/dist/snip-frontend/browser/index.html missing ' +
    'after build — aborting.\x1b[0m\n'
  );
  process.exit(1);
}
console.log('  \x1b[32m✓ dist/snip-frontend/browser verified\x1b[0m');

// ──────────────────────────────────────────────────────────────────────────
// 3 / 4  Assemble bundle/
// ──────────────────────────────────────────────────────────────────────────
console.log('\n\x1b[1m[3/4] Assembling bundle/\x1b[0m');
const bundleDir = join(ROOT, 'bundle');

// Ensure bundle submodule is checked out at the superproject-pinned commit,
// then get onto the named branch so commits are not detached.
run('git submodule update --init bundle');
try {
  run('git checkout bundle', bundleDir);
} catch {
  run('git checkout -B bundle origin/bundle', bundleDir);
}

// — server.js (from backend)
cpSync(join(ROOT, 'backend', 'server.js'), join(bundleDir, 'server.js'));
console.log('  ✓ server.js');

// — cli.js (from cli)
cpSync(join(ROOT, 'cli', 'cli.js'), join(bundleDir, 'cli.js'));
console.log('  ✓ cli.js');

// — public/  ←  Angular browser build output
const publicDir = join(bundleDir, 'public');
if (existsSync(publicDir)) rmSync(publicDir, { recursive: true, force: true });
cpSync(
  join(frontendDir, 'dist', 'snip-frontend', 'browser'),
  publicDir,
  { recursive: true }
);
console.log('  ✓ public/');

// — .env  (Bun auto-loads; PUBLIC_DIR tells server.js to also serve the SPA)
writeFileSync(join(bundleDir, '.env'), 'PUBLIC_DIR=./public\n');
console.log('  ✓ .env');

// — package.json  (NO "type" field → cli.js stays runnable under plain node)
writeFileSync(
  join(bundleDir, 'package.json'),
  JSON.stringify({
    name: 'snip-bundle',
    version: '1.0.0',
    description: 'Snip URL shortener — self-contained deployment bundle',
    scripts: { start: 'bun server.js' },
  }, null, 2) + '\n'
);
console.log('  ✓ package.json');

// — Dockerfile
writeFileSync(join(bundleDir, 'Dockerfile'), [
  'FROM oven/bun:1-alpine',
  'WORKDIR /app',
  'COPY . .',
  'ENV PORT=3000',
  'EXPOSE 3000',
  'CMD ["bun", "server.js"]',
  '',
].join('\n'));
console.log('  ✓ Dockerfile');

// — .dockerignore
writeFileSync(join(bundleDir, '.dockerignore'), [
  '.git',
  'node_modules',
  '*.md',
  '',
].join('\n'));
console.log('  ✓ .dockerignore');

// — railway.json  (selects the DOCKERFILE builder)
writeFileSync(
  join(bundleDir, 'railway.json'),
  JSON.stringify({
    $schema: 'https://railway.app/railway.schema.json',
    build: { builder: 'DOCKERFILE' },
  }, null, 2) + '\n'
);
console.log('  ✓ railway.json');

// ──────────────────────────────────────────────────────────────────────────
// 4 / 4  Commit inside bundle/, bump pointer in the superproject
// ──────────────────────────────────────────────────────────────────────────
console.log('\n\x1b[1m[4/4] Committing\x1b[0m');

// 4a — commit in bundle/ (guarded: skip when nothing changed)
run('git add .', bundleDir);
if (hasStagedChanges(bundleDir)) {
  const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
  run(`git commit -m "chore: bundle build ${ts}"`, bundleDir);
  console.log('  \x1b[32m✓ bundle/ committed\x1b[0m');
} else {
  console.log('  bundle/: nothing to commit — skipped');
}

// push bundle branch only when --push  (HEAD:bundle works even from detached HEAD)
if (PUSH) {
  run('git push origin HEAD:bundle', bundleDir);
  console.log('  \x1b[32m✓ bundle → origin/bundle\x1b[0m');
}

// 4b — bump bundle pointer in the superproject (guarded)
run('git add bundle', ROOT);
if (hasStagedChanges(ROOT)) {
  run('git commit -m "chore: bump bundle submodule to latest"', ROOT);
  console.log('  \x1b[32m✓ superproject bundle pointer bumped\x1b[0m');
} else {
  console.log('  superproject: nothing to commit — skipped');
}

if (PUSH) {
  run('git push origin main', ROOT);
  console.log('  \x1b[32m✓ main → origin/main\x1b[0m');
}

console.log('\n\x1b[32m✓ Done\x1b[0m\n');
