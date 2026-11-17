// End-to-end check: every game can be won and lost in both modes; daily results persist and lock.
// Usage: npm run build && npx vite preview --port 4173 &  then  node e2e/play.mjs [baseUrl]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require(path.join(process.env.NODE_PATH || '/usr/local/lib/node_modules', 'playwright')));
}
const root = path.resolve(import.meta.dirname, '..');
const BASE = process.argv[2] || 'http://localhost:4173/';
const json = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const answers = json('src/games/slowko/answers.json');
const meta = json('src/data/countries-meta.json');
const maps = json('src/games/epoka/maps.json');
const depth = json('public/data/depth.json');
const flags = json('src/games/flagi/flags.json');
const byA2 = new Map(flags.map((f) => [f.a2, f.id]));
const eventsSrc = fs.readFileSync(path.join(root, 'src/games/kronika/events.ts'), 'utf8');
const events = [...eventsSrc.matchAll(/^\s*\[(-?\d+), '\w+', '((?:[^'\\]|\\.)*)'/gm)].map((m) => ({ y: +m[1], pl: m[2].replace(/\\'/g, "'") }));
const VERSION = { glebia: 2 };
const konturPool = meta.filter((c) => c.area >= 2000 && c.id !== 'ATA' && c.id !== 'KAS').map((c) => c.id).sort();
const EXCL = new Set(['IMN', 'ALD', 'HKG', 'CUW', 'FLK', 'KAS', 'ATA', 'PSX', 'GRL']);
const globusPool = meta.filter((c) => ['Sovereign country', 'Country', 'Sovereignty', 'Disputed'].includes(c.type) && c.area >= 300 && !EXCL.has(c.id)).map((c) => c.id).sort();
const byId = new Map(meta.map((c) => [c.id, c]));

const results = [];
const check = (name, cond, extra = '') => {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};

const browser = await chromium.launch();
async function fresh() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => check('no page errors', false, e.message));
  await page.goto(BASE);
  await page.evaluate(() => {
    for (const g of ['slowko', 'globus', 'kontur', 'glebia', 'epoka', 'flagi', 'kronika']) localStorage.setItem('gamehub:v1:seen-help:' + g, '1');
  });
  return { ctx, page };
}
const puzzleOf = (page, game, mode) => page.evaluate(([g, m, v]) => JSON.parse(localStorage.getItem(`gamehub:v1:${g}:${m}:v${v}`) || 'null')?.puzzle, [game, mode, VERSION[game] ?? 1]);
const stats = (page, game) => page.evaluate((g) => JSON.parse(localStorage.getItem(`gamehub:v1:${g}:stats`) || 'null'), game);
const ustats = (page, game) => page.evaluate((g) => JSON.parse(localStorage.getItem(`gamehub:v1:${g}:ustats`) || 'null'), game);
const go = async (page, game, mode) => {
  await page.goto(`${BASE}#/${game}${mode === 'unlimited' ? '/unlimited' : ''}`);
  await page.waitForTimeout(900);
};
const resultShown = async (page) => (await page.locator('.result-bar').count()) > 0;
const closeDialog = async (page) => {
  await page.waitForTimeout(400);
  if (await page.locator('dialog[open]').count()) await page.keyboard.press('Escape');
};

