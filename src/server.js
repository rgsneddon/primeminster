/**
 * PrimeMinster local server — dynamic Burnham-PM cohesion page + SCS API.
 * Same route surface mirrored on flokkinet (perc_chain internet_node).
 */

import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { scoreSocialCohesion } from './scs_engine.js';
import { grokConstrue, applyConstrual, heuristicConstrue } from './construe.js';
import { burnhamScenario } from './scenario_burnham.js';
import { toBurnhamMarkdown } from './report.js';
import { HistoryStore } from './history_store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || process.env.PRIMEMINSTER_PORT || 9480);
const DATA_DIR = process.env.SCS_DATA_DIR || path.join(ROOT, 'data');
const history = new HistoryStore(path.join(DATA_DIR, 'scs_history.json'));

// Seed one score so the page has data immediately
const seed = scoreSocialCohesion(burnhamScenario());
seed.construeProvenance = 'seed';
history.push(seed);

function json(res, code, body) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function serveStatic(rel, res) {
  const safe = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(PUBLIC, safe);
  if (!filePath.startsWith(PUBLIC) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return false;
  }
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
  };
  res.writeHead(200, {
    'Content-Type': types[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
  });
  res.end(fs.readFileSync(filePath));
  return true;
}

async function runScore(body = {}, { construe = false } = {}) {
  let input = {
    ...burnhamScenario(),
    ...body,
    vortexText: body.vortexText ?? body.v ?? body.omega,
    shearText: body.shearText ?? body.s ?? body.sigma,
    resistanceText: body.resistanceText ?? body.r ?? body.itau,
    flowText: body.flowText ?? body.f ?? body.jmu,
    posedQuestion: body.posedQuestion ?? body.scenarioQuery,
  };
  // Drop undefined so defaults from burnhamScenario remain for missing keys only when body empty
  for (const k of Object.keys(input)) {
    if (input[k] === undefined) delete input[k];
  }
  input = { ...burnhamScenario(), ...input };

  let provenance = null;
  if (construe || body.construe) {
    const c = body.liveGrok ? await grokConstrue(input) : heuristicConstrue(input);
    input = applyConstrual(input, c);
    provenance = c.provenance;
  }

  const result = scoreSocialCohesion(input);
  result.construeProvenance = provenance;
  result.markdown = toBurnhamMarkdown(result);
  history.push(result);
  return result;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});

  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/burnham')) {
    if (serveStatic('index.html', res)) return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/static/')) {
    if (serveStatic(url.pathname.slice('/static/'.length), res)) return;
  }

  if (req.method === 'GET' && !url.pathname.startsWith('/scs') && !url.pathname.startsWith('/api') && !url.pathname.startsWith('/health')) {
    if (serveStatic(url.pathname.slice(1), res)) return;
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, {
      ok: true,
      service: 'primeminster-scs',
      flokkinet: 'evolve-perc-internet',
      renderService: process.env.RENDER_EXTERNAL_URL || null,
    });
  }

  if (req.method === 'GET' && url.pathname === '/scs/latest') {
    const snap = history.snapshot();
    return json(res, 200, {
      ok: true,
      latest: snap.latest,
      history: snap.history,
      count: snap.count,
    });
  }

  if (req.method === 'GET' && url.pathname === '/scs/report') {
    const latest = history.latest || scoreSocialCohesion(burnhamScenario());
    const md = latest.markdown || toBurnhamMarkdown(latest);
    res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' });
    res.end(md);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/scs/score') {
    const body = await readBody(req);
    try {
      const result = await runScore(body, { construe: Boolean(body.construe) });
      return json(res, 200, result);
    } catch (e) {
      return json(res, 500, { ok: false, error: e.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/scs/construe') {
    const body = await readBody(req);
    const input = { ...burnhamScenario(), ...body };
    try {
      const c = body.liveGrok ? await grokConstrue(input) : heuristicConstrue(input);
      return json(res, 200, { ok: true, ...c });
    } catch (e) {
      return json(res, 500, { ok: false, error: e.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/scs/cycle') {
    // One perpetual-loop tick: construe blanks → score → store history
    const body = await readBody(req);
    try {
      const result = await runScore({ ...body, construe: true }, { construe: true });
      return json(res, 200, { ok: true, result, historyCount: history.history.length });
    } catch (e) {
      return json(res, 500, { ok: false, error: e.message });
    }
  }

  if (req.method === 'GET' && url.pathname === '/scs/scenario') {
    return json(res, 200, { ok: true, scenario: burnhamScenario() });
  }

  return json(res, 404, { error: 'not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`PrimeMinster SCS listening on http://127.0.0.1:${PORT}`);
  console.log(`Burnham page: http://127.0.0.1:${PORT}/`);
  console.log(`SCS score: POST http://127.0.0.1:${PORT}/scs/score`);
});

export { server, history, runScore };
