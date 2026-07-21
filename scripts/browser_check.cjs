const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCRATCH =
  process.env.SCRATCH ||
  path.join(__dirname, '..', 'verify_out');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('console:' + msg.text());
  });

  await page.goto('http://127.0.0.1:9480/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('#kpi-scs', { timeout: 15000 });
  await page.waitForFunction(() => {
    const el = document.getElementById('kpi-scs');
    return el && el.textContent && el.textContent !== '—';
  }, { timeout: 15000 });

  const scs = await page.textContent('#kpi-scs');
  const omega = await page.textContent('#kpi-omega');
  const radar = await page.$('#chart-radar');
  const radarBox = await radar.boundingBox();

  await page.click('#btn-score');
  await page.waitForTimeout(1000);
  const scs2 = await page.textContent('#kpi-scs');

  fs.mkdirSync(SCRATCH, { recursive: true });
  await page.screenshot({ path: path.join(SCRATCH, 'page.png'), fullPage: true });

  const out = {
    scs,
    scs2,
    omega,
    radarFilled: !!(radarBox && radarBox.width > 50 && radarBox.height > 50),
    pageErrors: errors,
    reportLen: ((await page.textContent('#report-md')) || '').length,
  };
  fs.writeFileSync(path.join(SCRATCH, 'page_browser.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));

  if (!out.radarFilled) process.exit(2);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
