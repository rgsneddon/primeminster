/**
 * Structural tests: shipped page is light (no Chart.js CDN, few surfaces).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chartConfig } from '../src/view_model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

describe('light page shell', () => {
  it('does not load Chart.js CDN and uses svg-bars surfaces', () => {
    assert.doesNotMatch(html, /cdn\.jsdelivr\.net\/npm\/chart\.js/i);
    assert.doesNotMatch(html, /new Chart\s*\(/);
    assert.match(html, /data-chart-engine="svg-bars"/);
    assert.match(html, /data-charts="light-svg"/);
    const canvases = (html.match(/<canvas/g) || []).length;
    assert.ok(canvases === 0, `expected 0 canvas elements, got ${canvases}`);
    assert.match(html, /AbortSignal\.timeout|timeoutMs/);
    assert.match(html, /bootWatchdog|Load timed out/);
  });

  it('chartConfig matches shipped light policy', () => {
    const cfg = chartConfig();
    assert.equal(cfg.cdn, false);
    assert.equal(cfg.engine, 'svg-bars');
  });
});
