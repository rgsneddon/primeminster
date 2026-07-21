#!/usr/bin/env node
/**
 * Runnable social-cohesion scoring entry for Burnham-PM scenario.
 * Emits structured JSON (+ optional Markdown) to stdout and optional file.
 *
 * Usage:
 *   node scripts/run_scs.js
 *   node scripts/run_scs.js --out path/to/capture.json
 *   node scripts/run_scs.js --markdown
 *   node scripts/run_scs.js --construe
 */

import fs from 'fs';
import path from 'path';
import { scoreSocialCohesion } from '../src/scs_engine.js';
import { burnhamScenario, discourseFieldsFromScenario } from '../src/scenario_burnham.js';
import { heuristicConstrue, applyConstrual } from '../src/construe.js';
import { toBurnhamMarkdown } from '../src/report.js';

function parseArgs(argv) {
  const args = { out: null, markdown: false, construe: false, blanks: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--out' && argv[i + 1]) args.out = argv[++i];
    else if (argv[i] === '--markdown') args.markdown = true;
    else if (argv[i] === '--construe') args.construe = true;
    else if (argv[i] === '--blanks') args.blanks = true;
  }
  return args;
}

const args = parseArgs(process.argv);
let input = burnhamScenario();

if (args.blanks) {
  // Discourse fields empty — construe must fill
  input = burnhamScenario({
    vortexText: '',
    shearText: '',
    resistanceText: '',
    flowText: '',
    continuumText: '',
  });
}

if (args.construe || args.blanks) {
  const c = heuristicConstrue(input);
  input = applyConstrual(input, c);
  input._construeProvenance = c.provenance;
  input._filledFields = c.filledFields;
}

// Drive scoring from observed v/f/s discourse path
const fields = discourseFieldsFromScenario(input);
const result = scoreSocialCohesion({
  ...input,
  v: fields.v,
  f: fields.f,
  s: fields.s,
  r: fields.r,
});

result.construeProvenance = input._construeProvenance || null;
result.filledFields = input._filledFields || [];
result.markdown = toBurnhamMarkdown(result);

const payload = args.markdown
  ? result.markdown
  : JSON.stringify(result, null, 2);

if (args.out) {
  fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
  fs.writeFileSync(args.out, payload, 'utf8');
  console.error(`Wrote ${args.out}`);
}

process.stdout.write(typeof payload === 'string' ? payload : JSON.stringify(payload));
if (!String(payload).endsWith('\n')) process.stdout.write('\n');

// Exit non-zero if scoring failed structural checks
if (result.refinedScs == null || Number.isNaN(result.refinedScs)) {
  process.exit(1);
}