/* ---- per-game drivers ---- */
const drivers = {
  async slowko(page, mode, win) {
    const ans = answers[await puzzleOf(page, 'slowko', mode)];
    const wrong = ['kotek', 'mleko', 'droga', 'krowa', 'pieski', 'ławka', 'okręt', 'szafa'].filter((w) => w !== ans && w.length === 5).slice(0, 6);
    const words = win ? [wrong[0], ans] : wrong;
    for (const w of words) {
      for (const ch of w) await page.locator('.sl-kb .sl-key', { hasText: new RegExp(`^${ch}$`) }).click();
      await page.getByRole('button', { name: 'Zatwierdź' }).click();
      await page.waitForTimeout(250);
    }
    return ans;
  },
  async kontur(page, mode, win) {
    const target = konturPool[await puzzleOf(page, 'kontur', mode)];
    const wrongs = ['POL', 'BRA', 'AUS', 'CAN', 'IND', 'EGY', 'JPN'].filter((x) => x !== target).slice(0, 6);
    const list = win ? [wrongs[0], target] : wrongs;
    for (const id of list) {
      await page.locator('.ac input').fill(byId.get(id).pl);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(150);
    }
    return target;
  },
  async globus(page, mode, win) {
    const target = globusPool[await puzzleOf(page, 'globus', mode)];
    const wrong = ['POL', 'BRA'].find((x) => x !== target);
    for (const id of win ? [wrong, target] : [wrong]) {
      await page.locator('.ac input').fill(byId.get(id).pl);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
    }
    if (!win) {
      await page.getByRole('button', { name: /Poddaj się/ }).click();
      await page.getByRole('button', { name: /Poddaj się/ }).first().click();
    }
    return target;
  },
  async epoka(page, mode, win) {
    const m = maps[await puzzleOf(page, 'epoka', mode)];
    const outside = [1, 2, 3, 4, 5, 6].map((k) => (m.from > 50 ? m.from - k : m.to + k));
    const years = win ? [outside[0], m.from + Math.floor((m.to - m.from) / 2)] : outside;
    for (const y of years) {
      await page.locator('.ep-form input').fill(String(y));
      await page.keyboard.press('Enter');
      await page.waitForTimeout(150);
    }
    return `${m.from}-${m.to}`;
  },
  async flagi(page, mode, win) {
    for (let i = 0; i < 10; i++) {
      const src = await page.locator('.fl-flag').getAttribute('src');
      const id = byA2.get(src.match(/flags\/(\w+)\.svg/)[1]);
      if (win) {
        await page.locator('.fl-answer .ac input').fill(byId.get(id).pl);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(i === 9 ? 300 : 1100);
      } else {
        await page.locator('.fl-skip').click();
        await page.waitForTimeout(150);
        if (i < 9) await page.getByRole('button', { name: /Dalej/ }).click();
        await page.waitForTimeout(150);
      }
    }
    return win ? '10/10' : '0/10';
  },
  async kronika(page, mode, win) {
    let last = '';
    for (let i = 0; i < 7; i++) {
      const text = (await page.locator('.kr-card__text').textContent()).trim();
      const e = events.find((x) => x.pl === text);
      if (!e) throw new Error('unknown event ' + text);
      const y = win ? e.y : e.y < 0 || e.y < 500 ? 2020 : 1;
      if (y < 0) await page.locator('.kr-era .seg__btn').nth(1).click();
      await page.locator('.kr-form input').fill(String(Math.abs(y)));
      await page.keyboard.press('Enter');
      await page.waitForTimeout(150);
      last = text;
      if (i < 6) {
        await page.getByRole('button', { name: /Dalej w drogę/ }).click();
        await page.waitForTimeout(150);
      }
    }
    return last.slice(0, 20);
  },
  async glebia(page, mode, win) {
    if (!win) {
      for (const w of ['qqqqzz', 'zzzzqq', 'xqxqxq']) {
        await page.locator('.gl-form input').fill(w);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
      }
      return 'oxygen';
    }
    for (let i = 0; i < 7; i++) {
      const q = (await page.locator('.gl-card__q').textContent()).trim();
      const cat = depth.categories.find((c) => c.prompt.pl === q);
      if (i === 3) {
        await page.locator('.gl-skip').click(); // skipping is allowed
      } else {
        await page.locator('.gl-form input').fill(cat.answers[cat.answers.length - 1 - i].pl);
        await page.keyboard.press('Enter');
      }
      // every answer is followed by the descent animation before the next prompt
      await page.locator('.gl-descent').waitFor({ state: 'attached', timeout: 1000 }).catch(() => {});
      await page.locator('.gl-descent').waitFor({ state: 'detached', timeout: 6000 });
    }
    return 'dive';
  },
};

