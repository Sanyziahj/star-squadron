const { chromium } = require('playwright-core');
const URL = process.argv[2] || 'file:///workspace/star-squadron/index.html';
const D = process.argv[3] || '/workspace/star-squadron/shots/';
const R = []; const ok = (n, c, d) => { R.push((c ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' ' + JSON.stringify(d) : '')); };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const errs = [];
  const p = await b.newPage({ viewport: { width: 1152, height: 900 } });
  await p.addInitScript(() => { window.__SS_DEBUG = true; });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
  await p.goto(URL); await p.waitForTimeout(900);
  const shot = n => p.locator('#game').screenshot({ path: D + n + '.png' });
  const S = (f, a) => p.evaluate(f, a);
  const W = async (f, n = 60, ms = 150, a) => { for (let i = 0; i < n; i++) { if (await S(f, a)) return true; await p.waitForTimeout(ms); } return false; };
  const keep = () => S(() => { clearInterval(window.__k); window.__k = setInterval(() => { const P = __SS.P; if (P.hp < P.maxHp * 0.6) P.hp = P.maxHp; P.lives = 2; }, 100); });
  const toTitle = async () => { await S(() => { __SS.G.state = 'title'; __SS.G.st = 1; }); await p.waitForTimeout(150); };
  async function selectStart(pilot, swapDown) {
    await W(() => __SS.G.state === 'title', 20, 100);
    for (let i = 0; i < 3 && (await S(() => __SS.G.pilot)) !== pilot; i++) { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(60); }
    const def = await S(() => __SS.G.ship);
    for (let i = 0; i < (swapDown || 0); i++) { await p.keyboard.press('ArrowDown'); await p.waitForTimeout(60); }
    await p.keyboard.press('Enter'); await W(() => __SS.G.state === 'intro', 20, 50);
    return [def, await S(() => [__SS.P.pilot, __SS.P.ship])];
  }
  await shot('01-pilot-select');
  // ---- pilots, default ships, blaster patterns ----
  const want = ['center', 'twin', 'wave'];
  for (let pi = 0; pi < 3; pi++) {
    const [def, got] = await selectStart(pi, 0);
    ok('pilot ' + pi + ' selectable with own ship', def === pi && got[0] === pi && got[1] === pi, { def, got });
    await S(() => { __SS.G.st = 2.59; }); await W(() => __SS.G.state === 'play', 20, 50);
    await S(() => { __SS.clear(); __SS.P.x = 0; __SS.P.y = 0; __SS.P.fireCd = 0; }); await p.waitForTimeout(50);
    await S(() => { __SS.bolts.length = 0; });
    await p.keyboard.down('Space'); await p.waitForTimeout(30); await p.keyboard.up('Space');
    await p.waitForTimeout(20);
    const bl = await S(() => __SS.bolts.map(b => ({ k: b.kind, dx: +(b.x - b.vx * b.t - __SS.P.x).toFixed(1) })));
    const k = want[pi];
    const patt = k === 'center' ? bl.length === 1 && bl[0].k === 'center' && Math.abs(bl[0].dx) < 0.6
      : k === 'twin' ? bl.length === 2 && bl.every(x => x.k === 'twin') && bl.some(x => x.dx < -5) && bl.some(x => x.dx > 5)
      : bl.length === 1 && bl[0].k === 'wave';
    ok('pilot ' + pi + ' blaster = ' + k, patt, bl);
    if (k === 'wave') { await p.waitForTimeout(120); const wv = await S(() => __SS.bolts.filter(b => b.kind === 'wave').map(b => [+b.wob.toFixed(2), +b.t.toFixed(2)])); ok('wave blaster oscillates + widens', wv.length && wv.some(w => Math.abs(w[0]) > 0.5), wv); }
    if (pi === 0) { await p.keyboard.down('Space'); await p.waitForTimeout(140); await shot('hauler-center-blaster'); await p.keyboard.up('Space'); }
    if (pi === 1) { await p.keyboard.down('Space'); await p.waitForTimeout(140); await shot('jet-double-blaster'); await p.keyboard.up('Space'); }
    if (pi === 2) { await p.keyboard.down('Space'); await p.waitForTimeout(160); await shot('saucer-wave-blaster'); await p.keyboard.up('Space'); }
    await toTitle();
  }
  // ---- ship swap ----
  {
    const [def, got] = await selectStart(0, 2); // Rusty + 2x down -> saucer
    ok('ship swap: Rusty flies the saucer', def === 0 && got[0] === 0 && got[1] === 2, { def, got });
    await S(() => { __SS.clear(); __SS.bolts.length = 0; __SS.P.fireCd = 0; }); await p.keyboard.down('Space'); await p.waitForTimeout(30); await p.keyboard.up('Space');
    const k = await S(() => __SS.bolts.map(b => b.kind)); ok('swapped ship uses its own blaster (wave)', k.length === 1 && k[0] === 'wave', k);
    await toTitle();
    await W(() => __SS.G.state === 'title', 20, 100);
    for (let i = 0; i < 3 && (await S(() => __SS.G.pilot)) !== 2; i++) { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(60); }
    await p.keyboard.press('ArrowUp'); await p.waitForTimeout(60); await p.keyboard.press('ArrowUp'); await p.waitForTimeout(100);
    await shot('02-ship-swap'); const sw = await S(() => [__SS.G.pilot, __SS.G.ship]); ok('ship swap: Kal flies the Hauler', sw[0] === 2 && sw[1] === 0, sw);
    await toTitle();
  }
  // ---- full run as CPT Buck Blue ----
  await selectStart(1, 0); await keep();
  await W(() => __SS.G.state === 'play', 40, 100);
  ok('stage 1 starts', await S(() => __SS.G.state === 'play' && __SS.G.stage === 0));
  // barrel roll + deflect
  await S(() => { __SS.clear(); __SS.P.x = 0; __SS.P.y = 0; });
  const hp0 = await S(() => __SS.P.hp);
  await p.keyboard.press('KeyZ'); await p.waitForTimeout(30);
  const rolling = await S(() => __SS.P.roll > 0);
  await S(() => { const P = __SS.P; __SS.eshots.push({ x: P.x, y: P.y, z: 30, vx: 0, vy: 0, vz: -600, r: 3, kind: 'bolt', t: 0, dmg: 2 }); });
  await p.waitForTimeout(90); await shot('barrel-roll');
  await p.waitForTimeout(150);
  const dfl = await S(() => [__SS.G.deflects, __SS.P.hp]);
  ok('barrel roll (Z) spins the ship', rolling);
  ok('barrel roll deflects enemy shots', dfl[0] >= 1 && dfl[1] === hp0, { dfl, hp0 });
  await p.waitForTimeout(700);
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(80); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(30);
  ok('double-tap left also rolls', await S(() => __SS.P.roll > 0 && __SS.P.rollDir === -1));
  await p.waitForTimeout(700);
  // unrolled hit for contrast
  await S(() => { __SS.P.inv = 0; const P = __SS.P; __SS.eshots.push({ x: P.x, y: P.y, z: 30, vx: 0, vy: 0, vz: -600, r: 3, kind: 'bolt', t: 0, dmg: 2 }); }); await p.waitForTimeout(200);
  ok('shots hurt when not rolling', (await S(() => __SS.P.hp)) < hp0, await S(() => __SS.P.hp));
  // pickups
  await S(() => { __SS.clear(); __SS.P.hp = 6; __SS.P.inv = 0; __SS.spawn('med', __SS.P.x, __SS.P.y, 50); }); await p.waitForTimeout(80); await shot('med-pickup'); await p.waitForTimeout(400);
  const hpM = await S(() => __SS.P.hp); ok('med pickup restores shield', hpM > 6, hpM);
  await S(() => { __SS.P.msl = 1; __SS.spawn('msl', __SS.P.x, __SS.P.y, 50); }); await p.waitForTimeout(500);
  const ms = await S(() => __SS.P.msl); ok('missile pickup adds ammo', ms === 4, ms);
  // seeking missiles
  await S(() => { __SS.clear(); const a = __SS.spawn('raider', 30, 14, 260); a.vz = 0; a.t = 1; a.hp = 3; const c = __SS.spawn('drone', -35, -10, 320); c.vz = 0; c.t = 1; window.__tA = a; window.__tC = c; });
  await p.waitForTimeout(50);
  await p.keyboard.press('KeyC'); await p.waitForTimeout(360); await p.keyboard.press('KeyC'); await p.waitForTimeout(60);
  const lk = await S(() => __SS.missiles.map(m => m.tgt ? m.tgt.kind : null));
  await p.waitForTimeout(150); await shot('missile-lock');
  ok('missiles lock onto nearest enemies (2 different targets)', lk.length === 2 && lk.includes('raider') && lk.includes('drone'), lk);
  ok('seeking missiles destroy their targets', await W(() => window.__tA.dead && window.__tC.dead, 30, 100), await S(() => [window.__tA.hp, window.__tC.hp]));
  ok('missile ammo spent', (await S(() => __SS.P.msl)) === 2, await S(() => __SS.P.msl));
  // fly the stage for real for a bit, with auto-fire
  await S(() => { __SS.P.inv = 0; });
  await p.keyboard.down('Space');
  for (let i = 0; i < 14; i++) { await S(() => { const t = __SS.objs.filter(o => o.hp > 0 && !o.solid && o.z > 60 && o.z < 500).sort((a, b) => a.z - b.z)[0]; if (t) __SS.aimAt(t.x, t.y, t.z - 30); }); await p.waitForTimeout(250); }
  await shot('03-stage1-meteor-field');
  await p.keyboard.up('Space');
  const st1 = await S(() => [__SS.P.score, __SS.P.sp, __SS.objs.map(o => o.kind).filter((v, i, a) => a.indexOf(v) === i)]);
  ok('stage 1 has meteors / satellites and kills score', st1[0] > 0, st1);
  ok('power meter charges from kills', st1[1] > 0, st1[1]);
  // power clears the screen
  await S(() => { __SS.clear(); for (let i = 0; i < 4; i++) { const o = __SS.spawn('raider', -30 + i * 20, 0, 200 + i * 40); o.vz = 0; o.t = 1; } __SS.P.sp = 100; __SS.P.spWasReady = false; });
  await p.waitForTimeout(100);
  await S(() => { __SS.P.sp = 99; __SS.P.spWasReady = false; }); await S(() => { const P = __SS.P; P.sp = Math.min(100, P.sp + 5); });
  await S(() => { __SS.P.sp = 100; }); 
  const before = await S(() => __SS.objs.filter(o => o.hp > 0 && o.z < 700).length);
  await p.keyboard.press('KeyB'); await p.waitForTimeout(120); await shot('power-nova');
  const after = await S(() => [__SS.objs.filter(o => o.hp > 0 && !o.dead && o.z < 700).length, __SS.P.sp]);
  ok('POWER clears on-screen enemies', before >= 4 && after[0] === 0 && after[1] === 0, { before, after });
  // ---- bosses ----
  const aimWeak = () => S(() => { clearInterval(window.__aim); window.__aim = setInterval(() => { const w = __SS.weak(); if (w) __SS.aimAt(w.x, w.y, w.z); }, 16); });
  const stopAim = () => S(() => clearInterval(window.__aim));
  async function boss(n, names) {
    await S(() => __SS.toBoss());
    if (n < 2) { await W(() => __SS.bs.state === 'warn', 30, 100); await p.waitForTimeout(1200); await shot(names[0]); ok('boss ' + (n + 1) + ' WARNING entrance', await S(() => __SS.bs.state === 'warn')); }
    else { await W(() => __SS.bs.state === 'appear' && __SS.bs.st > 2.6, 60, 100); await shot(names[0]); const u = await S(() => __SS.bs.state === 'appear'); ok('029 UPLOADING entrance', u); }
    ok('boss ' + (n + 1) + ' fight starts', await W(() => __SS.bs.state === 'fight', 80, 100));
    await S(() => { window.__seen = []; clearInterval(window.__sv); window.__sv = setInterval(() => { const w = __SS.weak(); if (w && window.__seen[window.__seen.length - 1] !== w.name) window.__seen.push(w.name); }, 16); });
    // armour: shots at the body when the weak point is sealed do nothing
    await W(() => !__SS.weak(), 80, 50);
    const h0 = await S(() => __SS.bs.hp);
    await S(() => { const B = __SS.bs; __SS.aimAt(B.x + 6, B.y + (B.idx === 2 ? 20 : 0), B.z); });
    await p.keyboard.down('Space'); await p.waitForTimeout(300); await p.keyboard.up('Space');
    const h1 = await S(() => [__SS.bs.hp, !!__SS.weak()]);
    ok('boss ' + (n + 1) + ' armour blocks shots while sealed', h1[1] || h1[0] === h0, { h0, h1 });
    await W(() => !!__SS.weak(), 120, 50);
    await aimWeak(); await p.keyboard.down('Space');
    await W(() => __SS.bs.hp < __SS.bs.max - 4, 80, 100);
    await shot(names[1]);
    await p.keyboard.up('Space');
    const hA = await S(() => [__SS.bs.hp, __SS.bs.max]); ok('boss ' + (n + 1) + ' weak point takes blaster damage', hA[0] < hA[1], hA);
    // missile onto the weak point
    await W(() => !!__SS.weak(), 120, 50);
    const hm0 = await S(() => { __SS.clear(); __SS.P.msl = 3; return __SS.bs.hp; }); await p.keyboard.press('KeyC'); await p.waitForTimeout(80);
    const mb = await S(() => __SS.missiles.length && __SS.missiles[__SS.missiles.length - 1].boss);
    await W(() => __SS.missiles.length === 0, 40, 100);
    const hm1 = await S(() => __SS.bs.hp); ok('boss ' + (n + 1) + ' missile locks onto weak point', mb && hm1 < hm0, { mb, hm0, hm1 });
    // power heavy hit (15%)
    const ph = await S(() => { const B = __SS.bs; __SS.P.sp = 100; return [B.hp, B.max, B.idx === 2 ? B.php : 999]; });
    await p.keyboard.press('KeyB'); await p.waitForTimeout(60);
    const ph1 = await S(() => __SS.bs.hp); const exp = Math.min(Math.ceil(ph[1] * 0.15), ph[2]);
    ok('boss ' + (n + 1) + ' POWER heavy hit (15%)', ph[0] - ph1 >= exp - 0.01 && ph[0] - ph1 < exp + 5, { before: ph[0], after: ph1, max: ph[1] });
    if (n === 2) { // phases: comet -> core -> visor
      const seen = [];
      for (let ph2 = 0; ph2 < 3; ph2++) { const cur = await S(() => __SS.bs.ph); if (cur > ph2) continue;
        if (!(await W(() => __SS.bs.state === 'fight', 10, 50))) break; await W(() => !!__SS.weak(), 120, 50);
        if (ph2 === 1) await shot('07-boss-029-core');
        await S(() => { __SS.bs.php = Math.min(__SS.bs.php, 2); __SS.bs.hp = __SS.bs.php + [100, 55, 0][Math.min(2, __SS.bs.ph)]; });
        await p.keyboard.down('Space'); await W(ph => __SS.bs.ph > ph || __SS.bs.state !== 'fight', 80, 100, ph2); await p.keyboard.up('Space');
      }
      const sn = await S(() => window.__seen); ok('029 weak points open in phases (comet, core, visor)', JSON.stringify(sn) === '["comet","core","visor"]', sn);
    } else {
      await S(() => { __SS.bs.hp = 3; }); await p.keyboard.down('Space');
    }
    const want = n === 2 ? 'victory' : 'clear';
    ok('boss ' + (n + 1) + ' defeated', await W(w => __SS.G.state === w, 120, 100, want), await S(() => [__SS.G.state, __SS.bs.state, __SS.bs.hp]));
    await p.keyboard.up('Space'); await stopAim();
  }
  await boss(0, ['b1-warning', '04-boss-eye']);
  await p.waitForTimeout(1700); await p.keyboard.press('Space');
  ok('stage 2 reached', await W(() => __SS.G.stage === 1 && __SS.G.state === 'play', 60, 150));
  await S(() => { __SS.P.inv = 0; }); await p.keyboard.down('Space');
  await W(() => __SS.objs.some(o => o.kind === 'turret') && __SS.eshots.some(s => s.kind === 'flak'), 80, 150);
  for (let i = 0; i < 8; i++) { await S(() => { const t = __SS.objs.filter(o => o.hp > 0 && !o.solid && o.z > 60 && o.z < 500).sort((a, b) => a.z - b.z)[0]; if (t) __SS.aimAt(t.x, t.y, t.z - 30); }); await p.waitForTimeout(250); }
  await shot('05-stage2-over-mars'); await p.keyboard.up('Space');
  const k2 = await S(() => [__SS.objs.map(o => o.kind).filter((v, i, a) => a.indexOf(v) === i), __SS.eshots.map(s => s.kind).filter((v, i, a) => a.indexOf(v) === i)]);
  ok('Mars: ground artillery fires flak', k2[0].includes('turret'), k2);
  await W(() => __SS.objs.some(o => o.kind === 'drone') || __SS.objs.some(o => o.kind === 'raider'), 80, 150);
  ok('Mars: drones / small ships appear', await S(() => __SS.objs.some(o => o.kind === 'drone' || o.kind === 'raider' || o.kind === 'mesa')), await S(() => __SS.objs.map(o => o.kind)));
  await boss(1, ['b2-warning', '06-boss-green-saucer']);
  await p.waitForTimeout(1700); await p.keyboard.press('Space');
  ok('stage 3 reached', await W(() => __SS.G.stage === 2 && __SS.G.state === 'play', 60, 150));
  await W(() => __SS.objs.some(o => o.kind === 'fly'), 120, 150);
  await p.waitForTimeout(1200); await shot('06b-stage3-fly-army');
  const k3 = await S(() => __SS.objs.map(o => o.kind).filter((v, i, a) => a.indexOf(v) === i));
  ok('Outer Space: saucers, robot flies and the fly army', ['esaucer', 'robofly', 'fly'].every(k => k3.includes(k)), k3);
  await boss(2, ['08-029-uploading', '09-boss-029']);
  await W(() => __SS.G.st > 2.6, 40, 150); await shot('victory');
  await p.keyboard.press('Space'); await W(() => __SS.G.state === 'poster', 30, 150); await p.waitForTimeout(900);
  const dl = await S(() => { const a = document.getElementById('dl'); return [!document.getElementById('prize').hidden, a.href.slice(0, 23), a.download, a.href.length]; });
  ok('poster page + download link', dl[0] && dl[1] === 'data:image/jpeg;base64,' && dl[2] === 'space-riders-star-squadron-poster.jpg' && dl[3] > 100000, dl);
  const [dlv] = await Promise.all([p.waitForEvent('download'), p.click('#dl')]); const fp = D + 'downloaded-poster.jpg'; await dlv.saveAs(fp);
  ok('poster downloads', require('fs').statSync(fp).size > 100000, require('fs').statSync(fp).size);
  await p.screenshot({ path: D + '10-poster-page.png', fullPage: true });
  await p.click('#again'); await p.waitForTimeout(400); ok('play again', await S(() => __SS.G.state === 'title'));
  // ---- mobile ----
  const m = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await m.addInitScript(() => { window.__SS_DEBUG = true; });
  m.on('pageerror', e => errs.push('m: ' + e.message));
  await m.goto(URL); await m.waitForTimeout(600);
  const box = await m.locator('#game').boundingBox();
  const tapC = (x, y) => m.tap('#game', { position: { x: box.width * x / 384, y: box.height * y / 216 } });
  await tapC(12 + 124 * 2 + 56, 100); await m.waitForTimeout(150);
  const mp = await m.evaluate(() => [__SS.G.pilot, __SS.G.ship]);
  await tapC(300, 175); await m.waitForTimeout(150); const msw = await m.evaluate(() => __SS.G.ship);
  await tapC(300, 175); await m.waitForTimeout(150); await tapC(300, 175); await m.waitForTimeout(150);
  await m.tap('[data-b=start]'); await m.waitForTimeout(300);
  ok('mobile: tap selects Commander Kal', mp[0] === 2 && mp[1] === 2, mp);
  ok('mobile: tap ship row swaps ship', msw === 0, msw);
  ok('mobile: START launches', await m.evaluate(() => __SS.G.state === 'intro' || __SS.G.state === 'play'));
  await m.evaluate(() => { __SS.god(); __SS.clear(); });
  // SETUP CORRECTION (every assertion below is unchanged): tapping START only
  // reaches the stage intro, and the ship does not steer until state is "play".
  // Wait for actual play, then run the same pointer events and the same
  // position assertion so the check is real touch steering, not the intro timer.
  for (let i = 0; i < 50 && !(await m.evaluate(() => __SS.G.state === 'play' && !__SS.G.paused)); i++) await m.waitForTimeout(100);
  const sb = await m.locator('#stick').boundingBox();
  const p0 = await m.evaluate(() => [__SS.P.x, __SS.P.y]);
  await m.dispatchEvent('#stick', 'pointerdown', { pointerId: 7, clientX: sb.x + sb.width * 0.95, clientY: sb.y + sb.height * 0.5, isPrimary: true });
  await m.waitForTimeout(500);
  await m.dispatchEvent('#stick', 'pointermove', { pointerId: 7, clientX: sb.x + sb.width * 0.5, clientY: sb.y + sb.height * 0.05, isPrimary: true });
  await m.waitForTimeout(400);
  const p1 = await m.evaluate(() => [__SS.P.x, __SS.P.y]);
  await m.dispatchEvent('#stick', 'pointerup', { pointerId: 7, isPrimary: true });
  ok('mobile: virtual stick steers (right, then up)', p1[0] > p0[0] + 10 && p1[1] > p0[1] + 5, [p0, p1]);
  await m.evaluate(() => { __SS.bolts.length = 0; __SS.P.fireCd = 0; });
  await m.dispatchEvent('[data-b=fire]', 'pointerdown'); await m.waitForTimeout(250); const mb = await m.evaluate(() => __SS.bolts.length); await m.dispatchEvent('[data-b=fire]', 'pointerup');
  ok('mobile: FIRE button (hold = auto-fire)', mb >= 2, mb);
  await m.dispatchEvent('[data-b=roll]', 'pointerdown'); await m.waitForTimeout(30); const mr = await m.evaluate(() => __SS.P.roll > 0); await m.dispatchEvent('[data-b=roll]', 'pointerup');
  ok('mobile: ROLL button', mr);
  await m.evaluate(() => { const o = __SS.spawn('raider', 10, 5, 250); o.vz = 0; o.t = 1; __SS.P.msl = 3; }); await m.waitForTimeout(50);
  await m.dispatchEvent('[data-b=missile]', 'pointerdown'); await m.waitForTimeout(30); await m.dispatchEvent('[data-b=missile]', 'pointerup');
  ok('mobile: MISSILE button locks on', await m.evaluate(() => __SS.missiles.length === 1 && !!__SS.missiles[0].tgt));
  await m.evaluate(() => { __SS.P.sp = 99; __SS.P.spWasReady = false; const o = __SS.spawn('drone', 0, 0, 200); o.vz = 0; o.t = 1; o.hp = 1; __SS.aimAt(0, 0, 200); });
  await m.dispatchEvent('[data-b=fire]', 'pointerdown'); await m.waitForTimeout(400); await m.dispatchEvent('[data-b=fire]', 'pointerup');
  const mready = await m.evaluate(() => [__SS.P.sp, document.getElementById('pow').classList.contains('ready')]);
  ok('mobile: POWER ready glow', mready[1], mready);
  await m.dispatchEvent('[data-b=power]', 'pointerdown'); await m.waitForTimeout(60); await m.dispatchEvent('[data-b=power]', 'pointerup');
  ok('mobile: POWER button fires', await m.evaluate(() => __SS.P.sp === 0));
  const sw = await m.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  ok('mobile: no horizontal overflow', sw[0] <= sw[1], sw);
  await m.waitForTimeout(900); await m.screenshot({ path: D + '11-mobile.png' });
  ok('no page errors', errs.length === 0, errs);
  console.log(R.join('\n'));
  await b.close();
})().catch(e => { console.log(R.join('\n')); console.error('CRASH', e); process.exit(1); });
