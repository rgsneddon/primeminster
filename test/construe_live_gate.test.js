/**
 * Live-Grok gate helpers — drive shipped shouldUseLiveGrok / isGrokConfigured.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldUseLiveGrok, isGrokConfigured, heuristicConstrue } from '../src/construe.js';

describe('live Grok gate', () => {
  it('respects liveGrok false even when key may be present', () => {
    assert.equal(shouldUseLiveGrok({ liveGrok: false }), false);
    assert.equal(shouldUseLiveGrok({ heuristicOnly: true }), false);
  });

  it('uses live when liveGrok true and key configured', () => {
    if (!isGrokConfigured()) {
      assert.equal(shouldUseLiveGrok({ liveGrok: true }), false);
      return;
    }
    assert.equal(shouldUseLiveGrok({ liveGrok: true }), true);
    assert.equal(shouldUseLiveGrok({}), true);
  });

  it('heuristic construe still fills blanks without API', () => {
    const h = heuristicConstrue({
      posedQuestion: 'test please',
      vortexText: '',
      shearText: '',
      resistanceText: '',
      flowText: '',
    });
    assert.ok(h.vortexText.trim());
    assert.ok(h.provenance.includes('heuristic') || h.provenance === 'grok-heuristic');
  });
});
