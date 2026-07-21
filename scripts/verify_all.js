#!/usr/bin/env node
/**
 * Runs verification captures for the goal plan (dual SCS + structural checks).
 * Usage: node scripts/verify_all.js [scratchDir]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { scoreSocialCohesion } from '../src/scs_engine.js';
import { burnhamScenario } from '../src/scenario_burnham.js';
import { toBurnhamMarkdown } from '../src/report.js';
import { heuristicConstrue, applyConstrual } from '../src/construe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SCRATCH =
  process.argv[2] ||
  process.env.SCRATCH ||
  path.join(ROOT, 'verify_out');

fs.mkdirSync(SCRATCH, { recursive: true });

function write(name, data) {
  const p = path.join(SCRATCH, name);
  fs.writeFileSync(p, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  console.log('wrote', p);
  return p;
}

// Dual SCS runs
const scenario = burnhamScenario();
const run1 = scoreSocialCohesion(scenario);
const run2 = scoreSocialCohesion(scenario);
run1.markdown = toBurnhamMarkdown(run1);
run2.markdown = toBurnhamMarkdown(run2);
write('scs_run1.json', run1);
write('scs_run2.json', run2);
write('burnham_like_report.md', run1.markdown);

function assertRun(r, label) {
  if (!(r.refinedScs >= 0 && r.refinedScs <= 100)) throw new Error(`${label}: bad SCS`);
  if (r.regressivePct == null || r.progressivePct == null) throw new Error(`${label}: missing shares`);
  if (r.constructs?.omega == null || r.constructs?.sigma == null) throw new Error(`${label}: missing constructs`);
  console.log(label, 'ok SCS=', r.refinedScs, 'ω', r.constructs.omega, 'σ', r.constructs.sigma);
}

assertRun(run1, 'run1');
assertRun(run2, 'run2');

// Unit tests
const test = spawnSync(process.execPath, ['--test', 'test/scs_engine.test.js', 'test/construe_apply.test.js'], {
  cwd: ROOT,
  encoding: 'utf8',
});
write('unit_tests.log', (test.stdout || '') + (test.stderr || ''));
if (test.status !== 0) {
  console.error(test.stdout, test.stderr);
  process.exit(test.status || 1);
}
console.log('unit tests passed');

// Structural page check
const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
if (!html.includes('chart-radar') || !html.includes('data-chart')) {
  throw new Error('page missing chart surfaces');
}
if (!html.includes('Part One') || !html.includes('Part Three')) {
  throw new Error('page missing BURNHAM-like parts');
}
write('page_structural.txt', {
  hasRadar: html.includes('chart-radar'),
  hasGauge: html.includes('chart-gauge'),
  hasHistory: html.includes('chart-history'),
  hasPartOne: html.includes('Part One'),
  hasPartThree: html.includes('Part Three'),
  hasVfs: html.includes('id="v"') && html.includes('id="f"') && html.includes('id="s"'),
  length: html.length,
});

// Construe blank check capture
const blank = burnhamScenario({ vortexText: '', shearText: 'kept shear' });
const c = heuristicConstrue(blank);
const filled = applyConstrual(blank, c);
write('construe_blank_fill.json', { construal: c, merged: filled });

console.log('verify_all complete →', SCRATCH);
