#!/usr/bin/env node
// Guards a MANUAL `wrangler deploy` (or any local deploy) against shipping a
// stale build over content the bots committed. See ARCHITECTURE.md.
//
// A local deploy uploads whatever is in your working tree — it does NOT pull
// from GitHub. The scheduled writers (feed refresh, agent brief/digest) commit
// their data to origin/main on their own cadence. If you deploy from a clone
// that's behind origin, you build with stale data and overwrite live content.
// This check blocks that.
//
// Wire it as the npm `predeploy` lifecycle step so it runs before `deploy`.
// Escape hatch: SKIP_DEPLOY_CHECK=1 npm run deploy
import { execSync } from 'node:child_process';

if (process.env.SKIP_DEPLOY_CHECK === '1') {
  console.log('[predeploy] SKIP_DEPLOY_CHECK=1 — skipping freshness check.');
  process.exit(0);
}

const git = (args) =>
  execSync(`git ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

try {
  git('fetch origin main --quiet');
} catch {
  console.error('[predeploy] Could not reach origin/main to verify freshness.');
  console.error('            Pull the latest before deploying, or set SKIP_DEPLOY_CHECK=1 to override.');
  process.exit(1);
}

const behind = Number(git('rev-list --count HEAD..origin/main') || '0');
if (behind > 0) {
  const files = git('diff --name-only HEAD origin/main')
    .split('\n')
    .filter(Boolean)
    .map((f) => '    ' + f)
    .join('\n');
  console.error('');
  console.error(`[predeploy] BLOCKED — local branch is ${behind} commit(s) behind origin/main.`);
  console.error('Deploying now would build from stale data and overwrite live content the');
  console.error('automated writers committed to GitHub:');
  console.error('');
  console.error(files);
  console.error('');
  console.error('  Fix:      git pull --ff-only   (then re-run your deploy)');
  console.error('  Override: SKIP_DEPLOY_CHECK=1  (not recommended)');
  console.error('');
  process.exit(1);
}

console.log('[predeploy] In sync with origin/main — safe to deploy.');
