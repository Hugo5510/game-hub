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
    for (const g of ['slowko', 'globus', 'kontur', 'glebia', 'epoka']) localStorage.setItem('gamehub:v1:seen-help:' + g, '1');
  });
  return { ctx, page };
}
const puzzleOf = (page, game, mode) => page.evaluate(([g, m]) => JSON.parse(localStorage.getItem(`gamehub:v1:${g}:${m}:v1`) || 'null')?.puzzle, [game, mode]);
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
      await page.waitForTimeout(200);
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
      await closeDialog(page);
      await page.reload();
      await page.waitForTimeout(1200);
      const locked = (await resultShown(page)) && (await page.locator('.ac input, .gl-form input, .ep-form input').count()) === 0;
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
      check(`${game} unlimited ${outcome} (no effect on daily stats)`, (await resultShown(page)) && us?.played === 1 && us.wins === (outcome === 'win' ? 1 : 0) && (!st || st.played === 0), `target=${ut} ustats=${JSON.stringify(us)} session=${await page.evaluate((g) => localStorage.getItem(`gamehub:v1:${g}:unlimited:v1`), game)}`);
      await closeDialog(page);
      await page.getByRole('button', { name: /Następna losowa/ }).first().click();
      await page.waitForTimeout(800);
      const next = await puzzleOf(page, game, 'unlimited');
      check(`${game} unlimited next puzzle`, next !== up && next !== dailyPuzzle && !(await resultShown(page)), `next=${next}`);
      await ctx.close();
    }
  }
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
