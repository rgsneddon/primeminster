/**
 * Drive shipped view_model helpers with real scoreSocialCohesion output.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  interpolateScore,
  tweenSteps,
  partOneDiagram,
  partTwoDiagram,
  partThreeDiagram,
  conclusionDiagrams,
  loadingPresentation,
  initialLoadingState,
  chartConfig,
  buildBarChartSvg,
  capHistory,
} from '../src/view_model.js';
import { scoreSocialCohesion } from '../src/scs_engine.js';
import { burnhamScenario } from '../src/scenario_burnham.js';

describe('moving score tween', () => {
  it('interpolateScore yields intermediates between from and to', () => {
    const mid = interpolateScore(40, 60, 0.5);
    assert.ok(mid > 40 && mid < 60, `mid ${mid} between 40 and 60`);
    assert.equal(interpolateScore(10, 90, 0), 10);
    assert.equal(interpolateScore(10, 90, 1), 90);
  });

  it('tweenSteps includes start, end, and midpoints', () => {
    const steps = tweenSteps(50, 70, 8);
    assert.ok(steps.length >= 3);
    assert.equal(steps[0], 50);
    assert.equal(steps[steps.length - 1], 70);
    const mids = steps.slice(1, -1);
    assert.ok(mids.every((v) => v > 50 && v < 70), `mids strictly between: ${mids}`);
  });
});

describe('page LOADING presentation state', () => {
  it('starts visible with LOADING label and hides on success and error', () => {
    const boot = initialLoadingState();
    assert.equal(boot.visible, true);
    assert.match(boot.label, /LOADING/i);

    const start = loadingPresentation(false, 'start');
    assert.equal(start.visible, true);
    assert.equal(start.reason, 'fetch-start');

    const ok = loadingPresentation(true, 'success');
    assert.equal(ok.visible, false);
    assert.equal(ok.reason, 'fetch-success');

    const err = loadingPresentation(true, 'error');
    assert.equal(err.visible, false);
    assert.equal(err.reason, 'fetch-error');
  });
});

describe('lightweight chart config (no Chart.js CDN)', () => {
  it('ships svg-bars engine without CDN animations', () => {
    const cfg = chartConfig();
    assert.equal(cfg.engine, 'svg-bars');
    assert.equal(cfg.cdn, false);
    assert.equal(cfg.animations, false);
    assert.ok(cfg.maxSurfaces <= 4);
    assert.ok(cfg.fetchTimeoutMs > 0 && cfg.fetchTimeoutMs <= 30000);
  });

  it('buildBarChartSvg encodes real construct scores from SCS payload', () => {
    const result = scoreSocialCohesion(burnhamScenario());
    const d1 = partOneDiagram(result);
    const svg = buildBarChartSvg(d1.labels.slice(0, 4), d1.values.slice(0, 4), d1.colors);
    assert.match(svg, /data-chart-engine="svg-bars"/);
    assert.match(svg, /<svg/);
    assert.ok(!svg.includes('chart.js'));
    assert.ok(svg.includes(String(Math.floor(d1.values[0]))));
  });

  it('capHistory bounds length for light history', () => {
    const big = Array.from({ length: 50 }, (_, i) => ({ refinedScs: i }));
    const capped = capHistory(big, 12);
    assert.equal(capped.length, 12);
    assert.equal(capped[0].refinedScs, 38);
  });
});

describe('per-conclusion diagrams from real SCS payload', () => {
  it('builds Part One/Two/Three diagram series from scoreSocialCohesion', () => {
    const result = scoreSocialCohesion(burnhamScenario());
    const d1 = partOneDiagram(result);
    const d2 = partTwoDiagram(result);
    const d3 = partThreeDiagram(result);

    assert.equal(d1.part, 'one');
    assert.equal(d1.labels.length, d1.values.length);
    assert.ok(d1.values.every((v) => typeof v === 'number'));
    // Bound to real constructs / partOne metrics
    assert.equal(d1.values[0], result.constructs.omega);
    assert.equal(d1.values[4], result.partOne.baselineScs);

    assert.equal(d2.part, 'two');
    assert.equal(d2.split.regressive, result.partTwo.regressivePct);
    assert.equal(d2.split.progressive, result.partTwo.progressivePct);
    assert.equal(d2.values[2], result.partTwo.refinedScs);

    assert.equal(d3.part, 'three');
    assert.equal(d3.values[0], result.partThree.withoutLeversScs);
    assert.equal(d3.values[1], result.partThree.withLeversMin);
    assert.equal(d3.values[2], result.partThree.withLeversMax);
    assert.ok(d3.values[1] > d3.values[0], 'lever min raises above without');

    const all = conclusionDiagrams(result);
    assert.ok(all.partOne && all.partTwo && all.partThree);
  });
});
