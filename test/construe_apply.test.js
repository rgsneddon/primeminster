import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { heuristicConstrue, applyConstrual } from '../src/construe.js';
import { scoreSocialCohesion } from '../src/scs_engine.js';
import { burnhamScenario } from '../src/scenario_burnham.js';

describe('construe then score path', () => {
  it('produces valid SCS after blank construal', () => {
    const blank = burnhamScenario({
      vortexText: '',
      shearText: '',
      resistanceText: '',
      flowText: '',
      continuumText: '',
    });
    const c = heuristicConstrue(blank);
    const filled = applyConstrual(blank, c);
    assert.ok(filled.vortexText.trim());
    assert.ok(filled.shearText.trim());
    assert.ok(filled.flowText.trim());
    const result = scoreSocialCohesion(filled);
    assert.ok(result.refinedScs >= 0 && result.refinedScs <= 100);
    assert.ok(result.constructs.omega > 0);
  });
});
