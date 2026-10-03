/*
 * Browser end-to-end check of the dashboard (Playwright + Chromium).
 *
 * Not part of `npm test`: it needs a running server and a Playwright install.
 *
 *   npm run build
 *   PORT=3301 node dist/web-server-entry.js &        # start the server
 *   BASE_URL=http://localhost:3301 node tests/e2e/dashboard.playwright.cjs
 *
 * Environment:
 *   BASE_URL           server to test (default http://localhost:3000)
 *   PLAYWRIGHT_MODULE  path of the playwright package (default /opt/node22/lib/node_modules/playwright,
 *                      falls back to a normal require('playwright'))
 *   CHROMIUM_PATH      chromium executable (default /opt/pw-browsers/chromium-1194/chrome-linux/chrome)
 *
 * The Tailwind CDN and Google Fonts are blocked on purpose; the dashboard logic does not need them.
 * Downloads are written to a temporary directory. Exit code 0 = all checks passed.
 * Run it from the repository root: the example projects under ./examples are used as audit targets.
 */
'use strict';
const os = require('os');
const path = require('path');
const fs = require('fs');

function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_MODULE, '/opt/node22/lib/node_modules/playwright', 'playwright'];
  for (const c of candidates.filter(Boolean)) {
    try {
      return require(c);
    } catch (e) {
      /* try next */
    }
  }
  throw new Error('Playwright not found; set PLAYWRIGHT_MODULE');
}
const { chromium } = loadPlaywright();

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'rbp-dashboard-e2e-'));
const results = [];
function check(name, ok, extra) {
  results.push({ name, ok: !!ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  -> ' + extra : ''));
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 1000 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => { if (!/tailwind is not defined/.test(e.message)) errors.push('pageerror: ' + e.message); });
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push('console: ' + m.text()); });
  await ctx.route(/cdn\.tailwindcss\.com|fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());

  await page.goto(BASE_URL + '/dashboard');
  await page.waitForFunction(() => document.querySelector('[data-el="status-text"]').textContent === 'Online', null, { timeout: 8000 });
  check('status pill Online', true);
  check('version shown', /^v\d/.test(await page.textContent('[data-el="version"]')), await page.textContent('[data-el="version"]'));
  await page.waitForFunction(() => /^\d+$/.test(document.querySelector('[data-el="stat-practices"]').textContent));
  check('practice stat live', +(await page.textContent('[data-el="stat-practices"]')) >= 60, await page.textContent('[data-el="stat-practices"]'));
  check('workflow stat', (await page.textContent('[data-el="stat-workflows"]')) === '12');
  check('copyright', (await page.textContent('footer')).includes('Alexander Seymer') && !/Enterprise R Foundation/.test(await page.textContent('footer')), (await page.textContent('footer')).replace(/\s+/g, ' ').slice(-60));

  // ---- Validate project
  await page.fill('#audit-path', './examples/example-package');
  await page.click('[data-el="audit-btn"]');
  await page.waitForSelector('[data-el="findings"] article', { timeout: 8000 });
  const nFind = await page.locator('[data-el="findings"] article').count();
  check('audit renders findings', nFind > 0, nFind + ' findings');
  check('summary mentions workflow', /R package/.test(await page.textContent('[data-el="findings-summary"]')), await page.textContent('[data-el="findings-summary"]'));
  check('issue badge', (await page.textContent('[data-el="issue-badge"]')) === String(nFind));
  check('stat-audit', (await page.textContent('[data-el="stat-audit"]')) === String(nFind));
  // severity chip filter
  const chips = page.locator('[data-el="severity-chips"] button');
  const chipCount = await chips.count();
  check('severity chips', chipCount > 0, chipCount);
  await chips.first().click();
  const filtered = await page.locator('[data-el="findings"] article').count();
  check('chip filters list', filtered > 0 && filtered <= nFind, filtered + '/' + nFind);
  await chips.first().click();
  await page.fill('[data-el="finding-text"]', 'zzzzzznomatch');
  check('text filter empty state', /No findings match/.test(await page.textContent('[data-el="findings"]')));
  await page.fill('[data-el="finding-text"]', '');
  check('filter cleared', (await page.locator('[data-el="findings"] article').count()) === nFind);
  // downloads
  let [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="download-json"]')]);
  const jsonPath = path.join(OUT, 'report.json'); await dl.saveAs(jsonPath);
  const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  check('JSON download valid', Array.isArray(parsed.findings) && parsed.findings.length === nFind);
  check('JSON report has summary and filters', parsed.summary && parsed.summary.total >= nFind && parsed.filters && Object.keys(parsed.filters).length === 0, JSON.stringify(parsed.summary && parsed.summary.bySeverity));
  [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="download-md"]')]);
  const mdPath = path.join(OUT, 'report.md'); await dl.saveAs(mdPath);
  const mdText = fs.readFileSync(mdPath, 'utf8');
  check('Markdown download', mdText.startsWith('# R Best Practices report'));
  check('Markdown report lists filters and summary', /- Filters: none/.test(mdText) && /- Summary \(all findings before filters\)/.test(mdText));
  // view practice link
  const viewBtn = page.locator('[data-el="findings"] button', { hasText: 'View practice' });
  check('finding -> practice links exist', (await viewBtn.count()) > 0, (await viewBtn.count()) + ' links');
  // workflow override
  await page.selectOption('[data-el="audit-workflow"]', 'shiny');
  await page.click('[data-el="audit-btn"]');
  await page.waitForFunction(() => /Shiny app/.test(document.querySelector('[data-el="findings-summary"]').textContent), null, { timeout: 8000 });
  check('workflow override sent', true);
  await page.selectOption('[data-el="audit-workflow"]', '');
  // error: bad path
  await page.fill('#audit-path', '/definitely/not/here');
  await page.click('[data-el="audit-btn"]');
  await page.waitForFunction(() => !document.querySelector('[data-el="alert"]').classList.contains('hidden'));
  check('bad path shows error', /not found/i.test(await page.textContent('[data-el="alert-text"]')), await page.textContent('[data-el="alert-text"]'));
  await page.click('[data-action="dismiss-alert"]');
  check('alert dismiss', await page.locator('[data-el="alert"]').evaluate((e) => e.classList.contains('hidden')));
  await page.fill('#audit-path', '');
  await page.click('[data-el="audit-btn"]');
  check('empty path validation', /Enter the path/.test(await page.textContent('[data-el="alert-text"]')));
  await page.click('[data-action="dismiss-alert"]');

  // ---- single file
  await page.fill('#file-path', './examples/example-package/R/statistics.R');
  await page.click('[data-el="file-btn"]');
  await page.waitForFunction(() => /^File /.test(document.querySelector('[data-el="findings-summary"]').textContent), null, { timeout: 8000 });
  check('file validation', /statistics\.R/.test(await page.textContent('[data-el="findings-summary"]')), await page.textContent('[data-el="findings-summary"]'));


  // ---- Validate filters (server side)
  await page.click('#tab-validate');
  const filtersDetails = page.locator('[data-el="audit-filters"]');
  check('filters block collapsed by default', !(await filtersDetails.evaluate((d) => d.open)));
  await filtersDetails.locator('summary').click();
  check('filters block expands', await filtersDetails.evaluate((d) => d.open));
  check('min severity select has 5 options', (await page.locator('#filter-min-severity option').count()) === 5, (await page.locator('#filter-min-severity option').allTextContents()).join(' | '));
  check('severity option labels', (await page.locator('#filter-min-severity option').allTextContents()).join('|') === 'All severities|Info and up|Recommended and up|Important and up|Critical only');
  check('8 category checkboxes with labels', (await page.locator('[data-el="filter-categories"] input[type=checkbox]').count()) === 8 && (await page.locator('label[for="filter-cat-testing"]').count()) === 1);
  check('max findings input labelled', (await page.locator('label[for="filter-max"]').count()) === 1 && (await page.getAttribute('#filter-max', 'placeholder')).length > 0);

  await page.fill('#audit-path', './examples/example-package');
  // unfiltered total for comparison
  await page.click('[data-el="audit-btn"]');
  await page.waitForFunction(() => /project .*Showing \d+ of \d+ findings?/.test(document.querySelector('[data-el="findings-summary"]').textContent), null, { timeout: 8000 });
  const sumText = await page.textContent('[data-el="findings-summary"]');
  const totalAll = +sumText.match(/of (\d+) finding/)[1];
  check('summary shows "Showing X of Y findings"', new RegExp('Showing ' + totalAll + ' of ' + totalAll + ' findings?').test(sumText), sumText);

  await page.selectOption('#filter-min-severity', 'important');
  check('filters badge counts active filters', (await page.textContent('[data-el="filters-badge"]')).trim() === '1 active');
  let [req] = await Promise.all([page.waitForRequest((r) => r.url().endsWith('/api/validate-project')), page.click('[data-el="audit-btn"]')]);
  check('minSeverity sent to validate-project', req.postDataJSON().minSeverity === 'important' && !('categories' in req.postDataJSON()) && !('maxFindings' in req.postDataJSON()), req.postData());
  await page.waitForFunction(() => document.querySelector('[data-el="audit-btn-label"]').textContent === 'Run project audit');
  const impText = await page.textContent('[data-el="findings-summary"]');
  const shownImp = +impText.match(/Showing (\d+) of/)[1];
  check('severity filter keeps total, narrows list', shownImp <= totalAll && +impText.match(/of (\d+) finding/)[1] === totalAll, impText);
  const chipTexts = await page.locator('[data-el="severity-chips"] button').allTextContents();
  check('only Critical/Important chips remain', chipTexts.every((t) => /Critical|Important/.test(t)), chipTexts.join(', '));
  check('rendered cards equal shown count', (await page.locator('[data-el="findings"] article').count()) === shownImp);

  await page.selectOption('#filter-min-severity', '');
  await page.check('#filter-cat-structure');
  await page.fill('#filter-max', '1');
  check('filters badge shows 2 active', (await page.textContent('[data-el="filters-badge"]')).trim() === '2 active');
  [req] = await Promise.all([page.waitForRequest((r) => r.url().endsWith('/api/validate-project')), page.click('[data-el="audit-btn"]')]);
  const sent = req.postDataJSON();
  check('categories + maxFindings sent', JSON.stringify(sent.categories) === '["structure"]' && sent.maxFindings === 1 && !('minSeverity' in sent), req.postData());
  await page.waitForFunction(() => /Showing 1 of/.test(document.querySelector('[data-el="findings-summary"]').textContent), null, { timeout: 8000 });
  check('max findings 1 shows exactly one card, total unchanged', (await page.locator('[data-el="findings"] article').count()) === 1 && +(await page.textContent('[data-el="findings-summary"]')).match(/of (\d+) finding/)[1] === totalAll);
  check('hidden-by-filters note in stat', /hidden by filters/.test(await page.textContent('[data-el="stat-audit-sub"]')) || totalAll === 1, await page.textContent('[data-el="stat-audit-sub"]'));

  [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="download-json"]')]);
  const fJsonPath = path.join(OUT, 'report-filtered.json'); await dl.saveAs(fJsonPath);
  const fParsed = JSON.parse(fs.readFileSync(fJsonPath, 'utf8'));
  check('filtered JSON report: filters + summary + 1 finding', fParsed.filters.maxFindings === 1 && fParsed.filters.categories[0] === 'structure' && fParsed.summary.total === totalAll && fParsed.findings.length === 1);
  [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="download-md"]')]);
  const fMdPath = path.join(OUT, 'report-filtered.md'); await dl.saveAs(fMdPath);
  const fMd = fs.readFileSync(fMdPath, 'utf8');
  check('filtered Markdown report lists filters and X shown of Y', /- Filters: categories structure; max 1 findings/.test(fMd) && new RegExp('1 shown of ' + totalAll).test(fMd));

  // single file uses the same filters
  await page.fill('#file-path', './examples/example-package/R/statistics.R');
  [req] = await Promise.all([page.waitForRequest((r) => r.url().endsWith('/api/validate-file')), page.click('[data-el="file-btn"]')]);
  check('filters sent to validate-file', req.postDataJSON().maxFindings === 1 && req.postDataJSON().categories[0] === 'structure', req.postData());
  await page.waitForFunction(() => /^File /.test(document.querySelector('[data-el="findings-summary"]').textContent) && /Showing \d+ of \d+/.test(document.querySelector('[data-el="findings-summary"]').textContent), null, { timeout: 8000 });
  check('file result shows X of Y', true, await page.textContent('[data-el="findings-summary"]'));

  // client-side validation of max findings: no request is sent
  let sentInvalid = false;
  const spy = (r) => { if (/validate-project$/.test(r.url())) sentInvalid = true; };
  page.on('request', spy);
  for (const bad of ['0', '1001']) {
    await page.fill('#filter-max', bad);
    await page.click('[data-el="audit-btn"]');
    check('max findings ' + bad + ' rejected client-side', /Max findings must be a whole number between 1 and 1000/.test(await page.textContent('[data-el="alert-text"]')) && !sentInvalid);
    await page.click('[data-action="dismiss-alert"]');
  }
  page.off('request', spy);

  // server-side rejection (bypassing client validation with a direct call)
  const rej = await page.evaluate(async (base) => {
    const r = await fetch(base + '/api/validate-project', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: '.', minSeverity: 'bogus' }) });
    return { status: r.status, body: await r.json() };
  }, BASE_URL);
  check('server rejects bad minSeverity with 400 INVALID_PARAMETER', rej.status === 400 && rej.body.code === 'INVALID_PARAMETER' && /^minSeverity/.test(rej.body.message), JSON.stringify(rej.body));

  await page.click('[data-action="reset-filters"]');
  check('reset filters clears everything', (await page.inputValue('#filter-min-severity')) === '' && (await page.inputValue('#filter-max')) === '' && (await page.locator('[data-filter-category]:checked').count()) === 0 && (await page.locator('[data-el="filters-badge"]').evaluate((e) => e.classList.contains('hidden'))));
  await filtersDetails.locator('summary').click();

  // ---- Detect
  await page.click('#tab-detect');
  check('detect panel visible', await page.locator('#panel-detect').evaluate((e) => !e.hidden));
  check('validate panel hidden', await page.locator('#panel-validate').evaluate((e) => e.hidden));
  check('path synced across tabs', (await page.inputValue('#detect-path')) === (await page.inputValue('#audit-path')));
  await page.fill('#detect-path', './examples/example-shiny-app');
  await page.click('[data-el="detect-btn"]');
  await page.waitForSelector('[data-el="detect-result"] [role="progressbar"]', { state: 'attached', timeout: 8000 });
  const detectText = await page.textContent('[data-el="detect-result"]');
  check('detect shows shiny + confidence', /Shiny app/.test(detectText) && /\d+%/.test(detectText), detectText.replace(/\s+/g, ' ').slice(0, 120));
  await page.click('text=Validate as Shiny app');
  await page.waitForFunction(() => /Shiny app project/.test(document.querySelector('[data-el="findings-summary"]').textContent), null, { timeout: 8000 });
  check('detect -> validate handoff', await page.locator('#panel-validate').evaluate((e) => !e.hidden));

  // ---- Generate
  await page.click('#tab-generate');
  await page.selectOption('[data-el="gen-workflow"]', 'shiny');
  await page.fill('[data-el="gen-name"]', 'demo-app');
  await page.fill('[data-el="gen-author"]', 'Alexander Seymer');
  await page.click('[data-el="gen-btn"]');
  await page.waitForSelector('[data-el="gen-tree"] [data-file]', { timeout: 8000 });
  const nFiles = await page.locator('[data-el="gen-tree"] [data-file]').count();
  check('template tree', nFiles > 0, nFiles + ' files');
  check('file preview shown', (await page.textContent('[data-el="gen-file-content"]')).length > 0);
  await page.locator('[data-el="gen-tree"] [data-file]').last().click();
  check('select another file', (await page.textContent('[data-el="gen-file-name"]')).length > 0, await page.textContent('[data-el="gen-file-name"]'));
  [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="download-file"]')]);
  check('single file download', !!dl.suggestedFilename(), dl.suggestedFilename());
  [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="download-zip"]')]);
  const zipPath = path.join(OUT, 'demo.zip'); await dl.saveAs(zipPath);
  check('zip filename', dl.suggestedFilename() === 'demo-app.zip', dl.suggestedFilename());

  // ---- Practices (server-side filters)
  const practiceReq = (r) => /\/api\/practices(\?|$)/.test(r.url());
  const cards = () => page.locator('[data-el="practice-list"] details').count();
  const settle = async () => {
    await page.waitForFunction(() => !document.querySelector('[data-el="practice-list"]').hasAttribute('aria-busy'));
    await page.waitForTimeout(60);
  };
  await page.click('#tab-practices');
  await page.waitForSelector('[data-el="practice-list"] details');
  const total = await cards();
  check('all practices rendered', total >= 60, total);
  check('count text shows X of Y', (await page.textContent('[data-el="practice-count"]')) === 'Showing ' + total + ' of ' + total + ' practices');
  const statSub = await page.textContent('[data-el="stat-practices-sub"]');
  const mStat = statSub.match(/^(\d+) automated · (\d+) guidance$/);
  check('stat card "N automated · M guidance"', !!mStat && +mStat[1] + +mStat[2] === total && +mStat[1] > 0 && +mStat[2] > 0, statSub);
  const badgeTexts = await page.locator('[data-el="practice-list"] details summary span').allTextContents();
  const nAuto = badgeTexts.filter((t) => t === 'Automated check').length;
  const nGuid = badgeTexts.filter((t) => t === 'Guidance only').length;
  check('every card has an enforcement badge matching the stat', nAuto === (mStat ? +mStat[1] : -1) && nGuid === (mStat ? +mStat[2] : -1), nAuto + ' / ' + nGuid);
  check('practice severity label + options', (await page.locator('label[for="practice-severity"]').textContent()) === 'Minimum severity' && (await page.locator('#practice-severity option').allTextContents()).join('|') === 'All severities|Info and up|Recommended and up|Important and up|Critical only');
  check('check type select', (await page.locator('label[for="practice-enforcement"]').textContent()) === 'Check type' && (await page.locator('#practice-enforcement option').allTextContents()).join('|') === 'All check types|Automated check|Guidance only');

  // debounce: five quick keystrokes produce one request, with the q parameter
  const typedRequests = [];
  const rec = (r) => { if (practiceReq(r)) typedRequests.push(r.url()); };
  page.on('request', rec);
  await page.click('[data-el="practice-text"]');
  await page.keyboard.type('roxyg', { delay: 40 });
  await page.waitForResponse(practiceReq);
  await settle();
  page.off('request', rec);
  check('typing is debounced into one request using q', typedRequests.length === 1 && /[?&]q=roxyg(&|$)/.test(typedRequests[0]), typedRequests.join(' , '));
  const afterSearch = await cards();
  check('practice search narrows (server side)', afterSearch > 0 && afterSearch < total, afterSearch);
  check('count text after search', (await page.textContent('[data-el="practice-count"]')) === 'Showing ' + afterSearch + ' of ' + total + ' practices');
  await page.click('[data-action="reset-practices"]');
  check('reset restores everything', (await cards()) === total && (await page.inputValue('[data-el="practice-text"]')) === '');

  // stale responses never overwrite newer ones
  const slowQuery = await page.evaluate(async (base) => (await (await fetch(base + '/api/practices?q=roxygen')).json()).data.practices.length, BASE_URL);
  const fastQuery = await page.evaluate(async (base) => (await (await fetch(base + '/api/practices?q=testthat')).json()).data.practices.length, BASE_URL);
  await page.route(/\/api\/practices\?.*q=roxygen/, async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    route.continue().catch(() => {});
  });
  await page.fill('[data-el="practice-text"]', 'roxygen');
  await page.waitForTimeout(450); // debounce fired; slow request is in flight
  await page.fill('[data-el="practice-text"]', 'testthat');
  await page.waitForResponse((r) => /q=testthat/.test(r.url()));
  await settle();
  const afterFast = await cards();
  await page.waitForTimeout(2000); // let the slow response (if not cancelled) arrive
  const afterSlow = await cards();
  check('stale response does not overwrite newer one', afterFast === fastQuery && afterSlow === fastQuery && fastQuery !== slowQuery, 'fast=' + fastQuery + ' slow=' + slowQuery + ' shown=' + afterFast + '/' + afterSlow);
  await page.unroute(/\/api\/practices\?.*q=roxygen/);
  await page.click('[data-action="reset-practices"]');

  // each select calls the server with the right parameter
  let [pr] = await Promise.all([page.waitForRequest(practiceReq), page.selectOption('[data-el="practice-severity"]', 'critical')]);
  await settle();
  const crit = await cards();
  check('minimum severity filter: request + narrower list', /minSeverity=critical/.test(pr.url()) && crit > 0 && crit < total, pr.url() + ' -> ' + crit);
  check('all critical cards show Critical badge', (await page.locator('[data-el="practice-list"] details summary span', { hasText: /^Critical$/ }).count()) === crit);
  [pr] = await Promise.all([page.waitForRequest(practiceReq), page.selectOption('[data-el="practice-workflow"]', 'package')]);
  await settle();
  check('workflow filter combines with severity', /workflow=package/.test(pr.url()) && /minSeverity=critical/.test(pr.url()) && (await cards()) <= crit, pr.url());
  await page.click('[data-action="reset-practices"]');
  [pr] = await Promise.all([page.waitForRequest(practiceReq), page.selectOption('[data-el="practice-category"]', 'testing')]);
  await settle();
  check('category filter', /category=testing/.test(pr.url()) && (await cards()) > 0 && (await cards()) < total);
  await page.click('[data-action="reset-practices"]');

  [pr] = await Promise.all([page.waitForRequest(practiceReq), page.selectOption('[data-el="practice-enforcement"]', 'automated')]);
  await settle();
  const autoCount = await cards();
  const autoBadges = await page.locator('[data-el="practice-list"] details summary span', { hasText: /^Automated check$/ }).count();
  check('check type: automated', /enforcement=automated/.test(pr.url()) && autoCount === (mStat ? +mStat[1] : -1) && autoBadges === autoCount, pr.url() + ' -> ' + autoCount);
  [pr] = await Promise.all([page.waitForRequest(practiceReq), page.selectOption('[data-el="practice-enforcement"]', 'guidance')]);
  await settle();
  const guidCount = await cards();
  check('check type: guidance only', /enforcement=guidance/.test(pr.url()) && guidCount === (mStat ? +mStat[2] : -1) && (await page.locator('[data-el="practice-list"] details summary span', { hasText: /^Guidance only$/ }).count()) === guidCount, pr.url() + ' -> ' + guidCount);
  [pr] = await Promise.all([page.waitForRequest(practiceReq), page.selectOption('[data-el="practice-enforcement"]', '')]);
  await settle();
  check('clearing check type restores list', (await cards()) === total);
  await page.fill('[data-el="practice-text"]', 'zzzzqqqq-nothing');
  await page.waitForResponse(practiceReq);
  await settle();
  check('no-match empty state', /No practices match/.test(await page.textContent('[data-el="practice-list"]')) && /Showing 0 of /.test(await page.textContent('[data-el="practice-count"]')));
  await page.click('[data-action="reset-practices"]');
  check('reset', (await cards()) === total);
  await page.locator('[data-el="practice-list"] summary').first().click();
  check('card expands', await page.locator('[data-el="practice-list"] details').first().evaluate((d) => d.open));
  check('practice list/count regions are aria-live', (await page.getAttribute('[data-el="practice-list"]', 'aria-live')) === 'polite' && (await page.getAttribute('[data-el="practice-count"]', 'aria-live')) === 'polite');

  // ---- deep link via finding
  await page.click('#tab-validate');
  await page.fill('#audit-path', './examples/example-package');
  await page.click('[data-el="audit-btn"]');
  await page.waitForSelector('[data-el="findings"] article');
  const vb = page.locator('[data-el="findings"] button', { hasText: 'View practice' }).first();
  if (await vb.count()) {
    await vb.click();
    await page.waitForFunction(() => document.querySelector('[data-practice-id][open]'));
    check('View practice opens card', await page.locator('#panel-practices').evaluate((e) => !e.hidden));
  }

  // ---- System
  await page.click('#tab-system');
  await page.waitForSelector('[data-el="health-grid"] dd');
  check('health grid', (await page.locator('[data-el="health-grid"] dd').count()) >= 6);
  await page.waitForSelector('[data-el="tools-list"] > div');
  check('tools list', (await page.locator('[data-el="tools-list"] > div').count()) >= 6, await page.locator('[data-el="tools-list"] > div').count());
  const toolsText = await page.textContent('[data-el="tools-list"]');
  check('tools list documents the new filters', /minSeverity/.test(toolsText) && /maxFindings/.test(toolsText) && /enforcement/.test(toolsText));
  check('ops table has rows', (await page.locator('[data-el="ops-body"] tr').count()) > 0);

  // ---- routing
  await page.goto(BASE_URL + '/dashboard#generate');
  check('hash routing', await page.locator('#panel-generate').evaluate((e) => !e.hidden));
  await page.goto(BASE_URL + '/dashboard#practices/rscript-header');
  await page.waitForFunction(() => document.querySelector('[data-practice-id="rscript-header"][open]'), null, { timeout: 8000 }).then(() => check('practice deep link', true), () => check('practice deep link', false));
  // keyboard nav
  await page.focus('#tab-practices');
  await page.keyboard.press('ArrowRight');
  check('arrow-key tab nav', await page.locator('#panel-system').evaluate((e) => !e.hidden));

  await page.screenshot({ path: path.join(OUT, 'shot.png'), fullPage: false });
  check('no JS errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
