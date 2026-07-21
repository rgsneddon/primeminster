/**
 * Unit tests — drive shipped scoring / construe functions (no re-implementation).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scoreSocialCohesion } from '../src/scs_engine.js';
import { heuristicConstrue, applyConstrual } from '../src/construe.js';
import { burnhamScenario, discourseFieldsFromScenario } from '../src/scenario_burnham.js';
import { toBurnhamMarkdown } from '../src/report.js';

describe('SCS from discourse field inputs', () => {
  it('scores Burnham-PM scenario with observed v/f/s and please-framed question', () => {
    const scenario = burnhamScenario();
    assert.match(scenario.posedQuestion, /please\s*$/i);
    assert.match(scenario.posedQuestion, /observed social discourse/i);

    const fields = discourseFieldsFromScenario(scenario);
    assert.ok(fields.v.trim().length > 0, 'vortex discourse');
    assert.ok(fields.f.trim().length > 0, 'flow discourse');
    assert.ok(fields.s.trim().length > 0, 'shear discourse');

    const result = scoreSocialCohesion({
      ...scenario,
      v: fields.v,
      f: fields.f,
      s: fields.s,
      r: fields.r,
    });

    assert.equal(result.ok, true);
    assert.equal(typeof result.refinedScs, 'number');
    assert.ok(result.refinedScs >= 0 && result.refinedScs <= 100, `SCS in 0–100: ${result.refinedScs}`);
    assert.equal(typeof result.regressivePct, 'number');
    assert.equal(typeof result.progressivePct, 'number');
    assert.ok(result.regressivePct >= 0 && result.regressivePct <= 100);
    assert.ok(result.progressivePct >= 0 && result.progressivePct <= 100);

    // Labeled ω/σ/Iτ/Jμ
    assert.equal(typeof result.constructs.omega, 'number');
    assert.equal(typeof result.constructs.sigma, 'number');
    assert.equal(typeof result.constructs.itau, 'number');
    assert.equal(typeof result.constructs.jmu, 'number');
    assert.ok(result.constructs.vortex === result.constructs.omega);
    assert.ok(result.constructs.shear === result.constructs.sigma);
  });

  it('changes SCS when discourse fields change (not frozen BURNHAM.md constant)', () => {
    const base = scoreSocialCohesion(burnhamScenario());
    const alt = scoreSocialCohesion(
      burnhamScenario({
        vortexText: 'Unified public trust and cohesion support for transparent PM leadership SCS: 80',
        shearText: 'Low polarisation calm dialogue across communities SCS: 35',
        resistanceText: 'Minimal institutional drag open process SCS: 30',
        flowText: 'Strong trust transport and shared narrative SCS: 85',
      }),
    );
    // Different discourse must not force identical construct scores
    const baseKey = `${base.constructs.omega}|${base.constructs.sigma}|${base.constructs.jmu}`;
    const altKey = `${alt.constructs.omega}|${alt.constructs.sigma}|${alt.constructs.jmu}`;
    assert.notEqual(baseKey, altKey, 'construct scores must respond to field inputs');
    assert.ok(alt.refinedScs >= 0 && alt.refinedScs <= 100);
  });
});

describe('Grok construe blank-field rules', () => {
  it('fills only blank fields and preserves user-supplied text', () => {
    const input = {
      posedQuestion: burnhamScenario().posedQuestion,
      topic: burnhamScenario().topic,
      vortexText: 'USER VORTEX LOCKED',
      shearText: '',
      resistanceText: 'USER RESISTANCE LOCKED',
      flowText: '',
      continuumText: '',
    };
    const c = heuristicConstrue(input);
    assert.equal(c.vortexText, 'USER VORTEX LOCKED');
    assert.equal(c.resistanceText, 'USER RESISTANCE LOCKED');
    assert.ok(c.shearText.trim().length > 0, 'blank shear filled');
    assert.ok(c.flowText.trim().length > 0, 'blank flow filled');
    assert.ok(c.continuumText.trim().length > 0, 'blank continuum filled');
    assert.ok(c.filledFields.includes('shearText') || c.filledFields.includes('shearText') || c.filledFields.length >= 2);

    const merged = applyConstrual(input, c);
    assert.equal(merged.vortexText, 'USER VORTEX LOCKED');
    assert.equal(merged.resistanceText, 'USER RESISTANCE LOCKED');
    assert.notEqual(merged.shearText, '');
  });

  it('does not overwrite any field when all are supplied', () => {
    const input = burnhamScenario();
    const c = heuristicConstrue(input);
    assert.equal(c.vortexText, input.vortexText.trim());
    assert.equal(c.shearText, input.shearText.trim());
    assert.equal(c.flowText, input.flowText.trim());
    assert.equal(c.resistanceText, input.resistanceText.trim());
    assert.deepEqual(c.filledFields, []);
  });
});

describe('BURNHAM-like report structure', () => {
  it('includes Part One / Two / Three equivalent sections', () => {
    const result = scoreSocialCohesion(burnhamScenario());
    assert.ok(result.partOne, 'partOne');
    assert.ok(result.partTwo, 'partTwo');
    assert.ok(result.partThree, 'partThree');
    assert.match(result.partOne.title, /Part One/i);
    assert.match(result.partTwo.title, /Part Two/i);
    assert.match(result.partThree.title, /Part Three/i);
    assert.ok(Array.isArray(result.partThree.interventions));
    assert.ok(result.partThree.interventions.length >= 3);
    assert.ok(Array.isArray(result.partThree.actions));

    const md = toBurnhamMarkdown(result);
    assert.match(md, /Refined cohesion score/i);
    assert.match(md, /Part One/i);
    assert.match(md, /Part Two/i);
    assert.match(md, /Part Three/i);
    assert.match(md, /ω|Vortex/i);
    assert.match(md, /Regressive/i);
    assert.match(md, /Progressive/i);
  });

  it('projects lever SCS as a raise above current refined SCS (not absolute 56 floor)', () => {
    const result = scoreSocialCohesion(burnhamScenario());
    const p3 = result.partThree;
    assert.ok(p3.withoutLeversScs >= 0);
    assert.ok(
      p3.withLeversMin > p3.withoutLeversScs,
      `withLeversMin ${p3.withLeversMin} must exceed without ${p3.withoutLeversScs}`,
    );
    assert.ok(
      p3.withLeversMax >= p3.withLeversMin,
      `withLeversMax ${p3.withLeversMax} >= min ${p3.withLeversMin}`,
    );
    assert.ok(
      p3.withLeversMin > result.refinedScs,
      `lever min ${p3.withLeversMin} must exceed refinedScs ${result.refinedScs}`,
    );
    const md = toBurnhamMarkdown(result);
    assert.match(md, /rises from/i);
    assert.match(md, new RegExp(String(result.refinedScs).replace('.', '\\.')));
    assert.ok(
      p3.withLeversMax > result.refinedScs,
      'report lever ceiling must be above current refined SCS',
    );
  });
});
