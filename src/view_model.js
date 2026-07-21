/**
 * View-model helpers for the Burnham-PM page:
 * - score tween / moving-score intermediates
 * - per-conclusion diagram series from real scoreSocialCohesion payload
 *
 * Pure functions — unit-tested without DOM.
 */

function round1(n) {
  return Math.round(Number(n) * 10) / 10;
}

function easeInOut(t) {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

/**
 * Interpolate a score from `from` to `to` at progress t ∈ [0,1].
 * @param {number} from
 * @param {number} to
 * @param {number} t
 * @returns {number}
 */
export function interpolateScore(from, to, t) {
  const a = Number(from) || 0;
  const b = Number(to) || 0;
  return a + (b - a) * easeInOut(t);
}

/**
 * Discrete tween steps for moving score (including start and end).
 * Intermediate values lie strictly between start and end when from ≠ to.
 * @param {number} from
 * @param {number} to
 * @param {number} [steps=12]
 * @returns {number[]}
 */
export function tweenSteps(from, to, steps = 12) {
  const n = Math.max(2, Math.floor(steps));
  const out = [];
  for (let i = 0; i <= n; i++) {
    out.push(round1(interpolateScore(from, to, i / n)));
  }
  return out;
}

/**
 * Part One diagram: baseline construct mapping.
 * @param {object} result scoreSocialCohesion payload
 */
export function partOneDiagram(result) {
  const p1 = result?.partOne || {};
  const c = result?.constructs || {};
  return {
    part: 'one',
    title: 'Part One: Baseline Parameter Mapping',
    labels: ['ω Vortex', 'σ Shear', 'Iτ Resistance', 'Jμ Flow', 'Baseline SCS', 'Weighted SCS'],
    values: [
      num(c.omega ?? c.vortex),
      num(c.sigma ?? c.shear),
      num(c.itau ?? c.resistance),
      num(c.jmu ?? c.flow),
      num(p1.baselineScs ?? result?.baselineScs),
      num(p1.weightedOverallScs ?? result?.overallScs),
    ],
    colors: ['#7c6cff', '#ff6b9d', '#f59e0b', '#00d4aa', '#4b5568', '#6c63ff'],
  };
}

/**
 * Part Two diagram: continuum refinement (reg/prog + refined SCS).
 * @param {object} result
 */
export function partTwoDiagram(result) {
  const p2 = result?.partTwo || {};
  const reg = num(p2.regressivePct ?? result?.regressivePct);
  const prog = num(p2.progressivePct ?? result?.progressivePct);
  const refined = num(p2.refinedScs ?? result?.refinedScs);
  return {
    part: 'two',
    title: 'Part Two: Broader Political Continuum Integration',
    labels: ['Regressive %', 'Progressive %', 'Refined SCS'],
    values: [reg, prog, refined],
    colors: ['#f59e0b', '#00d4aa', '#6c63ff'],
    split: { regressive: reg, progressive: prog },
  };
}

/**
 * Part Three diagram: lever band vs without-levers SCS.
 * @param {object} result
 */
export function partThreeDiagram(result) {
  const p3 = result?.partThree || {};
  const without = num(p3.withoutLeversScs ?? result?.refinedScs);
  const min = num(p3.withLeversMin ?? without);
  const max = num(p3.withLeversMax ?? min);
  return {
    part: 'three',
    title: 'Part Three: Actionable Levers',
    labels: ['Without levers', 'Levers min', 'Levers max'],
    values: [without, min, max],
    colors: ['#4b5568', '#00d4aa', '#34d399'],
  };
}

/**
 * Build all three conclusion diagram view-models from a score payload.
 * @param {object} result
 */
export function conclusionDiagrams(result) {
  return {
    partOne: partOneDiagram(result),
    partTwo: partTwoDiagram(result),
    partThree: partThreeDiagram(result),
  };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Page loading presentation state for the top LOADING… tag.
 * Pure helper — unit-tested without DOM.
 *
 * @param {boolean} currentlyVisible
 * @param {'start'|'success'|'error'|'idle'} event
 * @returns {{ visible: boolean, label: string, reason: string }}
 */
export function loadingPresentation(currentlyVisible, event) {
  switch (event) {
    case 'start':
      return { visible: true, label: 'LOADING…', reason: 'fetch-start' };
    case 'success':
      return { visible: false, label: 'LOADING…', reason: 'fetch-success' };
    case 'error':
      return { visible: false, label: 'LOADING…', reason: 'fetch-error' };
    case 'idle':
    default:
      return {
        visible: Boolean(currentlyVisible),
        label: 'LOADING…',
        reason: 'idle',
      };
  }
}

/** Initial page paint: LOADING should be visible before first data. */
export function initialLoadingState() {
  return loadingPresentation(false, 'start');
}

export { round1, easeInOut };
