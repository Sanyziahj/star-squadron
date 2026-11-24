// Tests for the 2026-11-24 upgrade: phone AUTO-FIRE toggle + phone layout. Usage: node autofire-layout.test.cjs [URL] [mobile]
const { chromium } = require('playwright-core');
const URL = process.argv[2] || 'file:///workspace/ssq-wip/index.html', MOB = process.argv[3] === 'mobile';
const R = []; const ok = (n, c, d) => R.push((c ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' ' + JSON.stringify(d) : ''));
const ov = (a, b) => a && b && a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const errs = []; const watch = (p, t) => { p.on('pageerror', e => errs.push(t + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(t + ' console: ' + m.text()); }); };
  const toPlay = async (p) => { await p.evaluate(() => { __SS.god(); }); await p.tap('[data-b=start]'); await p.waitForTimeout(250); await p.evaluate(() => { __SS.G.st = 2.59; }); for (let i = 0; i < 30 && !(await p.evaluate(() => __SS.G.state === 'play')); i++) await p.waitForTimeout(50); };
  if (!MOB) { // ---- desktop: unchanged ----
    const p = await b.newPage({ viewport: { width: 1152, height: 900 } }); await p.addInitScript(() => { window.__SS_DEBUG = true; localStorage.clear(); });
    watch(p, 'd'); await p.goto(URL); await p.waitForTimeout(700);
    ok('desktop: no AUTO button / mobile layer', await p.evaluate(() => !document.getElementById('ssq-auto') && !document.documentElement.classList.contains('srml') && window.__SSAF === undefined));
    await p.keyboard.press('Enter'); await p.waitForTimeout(200); await p.evaluate(() => { __SS.god(); __SS.G.st = 2.59; }); await p.waitForTimeout(300);
    await p.evaluate(() => { __SS.clear(); __SS.bolts.length = 0; __SS.P.fireCd = 0; }); await p.waitForTimeout(500);
    ok('desktop: no fire without a key (no auto-fire)', await p.evaluate(() => __SS.G.state === 'play' && __SS.bolts.length === 0), await p.evaluate(() => [__SS.G.state, __SS.bolts.length]));
    await p.keyboard.down('Space'); await p.waitForTimeout(300); const n = await p.evaluate(() => __SS.bolts.length); await p.keyboard.up('Space');
    ok('desktop: holding Space still fires', n >= 2, n);
    ok('desktop: help line + pad intact', await p.evaluate(() => getComputedStyle(document.getElementById('help')).display !== 'none' && getComputedStyle(document.getElementById('pad')).display !== 'none'));
    await p.close();
  }
  for (const [w, h, tag] of [[390, 844, 'upright'], [375, 667, 'upright'], [844, 390, 'sideways'], [667, 375, 'sideways']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
    const m = await ctx.newPage(); await m.addInitScript(() => { window.__SS_DEBUG = true; });
    watch(m, tag + w);
    await m.goto(URL); await m.evaluate(() => localStorage.removeItem('ssq-autofire')); await m.reload(); await m.waitForTimeout(700);
    const T = tag + ' ' + w + 'x' + h + ': ';
    { const pre = await m.evaluate(() => { const e = document.querySelector('[data-b=start]'); e.classList.add('on'); return null; }); await m.waitForTimeout(150);
      const g = await m.evaluate(() => { const c = getComputedStyle(document.querySelector('[data-b=start]')); return [c.transform, c.boxShadow]; });
      await m.evaluate(() => document.querySelector('[data-b=start]').classList.remove('on'));
      ok(T + 'selected/pressed menu button glows and grows', /matrix\(1\.1/.test(g[0]) && g[1] !== 'none', g); }
    ok(T + 'AUTO defaults ON for touch', await m.evaluate(() => window.__SSAF === true && document.getElementById('ssq-auto').textContent === 'AUTO ON'));
    // intro: auto-fire must not skip the intro
    await m.evaluate(() => { __SS.god(); }); await m.tap('[data-b=start]'); await m.waitForTimeout(400);
    ok(T + 'auto-fire does not skip the intro', await m.evaluate(() => __SS.G.state === 'intro'), await m.evaluate(() => __SS.G.state));
    ok(T + 'OK (skip intro) visible during the intro', await m.evaluate(() => { const e = document.querySelector('.srml-ok'); return getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; }));
    await m.evaluate(() => { __SS.G.st = 2.59; }); await m.waitForTimeout(200);
    await m.evaluate(() => { __SS.clear(); __SS.bolts.length = 0; __SS.P.fireCd = 0; }); await m.waitForTimeout(500);
    const af = await m.evaluate(() => __SS.bolts.length);
    ok(T + 'AUTO ON fires with no button held', af >= 2, af);
    // layout in play
    const bb = async (s) => m.locator(s).first().boundingBox();
    const cv = await bb('#game'), fire = await bb('[data-b=fire]'), roll = await bb('[data-b=roll]'), stick = await bb('#stick'), pow = await bb('[data-b=power]'), msl = await bb('[data-b=missile]'), auto = await bb('#ssq-auto');
    const vis = (s) => m.evaluate((s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; }, s);
    if (tag === 'upright') {
      ok(T + 'controls sit under the screen, never on it', [fire, roll, stick, pow, msl, auto].every(r => r.y >= cv.y + cv.height - 0.5), { cvBottom: cv.y + cv.height });
      const menuB = await bb('.srml-st'), padTop = Math.min(stick.y, pow.y);
      ok(T + 'no gap: menu row sits right under the screen (<=16px)', menuB.y - (cv.y + cv.height) <= 16 && menuB.y >= cv.y + cv.height, menuB.y - (cv.y + cv.height));
      ok(T + 'no gap: controls sit right under the menu row (<=24px)', padTop - (menuB.y + menuB.height) <= 24, padTop - (menuB.y + menuB.height));
      const lowest = Math.max(fire.y + fire.height, stick.y + stick.height);
      ok(T + 'controls in the thumb zone at the bottom (<=40px from edge)', h - lowest <= 40 && h - lowest >= 4, h - lowest);
      ok(T + 'bigger main buttons (FIRE/ROLL >=84x76, stick >=145)', fire.width >= 84 && fire.height >= 76 && roll.width >= 84 && stick.width >= 145, [fire.width, fire.height, stick.width]);
      ok(T + 'stick (D-pad) on the left, FIRE on the right', stick.x + stick.width / 2 < w / 2 && fire.x > w / 2);
      ok(T + 'screen full width', cv.width >= w - 14, cv.width);
    } else {
      ok(T + 'screen bigger than the old sideways layout (>=" + "1.2x area)', cv.width * cv.height >= 1.2 * (w - 336) * (w - 336) * 9 / 16, [cv.width, cv.height]);
      ok(T + 'no control covers the screen (stick, buttons, chips)', [fire, roll, pow, msl, stick, auto].every(r => !ov(r, cv)), [cv.x, cv.x + cv.width, stick.x + stick.width, fire.x]);
      ok(T + 'stick bottom-left, buttons right edge', stick.x < 30 && stick.y + stick.height > h - 20 && fire.x > cv.x + cv.width);
      ok(T + 'OK hidden during play, BACK kept (pauses)', (await vis('.srml-bk')) && !(await vis('.srml-ok')));
      const pz = await bb('.srml-st');
      ok(T + 'PAUSE + AUTO chips in the left margin, off the screen', !ov(pz, cv) && !ov(auto, cv) && (await m.evaluate(() => document.querySelector('.srml-st').textContent)) === 'PAUSE', [pz, auto, cv.x]);
      ok(T + 'all controls inside the viewport', [fire, roll, pow, msl, stick, pz, auto].every(r => r.x >= 0 && r.y >= 0 && r.x + r.width <= w + 0.5 && r.y + r.height <= h + 0.5));
    }
    { const sb = await bb('#stick'); const p0 = await m.evaluate(() => { __SS.P.x = 0; __SS.P.y = 0; return [__SS.P.x, __SS.P.y]; });
      await m.dispatchEvent('#stick', 'pointerdown', { pointerId: 7, clientX: sb.x + sb.width * 0.95, clientY: sb.y + sb.height * 0.5, isPrimary: true }); await m.waitForTimeout(400);
      await m.dispatchEvent('#stick', 'pointermove', { pointerId: 7, clientX: sb.x + sb.width * 0.5, clientY: sb.y + sb.height * 0.05, isPrimary: true }); await m.waitForTimeout(400);
      const p1 = await m.evaluate(() => [__SS.P.x, __SS.P.y]); await m.dispatchEvent('#stick', 'pointerup', { pointerId: 7, isPrimary: true });
      ok(T + 'stick steers in play (right, then up)', p1[0] > p0[0] + 10 && p1[1] > p0[1] + 5, [p0, p1]); }
    // toggle off
    await m.tap('#ssq-auto'); await m.waitForTimeout(100);
    ok(T + 'tap AUTO turns it OFF (label + flag + saved)', await m.evaluate(() => window.__SSAF === false && document.getElementById('ssq-auto').textContent === 'AUTO OFF' && localStorage.getItem('ssq-autofire') === '0'));
    await m.evaluate(() => { __SS.clear(); __SS.bolts.length = 0; __SS.P.fireCd = 0; }); await m.waitForTimeout(400);
    ok(T + 'AUTO OFF: no fire without holding FIRE', await m.evaluate(() => __SS.bolts.length === 0), await m.evaluate(() => __SS.bolts.length));
    await m.dispatchEvent('[data-b=fire]', 'pointerdown'); await m.waitForTimeout(300); const held = await m.evaluate(() => __SS.bolts.length); await m.dispatchEvent('[data-b=fire]', 'pointerup');
    ok(T + 'AUTO OFF: holding FIRE still fires', held >= 2, held);
    // pause shows the full menu again
    await m.tap('.srml-st'); await m.waitForTimeout(200);
    ok(T + 'PAUSE pauses; menu shows RESUME', await m.evaluate(() => __SS.G.paused && document.querySelector('.srml-st').textContent === 'RESUME'));
    await m.evaluate(() => { __SS.bolts.length = 0; }); await m.tap('#ssq-auto'); await m.waitForTimeout(300);
    ok(T + 'no auto-fire while paused', await m.evaluate(() => __SS.bolts.length === 0 && window.__SSAF === true));
    await m.reload(); await m.waitForTimeout(500);
    ok(T + 'AUTO setting remembered after reload', await m.evaluate(() => window.__SSAF === true));
    await m.evaluate(() => localStorage.setItem('ssq-autofire', '0')); await m.reload(); await m.waitForTimeout(500);
    ok(T + 'AUTO OFF remembered after reload', await m.evaluate(() => window.__SSAF === false && document.getElementById('ssq-auto').textContent === 'AUTO OFF'));
    const sw = await m.evaluate(() => [document.documentElement.scrollWidth, innerWidth, document.documentElement.scrollHeight, innerHeight]);
    ok(T + 'no overflow', sw[0] <= sw[1] && sw[2] <= sw[3], sw);
    await ctx.close();
  }
  ok('no page errors', errs.length === 0, errs);
  console.log(R.join('\n')); console.log('TOTAL', R.filter(x => x.startsWith('PASS')).length + '/' + R.length);
  await b.close();
})().catch(e => { console.log(R.join('\n')); console.error('CRASH', e); process.exit(1); });
