#!/usr/bin/env node
/**
 * Keep-warm for Render free-tier cold starts (NOT Flyclient).
 *
 * Flyclient is a blockchain light-client protocol (MMR sampling for PoW chains).
 * It does not speed up HTTP page loads or wake a sleeping Render dyno.
 *
 * This script GETs the live service /health (and optionally /burnham) on an
 * interval so the free tier is less likely to sleep (~15 min idle).
 *
 * Usage:
 *   node scripts/keep_warm.js              # loop forever (default 12 min)
 *   node scripts/keep_warm.js --once       # single ping (for CI / verification)
 *   node scripts/keep_warm.js --times 2    # two pings then exit
 *
 * Env:
 *   KEEP_WARM_BASE_URL   default https://evolve-perc-internet.onrender.com
 *   KEEP_WARM_INTERVAL_MS  default 720000 (12 minutes)
 *   KEEP_WARM_PATHS      comma list default /health,/burnham
 *   KEEP_WARM_TIMEOUT_MS default 120000
 */

import path from 'path';

const BASE = (process.env.KEEP_WARM_BASE_URL || 'https://evolve-perc-internet.onrender.com').replace(
  /\/$/,
  '',
);
const INTERVAL = Number(process.env.KEEP_WARM_INTERVAL_MS || 12 * 60 * 1000);
const TIMEOUT = Number(process.env.KEEP_WARM_TIMEOUT_MS || 120_000);
const PATHS = (process.env.KEEP_WARM_PATHS || '/health,/burnham')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean)
  .map((p) => (p.startsWith('/') ? p : `/${p}`));

function parseArgs(argv) {
  const out = { once: false, times: 0 };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--once') out.once = true;
    else if (argv[i] === '--times' && argv[i + 1]) out.times = Number(argv[++i]);
  }
  if (out.once) out.times = Math.max(1, out.times || 1);
  return out;
}

/**
 * Pure URL builder for tests.
 * @param {string} base
 * @param {string} path
 */
export function healthUrl(base, path = '/health') {
  const b = String(base || '').replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

/**
 * @param {string} url
 * @param {number} timeoutMs
 */
export async function pingUrl(url, timeoutMs = TIMEOUT) {
  const started = Date.now();
  const res = await fetch(url, {
    method: 'GET',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'User-Agent': 'primeminster-keep-warm/1.0' },
  });
  const text = await res.text();
  return {
    url,
    ok: res.ok,
    status: res.status,
    ms: Date.now() - started,
    bodySnippet: text.slice(0, 240),
    hasCohesionUi:
      /kpi-scs|chart-part|LOADING|Burnham|refinedScs|Chronoflux/i.test(text) ||
      /"ok"\s*:\s*true/.test(text),
  };
}

export async function pingAll(base = BASE, paths = PATHS, timeoutMs = TIMEOUT) {
  const results = [];
  for (const p of paths) {
    const url = healthUrl(base, p);
    try {
      results.push(await pingUrl(url, timeoutMs));
    } catch (e) {
      results.push({
        url,
        ok: false,
        status: 0,
        ms: timeoutMs,
        error: String(e?.message || e),
        hasCohesionUi: false,
      });
    }
  }
  return results;
}

async function main() {
  const args = parseArgs(process.argv);
  let n = 0;

  console.error(
    `keep-warm base=${BASE} intervalMs=${INTERVAL} paths=${PATHS.join(',')} (Flyclient not used)`,
  );

  async function tick() {
    n += 1;
    const results = await pingAll();
    const line = {
      tick: n,
      at: new Date().toISOString(),
      results: results.map((r) => ({
        path: r.url.replace(BASE, ''),
        ok: r.ok,
        status: r.status,
        ms: r.ms,
        hasUi: r.hasCohesionUi,
        error: r.error || null,
      })),
    };
    console.log(JSON.stringify(line));
    const failed = results.filter((r) => !r.ok);
    if (failed.length && args.times > 0) {
      process.exitCode = 1;
    }
    return results;
  }

  if (args.times > 0) {
    for (let i = 0; i < args.times; i++) {
      await tick();
      if (i + 1 < args.times) await new Promise((r) => setTimeout(r, 1500));
    }
    process.exit(process.exitCode || 0);
  }

  await tick();
  setInterval(() => {
    tick().catch((e) => console.error(JSON.stringify({ error: String(e) })));
  }, INTERVAL);
}

// Only auto-run when this file is the entry script (not when imported by tests
// named keep_warm.test.js).
const entry = process.argv[1] ? path.basename(process.argv[1]) : '';
const isMain = entry === 'keep_warm.js';

if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
