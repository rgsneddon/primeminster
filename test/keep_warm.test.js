/**
 * Structural / unit tests for keep-warm helpers (not Flyclient).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { healthUrl } from '../scripts/keep_warm.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

describe('keep-warm (Render cold start mitigation)', () => {
  it('builds health URL for live Render host pattern', () => {
    const u = healthUrl('https://evolve-perc-internet.onrender.com', '/health');
    assert.equal(u, 'https://evolve-perc-internet.onrender.com/health');
    assert.match(u, /onrender\.com\/health/);
    assert.doesNotMatch(u, /flyclient/i);
  });

  it('ships keep_warm.js and does not depend on Flyclient', () => {
    const src = fs.readFileSync(path.join(root, 'scripts', 'keep_warm.js'), 'utf8');
    assert.match(src, /keep-warm|KEEP_WARM/);
    assert.match(src, /\/health/);
    assert.match(src, /Flyclient/);
    assert.match(src, /does not/);
    assert.ok(src.includes('evolve-perc-internet.onrender.com'));
  });

  it('ships GitHub Action cron for public health pings', () => {
    const yml = fs.readFileSync(path.join(root, '.github', 'workflows', 'keep-warm.yml'), 'utf8');
    assert.match(yml, /cron:/);
    assert.match(yml, /keep_warm\.js/);
    assert.match(yml, /onrender\.com/);
  });
});