for (const game of Object.keys(drivers)) {
  for (const outcome of ['win', 'lose']) {
    // DAILY
    {
      const { ctx, page } = await fresh();
      await go(page, game, 'daily');
      const target = await drivers[game](page, 'daily', outcome === 'win');
      await page.waitForTimeout(2200);
      const st = await stats(page, game);
      check(`${game} daily ${outcome}`, (await resultShown(page)) && st?.played === 1 && st.wins === (outcome === 'win' ? 1 : 0), `target=${target} streak=${st?.currentStreak}`);
      await page.waitForTimeout(1500);
      check(`${game} daily ${outcome}: result dialog opens by itself`, (await page.locator('dialog[open] .result').count()) === 1);
      await closeDialog(page);
      await page.reload();
      await page.waitForTimeout(1200);
      const locked = (await resultShown(page)) && (await page.locator('.ac input, .gl-form input, .ep-form input, .kr-form input').count()) === 0;
      const st2 = await stats(page, game);
      check(`${game} daily ${outcome}: persisted + locked after reload, countdown shown`, locked && st2.played === 1 && (await page.locator('.countdown').count()) > 0);
      await ctx.close();
    }
    // UNLIMITED
    {
      const { ctx, page } = await fresh();
      await go(page, game, 'daily');
      const dailyPuzzle = await puzzleOf(page, game, 'daily');
      await go(page, game, 'unlimited');
      const up = await puzzleOf(page, game, 'unlimited');
      check(`${game} unlimited ≠ today's daily`, up !== dailyPuzzle && up != null, `daily=${dailyPuzzle} unlimited=${up}`);
      const ut = await drivers[game](page, 'unlimited', outcome === 'win');
      await page.waitForTimeout(2200);
      const us = await ustats(page, game);
      const st = await stats(page, game);
      check(`${game} unlimited ${outcome} (no effect on daily stats)`, (await resultShown(page)) && us?.played === 1 && us.wins === (outcome === 'win' ? 1 : 0) && (!st || st.played === 0), `target=${ut} ustats=${JSON.stringify(us)} session=${await page.evaluate(([g, v]) => localStorage.getItem(`gamehub:v1:${g}:unlimited:v${v}`), [game, VERSION[game] ?? 1])}`);
      await closeDialog(page);
      await page.getByRole('button', { name: /Następna losowa/ }).first().click();
      await page.waitForTimeout(800);
      const next = await puzzleOf(page, game, 'unlimited');
      check(`${game} unlimited next puzzle`, next !== up && next !== dailyPuzzle && !(await resultShown(page)), `next=${next}`);
      await ctx.close();
    }
  }
}
// ---- extra UX checks ----
{
  const { ctx, page } = await fresh();
  // Słówko: Wordle-style verdict toast, then the stats dialog
  await go(page, 'slowko', 'daily');
  await drivers.slowko(page, 'daily', true);
  await page.waitForTimeout(1900);
  const verdict = await page.locator('.sl-verdict').textContent().catch(() => null);
  check('slowko win: verdict toast', /Wspaniale|Genialnie|Imponująco|Świetnie|Nieźle|Uff/.test(verdict ?? ''), `toast=${verdict}`);
  await page.waitForTimeout(1600);
  check('slowko win: dialog with statistics', (await page.locator('dialog[open] .result--stats-first .stats__grid').count()) === 1);
  // Globus: found country is green
  await go(page, 'globus', 'unlimited');
  const target = await drivers.globus(page, 'unlimited', true);
  await page.waitForTimeout(400);
  const bg = await page.locator('.gb-item.is-hit .gb-swatch').evaluate((el) => getComputedStyle(el).backgroundColor);
  check('globus win: target swatch is green', /rgb\((\d+), (\d+), (\d+)\)/.test(bg) && (() => { const [r, g, b] = bg.match(/\d+/g).map(Number); return g > r && g > b; })(), `bg=${bg} target=${target}`);
  // Epoka: only earlier / later, no distance in years
  await go(page, 'epoka', 'unlimited');
  await page.locator('.ep-form input').fill('1000');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const hint = (await page.locator('.ep-g').first().textContent()) ?? '';
  check('epoka: hint without distance', /wcześniej|później|trafione/.test(hint) && !/lat|gorąco|ciepło|zimno/.test(hint), `hint=${hint}`);
  // theme toggle
  await go(page, 'kronika', 'daily');
  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.locator('.theme-toggle').click();
  const after = await page.evaluate(() => document.documentElement.dataset.theme);
  check('theme toggle switches light/dark', before !== after && ['light', 'dark'].includes(after), `${before} → ${after}`);
  await page.reload();
  await page.waitForTimeout(500);
  check('theme persists after reload', (await page.evaluate(() => document.documentElement.dataset.theme)) === after);
  // Flagi: categories have separate daily rounds
  await go(page, 'flagi', 'daily');
  await page.getByRole('button', { name: /Europa/ }).click();
  await page.waitForTimeout(400);
  const a2 = (await page.locator('.fl-flag').getAttribute('src')).match(/flags\/(\w+)\.svg/)[1];
  check('flagi: Europe category shows a European flag', flags.find((f) => f.a2 === a2)?.cont === 'europe', a2);
  await ctx.close();
}

// ---- Głębia: descent animation runs between prompts ----
{
  const { ctx, page } = await fresh();
  await go(page, 'glebia', 'unlimited');
  const q = (await page.locator('.gl-card__q').textContent()).trim();
  const cat = depth.categories.find((c) => c.prompt.pl === q);
  await page.locator('.gl-form input').fill(cat.answers[cat.answers.length - 1].pl);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const mid = await page.locator('.gl-descent').count();
  const cardHidden = (await page.locator('.gl-card__q').count()) === 0;
  await page.locator('.gl-descent').waitFor({ state: 'detached', timeout: 6000 });
  const nextQ = (await page.locator('.gl-card__q').textContent()).trim();
  check('glebia: descent scene between prompts, then the next prompt', mid === 1 && cardHidden && nextQ !== q, `next=${nextQ}`);
  await ctx.close();
}

