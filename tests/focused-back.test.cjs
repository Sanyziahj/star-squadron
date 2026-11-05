const { chromium } = require('playwright-core');
const fs = require('fs');
const URL = process.argv[2] || 'file:///workspace/index.html';
const D = process.argv[3] || '/opt/cursor/artifacts/';
fs.mkdirSync(D, { recursive: true });
const R = [];
const ok = (n, c, d) => { R.push((c ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' ' + JSON.stringify(d) : '')); };
const CHROME = ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];

function overlap(a, b) {
  if (!a || !b) return null;
  const ix = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const iy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return ix > 0.5 && iy > 0.5;
}

(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: CHROME });
  const errs = [];

  async function phone(w, h) {
    const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
    await p.addInitScript(() => { window.__SS_DEBUG = true; });
    p.on('pageerror', e => errs.push(w + 'x' + h + ' ' + e.message));
    p.on('console', x => { if (x.type() === 'error') errs.push(w + 'x' + h + ' ' + x.text()); });
    await p.goto(URL);
    await p.waitForSelector('.srml-bk');
    await p.waitForTimeout(250);
    await p.evaluate(() => {
      window.__fireDowns = 0;
      window.__backDowns = 0;
      document.querySelector('[data-b=fire]').addEventListener('pointerdown', () => { window.__fireDowns++; });
      document.getElementById('sr-back').addEventListener('pointerdown', () => { window.__backDowns++; });
    });
    return p;
  }

  const snap = p => p.evaluate(() => ({
    state: __SS.G.state, paused: !!__SS.G.paused, stage: __SS.G.stage,
    ship: __SS.G.ship, pilot: __SS.G.pilot, score: __SS.P.score, lives: __SS.P.lives,
    x: +__SS.P.x.toFixed(2), bolts: __SS.bolts.length, kills: __SS.G.kills,
    prize: document.getElementById('prize').hidden,
    back: (document.querySelector('.srml-bk') || {}).textContent || '',
    start: (document.querySelector('.srml-st') || {}).textContent || '',
    srs: document.documentElement.dataset.srs || '',
    fireDowns: window.__fireDowns, backDowns: window.__backDowns,
    roll: __SS.P.roll
  }));

  async function tap(p, sel) {
    await p.locator(sel).first().tap();
  }
  async function goTitle(p) {
    await p.evaluate(() => { __SS.G.state = 'title'; __SS.G.st = 1; __SS.G.paused = false; __SS.bolts.length = 0; __SS.P.score = __SS.P.score || 0; });
    await p.waitForFunction(() => document.querySelector('.srml-st') && document.querySelector('.srml-st').textContent === 'START' && __SS.G.state === 'title');
  }
  async function toIntro(p) {
    await goTitle(p);
    await tap(p, '[data-b=start]');
    await p.waitForFunction(() => __SS.G.state === 'intro');
  }
  async function toPlay(p) {
    await toIntro(p);
    await tap(p, '[data-srml=ok]');
    await p.waitForFunction(() => __SS.G.state === 'play' && !__SS.G.paused);
    await p.evaluate(() => { __SS.god(); __SS.bolts.length = 0; __SS.P.fireCd = 0; __SS.P.score = 77; });
    await p.waitForFunction(() => document.querySelector('.srml-bk').textContent === 'BACK');
  }

  // ---------- portrait ----------
  const p = await phone(390, 844);
  ok('preserves __SR_GAME poster and social tags', await p.evaluate(() => window.__SR_GAME === 'SSQ' && String(window.__POSTER_SRC || '').startsWith('data:image/jpeg') && document.querySelector('meta[property="og:title"]').content.includes('Star Squadron') && document.querySelector('meta[name="twitter:card"]').content === 'summary_large_image'));
  ok('coarse pointer shows labeled BACK (not a fire alias)', await p.evaluate(() => {
    const bk = document.querySelector('.srml-bk');
    const map = window.__SRML || {};
    return matchMedia('(pointer:coarse)').matches && bk && bk.textContent === 'BACK' && map.back === 'back' && map.ok === 'start' && map.back !== 'fire';
  }));

  const pb = await p.locator('.srml-bk').boundingBox();
  const sb = await p.locator('[data-b=start]').boundingBox();
  const fb = await p.locator('[data-b=fire]').boundingBox();
  ok('portrait BACK is a large labeled target', pb && pb.width >= 80 && pb.height >= 48 && pb.height <= 64, pb);
  ok('portrait START/FIRE stay large', sb && sb.height >= 48 && fb && fb.width >= 60 && fb.height >= 48, { sb, fb });
  await p.screenshot({ path: D + 'phone_390x844_title_back.png' });

  // press glow while the finger is down, still on the title
  {
    const cdp = await p.context().newCDPSession(p);
    const x = pb.x + pb.width / 2, y = pb.y + pb.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await p.waitForTimeout(120);
    const glow = await p.evaluate(() => {
      const el = document.querySelector('.srml-bk');
      const cs = getComputedStyle(el);
      return { on: el.classList.contains('on'), transform: cs.transform, shadow: cs.boxShadow, text: el.textContent };
    });
    await p.screenshot({ path: D + 'phone_390x844_back_glow.png' });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const grew = glow.on && glow.transform && glow.transform !== 'none' && /matrix\(1\.1/.test(glow.transform) && glow.shadow && glow.shadow !== 'none';
    ok('BACK press grows and glows', grew, glow);
    await p.waitForTimeout(80);
    const after = await snap(p);
    ok('title BACK does not launch or fire', after.state === 'title' && after.bolts === 0 && after.fireDowns === 0 && after.backDowns === 1, after);
  }

  // cancel a swapped ship, stay on the title
  {
    await goTitle(p);
    await p.evaluate(() => { __SS.G.pilot = 0; __SS.G.ship = 1; window.__fireDowns = 0; });
    const before = await snap(p);
    await tap(p, '.srml-bk');
    await p.waitForTimeout(120);
    const after = await snap(p);
    ok('title BACK cancels ship swap and stays on title', before.ship === 1 && after.state === 'title' && after.ship === 0 && after.pilot === 0 && after.bolts === 0 && after.fireDowns === 0, { before, after });
  }

  // fresh stage-1 briefing is the instruction overlay; BACK returns to title and does not start play
  {
    await p.evaluate(() => { window.__fireDowns = 0; __SS.G.ship = 1; });
    await toIntro(p);
    const mid = await snap(p);
    await tap(p, '.srml-bk');
    await p.waitForTimeout(80);
    const soon = await snap(p);
    // 250ms screen-change guard: a second tap must not also act on the title
    await tap(p, '.srml-bk');
    await p.waitForTimeout(40);
    const guarded = await snap(p);
    await p.waitForTimeout(350);
    await tap(p, '.srml-bk');
    await p.waitForTimeout(80);
    const later = await snap(p);
    ok('stage1 intro/howto BACK returns to title without firing or starting', mid.state === 'intro' && soon.state === 'title' && soon.bolts === 0 && soon.fireDowns === 0 && soon.paused === false, { mid, soon });
    ok('250ms transition guard blocks carryover onto the title', soon.ship === 1 && guarded.state === 'title' && guarded.ship === 1 && guarded.bolts === 0, { soon, guarded });
    ok('after the guard, title BACK still cancels the swap', later.state === 'title' && later.ship === 0 && later.bolts === 0, later);
    await p.waitForTimeout(400);
    const stayed = await snap(p);
    ok('BACK does not carry into a launch', stayed.state === 'title' && stayed.bolts === 0, stayed);
  }

  // later-stage briefing keeps the run
  {
    await toIntro(p);
    await p.evaluate(() => { __SS.G.stage = 1; __SS.P.score = 50; __SS.G.kills = 2; });
    await tap(p, '.srml-bk');
    await p.waitForTimeout(200);
    const s = await snap(p);
    ok('in-progress briefing BACK does not skip, restart, or discard', s.state === 'intro' && s.score === 50 && s.stage === 1 && s.bolts === 0 && s.paused === false, s);
  }

  // OK still skips intro and does not pause it. START/P still pause only once play has begun.
  {
    await toIntro(p);
    const before = await snap(p);
    await tap(p, '[data-srml=ok]');
    await p.waitForFunction(() => __SS.G.state === 'play');
    const s = await snap(p);
    ok('OK skips stage intro and does not pause it', before.state === 'intro' && before.paused === false && s.state === 'play' && s.paused === false, { before, s });
  }
  {
    await toPlay(p);
    await p.evaluate(() => { __SS.bolts.length = 0; window.__fireDowns = 0; });
    await tap(p, '[data-b=start]');
    await p.waitForFunction(() => __SS.G.paused === true && document.querySelector('.srml-st').textContent === 'RESUME');
    const paused = await snap(p);
    await tap(p, '[data-b=start]');
    await p.waitForFunction(() => __SS.G.paused === false);
    await p.keyboard.press('KeyP');
    const byP = await snap(p);
    await p.keyboard.press('KeyP');
    const resumed = await snap(p);
    ok('START pauses play without firing, RESUME is labeled', paused.paused === true && paused.state === 'play' && paused.bolts === 0 && paused.score === 77 && paused.start === 'RESUME' && paused.back === 'RESUME' && paused.fireDowns === 0, paused);
    ok('P pauses and resumes play', byP.paused === true && byP.state === 'play' && resumed.paused === false && resumed.score === 77, { byP, resumed });
  }

  // active play: pointer BACK pauses, does not fire, does not reset
  {
    await toPlay(p);
    await p.evaluate(() => { __SS.bolts.length = 0; __SS.P.fireCd = 0; window.__fireDowns = 0; const n = window.__backDowns; window.__backMark = n; });
    const before = await snap(p);
    await tap(p, '.srml-bk');
    await p.waitForFunction(() => __SS.G.paused === true && document.querySelector('.srml-bk').textContent === 'RESUME' && document.querySelector('.srml-st').textContent === 'RESUME');
    const paused = await snap(p);
    await p.screenshot({ path: D + 'phone_390x844_paused_resume.png' });
    ok('play BACK pauses and creates no bolt', before.state === 'play' && before.paused === false && before.bolts === 0 && paused.state === 'play' && paused.paused === true && paused.bolts === 0 && paused.score === 77 && paused.stage === 0 && paused.lives === before.lives && paused.fireDowns === 0 && paused.backDowns === before.backDowns + 1, { before, paused });
    ok('paused BACK/START read RESUME', paused.back === 'RESUME' && paused.start === 'RESUME' && paused.srs === 'play:paused', paused);
    // canvas tap still resumes
    const box = await p.locator('#game').boundingBox();
    await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await p.waitForFunction(() => __SS.G.paused === false);
    const resumed = await snap(p);
    ok('canvas tap still resumes', resumed.paused === false && resumed.state === 'play' && resumed.bolts === 0 && resumed.score === 77, resumed);
  }

  // held BACK is one pause; fast taps toggle without leaving or firing
  {
    await toPlay(p);
    await p.evaluate(() => { __SS.bolts.length = 0; window.__fireDowns = 0; });
    const box = await p.locator('.srml-bk').boundingBox();
    const cdp = await p.context().newCDPSession(p);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await p.waitForTimeout(200);
    const mid = await snap(p);
    await p.waitForTimeout(500);
    const held = await snap(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(80);
    const up = await snap(p);
    ok('held BACK pauses once and does not fire or leave', mid.paused === true && held.paused === true && held.state === 'play' && held.bolts === 0 && held.score === 77 && held.fireDowns === 0 && up.paused === true && up.state === 'play', { mid, held, up });
    // release landed on pause. fast taps at ~120ms must each register (5 -> playing, because we start paused: odd count ends paused... start paused, 4 taps -> paused)
    for (let i = 0; i < 4; i++) { await tap(p, '.srml-bk'); await p.waitForTimeout(120); }
    const fast = await snap(p);
    ok('fast BACK taps stay in play, keep score, fire nothing', fast.state === 'play' && fast.score === 77 && fast.bolts === 0 && fast.fireDowns === 0 && fast.stage === 0, fast);
    ok('fast taps are not dropped (4 toggles from paused ends paused)', fast.paused === true, fast);
  }

  // held fire key stops producing bolts once BACK pauses; arrows stop moving the ship
  {
    await toPlay(p);
    await p.evaluate(() => { __SS.bolts.length = 0; __SS.P.fireCd = 0; __SS.P.x = 0; });
    await p.keyboard.down('Space');
    await p.keyboard.down('ArrowRight');
    await p.waitForTimeout(280);
    await tap(p, '.srml-bk');
    await p.waitForFunction(() => __SS.G.paused === true);
    await p.waitForTimeout(60);
    const a = await snap(p);
    await p.waitForTimeout(320);
    const b2 = await snap(p);
    await p.keyboard.up('Space');
    await p.keyboard.up('ArrowRight');
    ok('after BACK, held fire and steer freeze', a.paused && b2.paused && a.state === 'play' && b2.bolts === a.bolts && a.bolts >= 1 && b2.x === a.x && b2.score === 77, { a, b2 });
    await tap(p, '[data-b=start]');
    await p.waitForFunction(() => !__SS.G.paused);
  }

  // FIRE / ROLL / MISSILE still work
  {
    await p.evaluate(() => { __SS.bolts.length = 0; __SS.P.fireCd = 0; __SS.P.roll = 0; });
    const box = await p.locator('[data-b=fire]').boundingBox();
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 2 }] });
    await p.waitForTimeout(260);
    const bolts = await p.evaluate(() => __SS.bolts.length);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    ok('FIRE hold still autofires', bolts >= 2, bolts);
    await tap(p, '[data-b=roll]');
    await p.waitForTimeout(40);
    const rolled = await p.evaluate(() => __SS.P.roll > 0);
    ok('ROLL still rolls', rolled);
    await p.evaluate(() => { const o = __SS.spawn('raider', 12, 4, 240); o.vz = 0; o.t = 1; __SS.P.msl = 3; });
    await p.waitForTimeout(40);
    await tap(p, '[data-b=missile]');
    await p.waitForTimeout(40);
    ok('MISSILE still locks', await p.evaluate(() => __SS.missiles.length === 1 && !!__SS.missiles[0].tgt));
  }

  // clear / victory are not skipped and the run is not discarded
  {
    await p.evaluate(() => { __SS.G.state = 'clear'; __SS.G.st = 2; __SS.G.stage = 0; __SS.P.score = 77; __SS.bolts.length = 0; __SS.G.paused = false; });
    await p.waitForTimeout(80);
    await tap(p, '.srml-bk');
    await p.waitForTimeout(150);
    const c = await snap(p);
    ok('stage clear BACK does not skip or restart', c.state === 'clear' && c.score === 77 && c.stage === 0 && c.bolts === 0, c);
    await p.evaluate(() => { __SS.G.state = 'victory'; __SS.G.st = 3; __SS.P.score = 77; __SS.bolts.length = 0; });
    await tap(p, '.srml-bk');
    await p.waitForTimeout(150);
    const v = await snap(p);
    ok('victory BACK does not open the poster or restart', v.state === 'victory' && v.score === 77 && v.bolts === 0 && v.prize === true, v);
  }

  // game over: BACK returns to title and does not retry; FIRE still retries
  {
    await p.evaluate(() => { __SS.G.state = 'over'; __SS.G.st = 2; __SS.G.cont = 8; __SS.G.stage = 0; __SS.P.score = 100; __SS.bolts.length = 0; __SS.G.paused = false; });
    await tap(p, '.srml-bk');
    await p.waitForFunction(() => __SS.G.state === 'title');
    const t = await snap(p);
    ok('game over BACK returns to title without retry', t.state === 'title' && t.score === 100 && t.bolts === 0, t);
    await p.evaluate(() => { __SS.G.state = 'over'; __SS.G.st = 2; __SS.G.cont = 8; __SS.G.stage = 0; __SS.P.score = 100; __SS.bolts.length = 0; });
    await tap(p, '[data-b=fire]');
    await p.waitForFunction(() => __SS.G.state === 'intro' || __SS.G.state === 'play');
    const retry = await snap(p);
    ok('FIRE still retries from game over', (retry.state === 'intro' || retry.state === 'play') && retry.score === 0, retry);
  }

  // poster overlay closes back to the title and does not auto-start
  {
    await p.evaluate(() => { __SS.G.state = 'poster'; __SS.G.st = 1; document.getElementById('prize').hidden = false; __SS.bolts.length = 0; __SS.P.score = 500; });
    // Previous BACK armed the 250ms screen-change guard. This tap is a new
    // intentional press, so wait out that guard before asserting it closes.
    await p.waitForTimeout(320);
    const hit = await p.evaluate(() => {
      const b = document.querySelector('.srml-bk').getBoundingClientRect();
      const el = document.elementFromPoint(b.x + b.width / 2, b.y + 8);
      return !!(el && el.closest && el.closest('.srml-bk'));
    });
    ok('BACK stays tappable over the poster', hit, hit);
    await tap(p, '.srml-bk');
    await p.waitForFunction(() => __SS.G.state === 'title' && document.getElementById('prize').hidden);
    await p.waitForTimeout(350);
    const s = await snap(p);
    ok('poster BACK closes the overlay and returns to title', s.state === 'title' && s.prize === true && s.bolts === 0 && s.score === 500, s);
  }

  // layout
  {
    const lay = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight }));
    const game = await p.locator('#game').boundingBox();
    const stick = await p.locator('#stick').boundingBox();
    const back = await p.locator('.srml-bk').boundingBox();
    const fire = await p.locator('[data-b=fire]').boundingBox();
    const start = await p.locator('[data-b=start]').boundingBox();
    ok('portrait no horizontal overflow', lay.sw <= lay.iw + 1, lay);
    ok('portrait controls do not cover the canvas', !overlap(game, stick) && !overlap(game, back) && !overlap(game, fire) && !overlap(game, start), { game, stick, back, fire, start });
  }

  // ---------- landscape ----------
  const L = await phone(844, 390);
  await L.screenshot({ path: D + 'phone_844x390_title_back.png' });
  const lb = await L.locator('.srml-bk').boundingBox();
  ok('landscape BACK is the side control (~136x42)', lb && lb.width >= 120 && lb.width <= 150 && lb.height >= 40 && lb.height <= 48, lb);
  ok('landscape BACK label is BACK', (await snap(L)).back === 'BACK');
  await L.evaluate(() => { window.__fireDowns = 0; __SS.bolts.length = 0; });
  await tap(L, '.srml-bk');
  await L.waitForTimeout(150);
  const lt = await snap(L);
  ok('landscape title BACK does not fire', lt.state === 'title' && lt.bolts === 0 && lt.fireDowns === 0, lt);
  await toPlay(L);
  await L.evaluate(() => { __SS.bolts.length = 0; __SS.P.score = 77; window.__fireDowns = 0; });
  await tap(L, '.srml-bk');
  await L.waitForFunction(() => __SS.G.paused === true && document.querySelector('.srml-bk').textContent === 'RESUME');
  const lp = await snap(L);
  await L.screenshot({ path: D + 'phone_844x390_paused_resume.png' });
  ok('landscape play BACK pauses with no bolt', lp.state === 'play' && lp.paused === true && lp.bolts === 0 && lp.score === 77 && lp.fireDowns === 0 && lp.back === 'RESUME', lp);
  const lay = await L.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  const game = await L.locator('#game').boundingBox();
  const stick = await L.locator('#stick').boundingBox();
  const back = await L.locator('.srml-bk').boundingBox();
  const fire = await L.locator('[data-b=fire]').boundingBox();
  const okb = await L.locator('[data-srml=ok]').boundingBox();
  ok('landscape no horizontal overflow', lay.sw <= lay.iw + 1, lay);
  ok('landscape controls do not cover the canvas', !overlap(game, stick) && !overlap(game, back) && !overlap(game, fire) && !overlap(game, okb), { game, stick, back, fire, okb });

  // ---------- desktop ----------
  const d = await b.newPage({ viewport: { width: 1152, height: 900 }, hasTouch: false, isMobile: false });
  await d.addInitScript(() => { window.__SS_DEBUG = true; });
  d.on('pageerror', e => errs.push('desk ' + e.message));
  await d.goto(URL);
  await d.waitForTimeout(400);
  const desk = await d.evaluate(() => ({
    srml: document.documentElement.classList.contains('srml'),
    back: document.querySelectorAll('.srml-bk').length,
    coarse: matchMedia('(pointer:coarse)').matches,
    sw: document.documentElement.scrollWidth, iw: innerWidth
  }));
  ok('desktop has no phone BACK layer', desk.srml === false && desk.back === 0 && desk.coarse === false, desk);
  ok('desktop no horizontal overflow', desk.sw <= desk.iw + 1, desk);
  await d.screenshot({ path: D + 'desktop_title.png' });
  await d.keyboard.press('Enter');
  await d.waitForFunction(() => __SS.G.state === 'intro');
  await d.keyboard.press('KeyP');
  await d.waitForTimeout(80);
  const introP = await d.evaluate(() => ({ state: __SS.G.state, paused: __SS.G.paused }));
  ok('P does not pause the intro', introP.state === 'intro' && introP.paused === false, introP);
  await d.keyboard.press('Enter');
  await d.waitForFunction(() => __SS.G.state === 'play');
  await d.evaluate(() => { __SS.god(); __SS.bolts.length = 0; __SS.P.fireCd = 0; __SS.P.score = 41; });
  await d.keyboard.down('Space');
  await d.waitForTimeout(80);
  await d.keyboard.up('Space');
  await d.waitForTimeout(30);
  const fired = await d.evaluate(() => __SS.bolts.length);
  ok('desktop Space still fires', fired >= 1, fired);
  await d.keyboard.press('KeyP');
  await d.waitForTimeout(60);
  const paused = await d.evaluate(() => ({ state: __SS.G.state, paused: __SS.G.paused, score: __SS.P.score }));
  await d.screenshot({ path: D + 'desktop_paused.png' });
  await d.keyboard.press('Enter');
  await d.waitForTimeout(60);
  const resumed = await d.evaluate(() => ({ state: __SS.G.state, paused: __SS.G.paused, score: __SS.P.score }));
  ok('desktop P pauses and Enter resumes without resetting', paused.paused === true && paused.state === 'play' && resumed.paused === false && resumed.score === 41, { paused, resumed });

  // ---------- calibrated 4x stage-1 moving + firing rAF ----------
  {
    await p.bringToFront();
    await toPlay(p);
    await p.evaluate(() => { __SS.god(); __SS.clear(); __SS.P.fireCd = 0; __SS.bolts.length = 0; });
    await p.evaluate(() => {
      window.__raf = [];
      let last = 0;
      const loop = (t) => { if (last) window.__raf.push(t - last); last = t; requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    });
    // calibration window: title is not the load we care about; warm the play loop first
    await p.keyboard.down('ArrowRight');
    await p.keyboard.down('Space');
    await p.waitForTimeout(400);
    await p.evaluate(() => { window.__raf = []; });
    const windows = [];
    for (let i = 0; i < 4; i++) {
      await p.evaluate(() => { window.__rafMark = window.__raf.length; });
      if (i % 2) { await p.keyboard.up('ArrowRight'); await p.keyboard.down('ArrowLeft'); }
      else { await p.keyboard.up('ArrowLeft'); await p.keyboard.down('ArrowRight'); }
      await p.waitForTimeout(1500);
      const w = await p.evaluate(() => window.__raf.slice(window.__rafMark));
      windows.push(w);
    }
    await p.keyboard.up('ArrowRight');
    await p.keyboard.up('ArrowLeft');
    await p.keyboard.up('Space');
    const all = windows.flat().filter(x => x > 0 && x < 200);
    const sorted = all.slice().sort((a, c) => a - c);
    const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 999;
    const over = all.filter(x => x > 25).length;
    const pct = all.length ? over / all.length : 1;
    const per = windows.map(w => {
      const s = w.filter(x => x > 0 && x < 200).slice().sort((a, c) => a - c);
      const q = s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] : 999;
      const o = s.filter(x => x > 25).length;
      return { n: s.length, p95: +q.toFixed(2), overPct: s.length ? +(o / s.length).toFixed(3) : 1 };
    });
    ok('stage1 moving+firing rAF p95 <= 20ms (4 windows)', p95 <= 20, { p95: +p95.toFixed(2), n: all.length, per });
    ok('stage1 moving+firing frames >25ms <= 5%', pct <= 0.05, { pct: +pct.toFixed(4), over, n: all.length, per });
    fs.writeFileSync(D + 'raf-stage1.json', JSON.stringify({ p95, pct, over, n: all.length, per }, null, 2));
  }

  ok('no page errors', errs.length === 0, errs);
  const pass = R.filter(x => x.startsWith('PASS')).length;
  const fail = R.filter(x => x.startsWith('FAIL')).length;
  console.log(R.join('\n'));
  console.log('FOCUSED ' + pass + ' passed ' + fail + ' failed');
  await b.close();
  if (fail) process.exit(1);
})().catch(e => { console.log(R.join('\n')); console.error('CRASH', e); process.exit(1); });
