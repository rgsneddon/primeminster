#!/usr/bin/env node
/**
 * Perpetual / recurring Grok construe loop for the Burnham-PM discourse scenario.
 * Interval ticks: construe blank fields (heuristic or live Grok) → score → append history.
 *
 * Env:
 *   SCS_INTERVAL_MS  — default 15000
 *   SCS_MAX_TICKS    — default 0 (infinite); set e.g. 3 for finite runs
 *   XAI_API_KEY      — optional live Grok
 *   SCS_SERVER_URL   — if set, POST cycles to server; else local in-process
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scoreSocialCohesion } from '../src/scs_engine.js';
import { grokConstrue, applyConstrual } from '../src/construe.js';
import { burnhamScenario } from '../src/scenario_burnham.js';
import { HistoryStore } from '../src/history_store.js';
import { toBurnhamMarkdown } from '../src/report.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INTERVAL = Number(process.env.SCS_INTERVAL_MS || 15000);
const MAX_TICKS = Number(process.env.SCS_MAX_TICKS || 0);
const SERVER = (process.env.SCS_SERVER_URL || '').replace(/\/$/, '');
const LIVE = process.env.SCS_LIVE_GROK === '1' || process.env.SCS_LIVE_GROK === 'true';
const DATA = process.env.SCS_DATA_DIR || path.join(__dirname, '..', 'data');
const store = new HistoryStore(path.join(DATA, 'scs_history.json'));

let ticks = 0;

async function tick() {
  ticks += 1;
  const t0 = Date.now();

  if (SERVER) {
    try {
      const res = await fetch(`${SERVER}/scs/cycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liveGrok: LIVE }),
        signal: AbortSignal.timeout(25000),
      });
      const body = await res.json();
      console.log(
        JSON.stringify({
          tick: ticks,
          via: 'server',
          ok: body.ok,
          refinedScs: body.result?.refinedScs,
          provenance: body.result?.construeProvenance,
          ms: Date.now() - t0,
        }),
      );
      return body;
    } catch (e) {
      console.error(JSON.stringify({ tick: ticks, via: 'server', error: e.message }));
      return null;
    }
  }

  // Local: start from scenario with optional blank fields so construe has work
  let input = burnhamScenario();
  // On alternate ticks, clear one field to demonstrate blank-only fill without overwriting all
  if (ticks % 3 === 0) {
    input = burnhamScenario({ continuumText: '' });
  }
  const c = await grokConstrue(input, { apiKey: LIVE ? process.env.XAI_API_KEY : '' });
  input = applyConstrual(input, c);
  const result = scoreSocialCohesion(input);
  result.construeProvenance = c.provenance;
  result.markdown = toBurnhamMarkdown(result);
  store.push(result);

  console.log(
    JSON.stringify({
      tick: ticks,
      via: 'local',
      refinedScs: result.refinedScs,
      progressivePct: result.progressivePct,
      regressivePct: result.regressivePct,
      omega: result.constructs.omega,
      sigma: result.constructs.sigma,
      itau: result.constructs.itau,
      jmu: result.constructs.jmu,
      provenance: c.provenance,
      filledFields: c.filledFields,
      historyCount: store.history.length,
      ms: Date.now() - t0,
    }),
  );

  if (process.env.SCS_TICK_OUT) {
    fs.writeFileSync(process.env.SCS_TICK_OUT, JSON.stringify(result, null, 2));
  }

  return result;
}

console.error(
  `Perpetual Grok construe loop: interval=${INTERVAL}ms maxTicks=${MAX_TICKS || '∞'} server=${SERVER || 'local'} liveGrok=${LIVE}`,
);

await tick();
if (MAX_TICKS === 1) process.exit(0);

const timer = setInterval(async () => {
  await tick();
  if (MAX_TICKS > 0 && ticks >= MAX_TICKS) {
    clearInterval(timer);
    process.exit(0);
  }
}, INTERVAL);
