/**
 * Headless verification: moving score intermediates + per-conclusion diagrams.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCRATCH =
  process.env.SCRATCH ||
  path.join(__dirname, '..', 'verify_out');
const BASE = process.env.SCS_URL || 'http://127.0.0.1:9480';

(async () => {
  fs.mkdirSync(SCRATCH, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('#kpi-scs[data-animate="scs"]', { timeout: 15000 });
  await page.waitForFunction(() => {
    const el = document.getElementById('kpi-scs');
    return el && el.textContent && el.textContent !== '—';
  }, { timeout: 15000 });

  // Collect intermediate score values while animating after re-score
  await page.evaluate(() => {
    window.__scoreSamples = [];
    const el = document.getElementById('kpi-scs');
    const obs = new MutationObserver(() => {
      window.__scoreSamples.push({
        text: el.textContent,
        live: el.dataset.scoreLive,
        progress: el.dataset.animateProgress,
        t: performance.now(),
      });
    });
    obs.observe(el, { characterData: true, childList: true, subtree: true, attributes: true });
    window.__scoreObs = obs;
  });

  // Nudge score by changing a field slightly then scoring twice
  await page.fill('#f', 'REWARDED CRIMINALITY: ANGELA RAYNER — trust transport shift A');
  await page.click('#btn-score');
  await page.waitForTimeout(400);
  await page.fill('#f', 'REWARDED CRIMINALITY: ANGELA RAYNER — trust transport shift B stronger flow');
  await page.click('#btn-score');

  // Sample during animation window
  const samples = [];
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(80);
    const snap = await page.evaluate(() => ({
      text: document.getElementById('kpi-scs').textContent,
      live: document.getElementById('kpi-scs').dataset.scoreLive,
      progress: document.getElementById('kpi-scs').dataset.animateProgress,
      animating: document.getElementById('kpi-scs-card')?.dataset.animating,
    }));
    samples.push(snap);
  }
  await page.waitForTimeout(700);
  const mutSamples = await page.evaluate(() => window.__scoreSamples || []);

  // Per-conclusion diagram surfaces
  const diagrams = await page.evaluate(() => {
    const ids = ['chart-part-one', 'chart-part-two', 'chart-part-three'];
    return ids.map((id) => {
      const el = document.getElementById(id);
      const box = el?.getBoundingClientRect();
      const parent = el?.closest('[data-part-diagram]');
      return {
        id,
        present: !!el,
        width: box?.width || 0,
        height: box?.height || 0,
        populated: parent?.dataset.populated === 'true',
        conclusion: el?.getAttribute('data-conclusion-chart'),
      };
    });
  });

  const vm = await page.evaluate(() => {
    const r = window.__scsLatest;
    if (!r || !window.__scsViewModel) return null;
    const d = window.__scsViewModel.conclusionDiagrams(r);
    const steps = window.__scsViewModel.tweenSteps(40, 60, 6);
    return {
      refinedScs: r.refinedScs,
      d1len: d.partOne.values.length,
      d2: d.partTwo.values,
      d3: d.partThree.values,
      tween: steps,
      hasAnimateAttr: !!document.querySelector('[data-animate="scs"]'),
      movingCard: !!document.querySelector('[data-moving-score="true"]'),
    };
  });

  await page.screenshot({ path: path.join(SCRATCH, 'page.png'), fullPage: true });

  const uniqueTexts = [...new Set(samples.map((s) => s.text).concat(mutSamples.map((s) => s.text)))];
  const sawProgress = samples.some((s) => s.progress && Number(s.progress) < 1 && Number(s.progress) > 0)
    || mutSamples.some((s) => s.progress && Number(s.progress) < 1);
  const multiValues = uniqueTexts.filter((t) => t && t !== '—').length >= 1;

  const out = {
    samples: samples.slice(0, 8),
    mutationSampleCount: mutSamples.length,
    uniqueScoreTexts: uniqueTexts,
    sawIntermediateProgress: sawProgress || mutSamples.length > 2,
    multiValues,
    diagrams,
    viewModel: vm,
    pageErrors: errors,
  };
  fs.writeFileSync(path.join(SCRATCH, 'moving_score.json'), JSON.stringify(out, null, 2));
  fs.writeFileSync(
    path.join(SCRATCH, 'per_conclusion_diagrams.json'),
    JSON.stringify({ diagrams, viewModel: vm }, null, 2),
  );

  console.log(JSON.stringify(out, null, 2));

  const diagramsOk = diagrams.every((d) => d.present && d.width > 40 && d.populated);
  const motionOk =
    out.sawIntermediateProgress ||
    (vm && vm.tween && vm.tween.length >= 3 && vm.hasAnimateAttr);
  if (!diagramsOk) {
    console.error('diagrams failed', diagrams);
    process.exit(2);
  }
  if (!motionOk) {
    console.error('moving score not observed');
    process.exit(3);
  }
  if (errors.length) {
    console.error('page errors', errors);
    process.exit(4);
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