// ---- Epoka: every polity is drawn, neighbours differ, names on the map, tap shows a name ----
{
  const { ctx, page } = await fresh();
  await go(page, 'epoka', 'unlimited');
  await page.waitForTimeout(800);
  const n = await page.locator('.ep-land').count();
  const labels = await page.locator('.ep-labels text').count();
  const fills = new Set(await page.locator('.ep-land').evaluateAll((els) => els.map((e) => e.getAttribute('fill'))));
  check('epoka map: polities drawn with several colours and names', n > 40 && fills.size >= 6 && labels >= 5, `polities=${n} colours=${fills.size} labels=${labels}`);
  const target = await page.locator('.ep-land:not(.is-none)').evaluateAll((els) =>
    els
      .map((e) => ({ e, r: e.getBoundingClientRect() }))
      .sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height)
      .map(({ e, r }) => [r.x + r.width / 2, r.y + r.height / 2, e])
      .filter(([x, y, e]) => document.elementFromPoint(x, y) === e)
      .map(([x, y]) => [x, y])[0],
  );
  await page.mouse.click(target[0], target[1]);
  await page.waitForTimeout(200);
  check('epoka map: tapping a polity shows its name', (await page.locator('.ep-pick').count()) === 1, await page.locator('.ep-pick').textContent().catch(() => ''));
  await ctx.close();
}

// ---- Sync between two devices through a (mocked) GitHub repository ----
{
  let file = null;
  let n = 0;
  const route = async (r) => {
    const req = r.request();
    const url = new URL(req.url());
    const json = (status, body) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,PUT' } });
    if (req.headers().authorization !== 'Bearer test-token') return json(401, {});
    if (url.pathname === '/repos/gracz/gry-dane') return json(200, {});
    if (url.pathname === '/repos/gracz/gry-dane/contents/gamehub-dane.json') {
      if (req.method() === 'PUT') {
        const body = JSON.parse(req.postData());
        if ((file?.sha ?? undefined) !== body.sha) return json(409, {});
        file = { sha: 's' + ++n, content: body.content };
        return json(200, { content: { sha: file.sha } });
      }
      return file ? json(200, { sha: file.sha, encoding: 'base64', content: file.content }) : json(404, {});
    }
    return json(404, {});
  };
  const device = async () => {
    const d = await fresh();
    await d.ctx.route('https://api.github.com/**', route);
    return d;
  };
  const connect = async (page, token = 'test-token') => {
    await page.goto(BASE + '#/');
    await page.waitForTimeout(400);
    await page.locator('.settings-btn').click();
    await page.locator('.sync__head').click();
    await page.locator('.sync__form input').first().fill('gracz/gry-dane');
    await page.locator('.sync__form input[type=password]').fill(token);
    await page.getByRole('button', { name: /Połącz i synchronizuj/ }).click();
    await page.waitForTimeout(1200);
    return (await page.locator('.sync__msg').textContent()) ?? '';
  };
  const A = await device();
  const badToken = await connect(A.page, 'zly-token');
  check('sync: wrong token is reported', /Token/.test(badToken), badToken);
  await A.page.getByRole('button', { name: /Rozłącz/ }).click();
  await A.page.keyboard.press('Escape');
  await go(A.page, 'slowko', 'daily');
  await drivers.slowko(A.page, 'daily', true);
  await A.page.waitForTimeout(2500);
  const msgA = await connect(A.page);
  check('sync: device A uploads', /Zsynchronizowano/.test(msgA) && file != null, msgA);

  const B = await device();
  await go(B.page, 'kronika', 'daily');
  await drivers.kronika(B.page, 'daily', true);
  await B.page.waitForTimeout(1500);
  const msgB = await connect(B.page);
  await B.page.keyboard.press('Escape');
  await B.page.waitForTimeout(500);
  const stB = await stats(B.page, 'slowko');
  const hubB = await B.page.locator('.card--slowko .card__status').textContent();
  check('sync: device B gets the Słówko result from A', /Zsynchronizowano/.test(msgB) && stB?.played === 1 && /Ukończone/.test(hubB), `${msgB} hub=${hubB}`);
  await go(B.page, 'slowko', 'daily');
  check('sync: B shows today’s Słówko as finished (locked)', (await resultShown(B.page)) && (await B.page.locator('.sl-tile.is-correct').count()) >= 5);

  // A picks up B's Kronika result
  await A.page.keyboard.press('Escape');
  await A.page.goto(BASE + '#/');
  await A.page.waitForTimeout(300);
  await A.page.locator('.settings-btn').click();
  await A.page.locator('.sync__head').click();
  await A.page.getByRole('button', { name: /Synchronizuj teraz/ }).click();
  await A.page.waitForTimeout(1200);
  await A.page.keyboard.press('Escape');
  await A.page.waitForTimeout(300);
  const stA = await stats(A.page, 'kronika');
  check('sync: device A gets the Kronika result from B', stA?.played === 1 && stA.wins === 1);
  const snap = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
  check('sync: the file never contains the token', !JSON.stringify(snap).includes('test-token') && snap.app === 'gamehub-sync');
  await A.ctx.close();
  await B.ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
