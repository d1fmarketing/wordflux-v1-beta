import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const artifactsDir = path.resolve('artifacts');
fs.mkdirSync(artifactsDir, { recursive: true });

const run = spawnSync('npx', ['playwright', 'test'], {
  stdio: 'inherit',
  env: process.env,
});

if (run.status !== 0) {
  console.error('Playwright exited non-zero. See console output above.');
}

const reportPath = path.join(artifactsDir, 'report.json');
if (!fs.existsSync(reportPath)) {
  console.error(`JSON report not found at ${reportPath}. Check reporter configuration.`);
  process.exit(run.status || 1);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const suites = report.suites ?? [];
const tests = suites
  .flatMap(suite => suite.suites ?? [])
  .flatMap(suite => suite.specs ?? [])
  .flatMap(spec => spec.tests ?? []);

const summary = { passed: 0, failed: 0, flaky: 0, skipped: 0 };
const slow = [];

for (const test of tests) {
  const outcome = test.outcome ?? 'unexpected';
  if (outcome === 'expected') summary.passed += 1;
  else if (outcome === 'flaky') summary.flaky += 1;
  else if (outcome === 'skipped') summary.skipped += 1;
  else summary.failed += 1;

  const duration = test.results?.[0]?.duration ?? 0;
  if (duration > 5000) {
    const title = test.titlePath?.join(' › ') ?? test.title ?? 'unknown';
    slow.push({ title, ms: duration });
  }
}

slow.sort((a, b) => b.ms - a.ms);

console.log('\n=== Test Summary ===');
console.log(summary);

if (slow.length) {
  console.log('\nSlow tests (>5s):');
  for (const entry of slow.slice(0, 10)) {
    console.log(`- ${entry.ms}ms  ${entry.title}`);
  }
}

if (summary.flaky) {
  console.log('\nFlaky detected. To fail CI on flake, set FAIL_ON_FLAKE=1');
  if (process.env.FAIL_ON_FLAKE === '1') {
    process.exitCode = 2;
  }
}

if (summary.failed) {
  process.exitCode = 1;
} else if (process.exitCode == null && run.status && run.status !== 0) {
  process.exitCode = run.status;
}
