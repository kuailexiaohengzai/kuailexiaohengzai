/**
 * 主循环。点击开始，滑对加分，滑错或超时立刻结束。
 * 过关后最大的按钮是「再刷一下」，再来一局同一关。
 */

const input = require('./input');
const levels = require('./levels');
const storage = require('./storage');
const userApi = require('./user');
const render = require('./render');

const FLY_MS = 160;
const DIE_MS = 280;
const CELEBRATE_MS = 720;

function readLayout() {
  let info = null;
  if (typeof wx !== 'undefined') {
    try {
      if (typeof wx.getWindowInfo === 'function') info = wx.getWindowInfo();
    } catch (err) {}
    if (!info) {
      try {
        if (typeof wx.getSystemInfoSync === 'function') info = wx.getSystemInfoSync();
      } catch (err) {}
    }
  }
  info = info || {};
  const w = info.windowWidth || info.screenWidth || 375;
  const h = info.windowHeight || info.screenHeight || 667;
  const dpr = info.pixelRatio || 1;
  let safeTop = 0;
  if (info.safeArea && typeof info.safeArea.top === 'number') safeTop = info.safeArea.top;
  else if (typeof info.statusBarHeight === 'number') safeTop = info.statusBarHeight;
  return { w: w, h: h, dpr: dpr, safeTop: safeTop };
}

function onWx(name, handler) {
  if (typeof wx === 'undefined' || typeof wx[name] !== 'function') return;
  try { wx[name](handler); } catch (err) {}
}

function createState(progress) {
  return {
    scene: 'start',
    sceneT: 0,
    paused: false,
    level: progress.level,
    score: 0,
    combo: 0,
    hitsDone: 0,
    hitsRequired: levels.hitsForLevel(progress.level),
    bestScore: progress.bestScore,
    bestCombo: progress.bestCombo,
    frontier: progress.level,
    streak: progress.dailyStreak,
    nickname: '',
    timeLeft: 0,
    windowTotal: 1,
    card: null,
    failReason: '',
    nearMiss: '',
    flash: 0,
    flashColor: '#FFE14A',
    particles: [],
    floater: null,
    hotspots: [],
    clock: 0,
    lastDirId: '',
  };
}

function boot() {
  if (typeof wx === 'undefined' || typeof wx.createCanvas !== 'function') {
    console.error('再刷一下需要在微信小游戏环境运行');
    return;
  }

  const layout = readLayout();
  const canvas = wx.createCanvas();
  const ctx = canvas.getContext('2d');
  const store = storage.createStore();
  let progress = store.load();
  progress = storage.touchStreak(progress, new Date());
  progress = store.save(progress);

  const state = createState(progress);
  const session = userApi.createUserSession({
    onNickname: function (name) {
      state.nickname = name;
    },
  });

  function fitCanvas() {
    const dpr = layout.dpr || 1;
    canvas.width = Math.max(1, Math.round(layout.w * dpr));
    canvas.height = Math.max(1, Math.round(layout.h * dpr));
  }

  function refreshLayout() {
    const next = readLayout();
    layout.w = next.w;
    layout.h = next.h;
    layout.dpr = next.dpr;
    layout.safeTop = next.safeTop;
    fitCanvas();
    session.relayout(layout);
  }

  function syncMenu() {
    const menu = state.scene === 'start' || state.scene === 'clear' || state.scene === 'fail';
    session.setMenuVisible(menu);
  }

  function persist() {
    progress = store.save(progress);
    state.bestScore = progress.bestScore;
    state.bestCombo = progress.bestCombo;
    state.frontier = progress.level;
    state.streak = progress.dailyStreak;
  }

  function burst(color, count) {
    const rect = render.cardRect(layout);
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 260;
      state.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        life: 480 + Math.random() * 420,
        color: color,
        r: 3 + Math.random() * 4,
      });
    }
    if (state.particles.length > 72) {
      state.particles.splice(0, state.particles.length - 72);
    }
  }

  function spawnCard() {
    const dir = levels.pickDirection(state.lastDirId);
    state.lastDirId = dir.id;
    state.card = {
      id: dir.id,
      arrow: dir.arrow,
      cue: dir.cue,
      viral: Math.random() < levels.VIRAL_RATE,
      age: 0,
    };
    state.windowTotal = levels.windowMs(state.level, state.hitsDone);
    state.timeLeft = state.windowTotal;
    state.scene = 'play';
    state.sceneT = 0;
  }

  function startRun(level) {
    const nextLevel = level < 1 ? 1 : level;
    state.level = nextLevel;
    state.score = 0;
    state.combo = 0;
    state.hitsDone = 0;
    state.hitsRequired = levels.hitsForLevel(nextLevel);
    state.failReason = '';
    state.nearMiss = '';
    state.lastDirId = '';
    state.particles = [];
    state.floater = null;
    state.flash = 0;
    progress.totalRuns += 1;
    progress = storage.touchStreak(progress, new Date());
    persist();
    spawnCard();
    syncMenu();
  }

  function celebrate() {
    if (state.score > progress.bestScore) progress.bestScore = state.score;
    if (state.combo > progress.bestCombo) progress.bestCombo = state.combo;
    progress.level = Math.max(progress.level, state.level + 1);
    persist();
    state.scene = 'celebrate';
    state.sceneT = 0;
    state.flash = 1;
    state.flashColor = '#3DFFB0';
    burst('#FF2E93', 12);
    burst('#7C5CFF', 12);
    burst('#3DFFB0', 10);
    burst('#FFE14A', 8);
    syncMenu();
  }

  function failRun(reason) {
    if (state.scene === 'die' || state.scene === 'fail' || state.scene === 'celebrate' || state.scene === 'clear') {
      return;
    }
    const previousBest = progress.bestScore;
    state.failReason = reason;
    state.nearMiss = levels.nearMissLine({
      hitsDone: state.hitsDone,
      hitsRequired: state.hitsRequired,
      score: state.score,
      bestScore: previousBest,
      combo: state.combo,
    });
    if (state.score > progress.bestScore) progress.bestScore = state.score;
    if (state.combo > progress.bestCombo) progress.bestCombo = state.combo;
    persist();
    state.flash = 1;
    state.flashColor = '#FF2E93';
    state.scene = 'die';
    state.sceneT = 0;
    syncMenu();
  }

  function onSwipe(direction) {
    if (state.paused || state.scene !== 'play' || !state.card) return;
    if (direction !== state.card.id) {
      failRun('wrong');
      return;
    }
    state.combo += 1;
    const gained = levels.pointsForHit(state.combo, state.card.viral);
    state.score += gained;
    state.floater = {
      text: '+' + gained,
      age: 0,
      life: 420,
      color: state.card.viral ? '#FFE14A' : '#3DFFB0',
    };
    if (state.card.viral) {
      state.flash = 1;
      state.flashColor = '#FFE14A';
      burst('#FFE14A', 16);
    }
    userApi.vibrateLight();
    state.scene = 'fly';
    state.sceneT = 0;
  }

  function hotspotAt(x, y) {
    for (let i = state.hotspots.length - 1; i >= 0; i--) {
      const spot = state.hotspots[i];
      if (x >= spot.x && x <= spot.x + spot.w && y >= spot.y && y <= spot.y + spot.h) return spot.id;
    }
    return null;
  }

  function inSignatureZone(x, y) {
    const zoneW = 96;
    const zoneH = (layout.safeTop || 0) + 52;
    return x >= layout.w - zoneW && y <= zoneH;
  }

  function onTap(x, y) {
    if (state.paused) return;
    if (state.scene === 'start') {
      if (inSignatureZone(x, y)) return;
      startRun(progress.level || 1);
      return;
    }
    const id = hotspotAt(x, y);
    if ((state.scene === 'fail' || state.scene === 'clear') && id === 'replay') {
      startRun(state.level);
      return;
    }
    if (state.scene === 'clear' && id === 'next') {
      startRun(state.level + 1);
      return;
    }
    if (state.scene === 'fail' && id === 'frontier' && state.frontier > state.level) {
      startRun(state.frontier);
    }
  }

  const pointer = input.createPointer(input.SWIPE_THRESHOLD);
  onWx('onTouchStart', function (event) {
    const point = input.pointFromTouch(event);
    if (!point) return;
    pointer.down(point.x, point.y);
  });
  onWx('onTouchMove', function (event) {
    const point = input.pointFromTouch(event);
    if (!point) return;
    pointer.move(point.x, point.y);
  });
  onWx('onTouchEnd', function (event) {
    const point = input.pointFromTouch(event);
    if (!point) return;
    const gesture = pointer.up(point.x, point.y);
    if (!gesture || state.paused) return;
    if (gesture.type === 'swipe') onSwipe(gesture.direction);
    else if (gesture.type === 'tap') onTap(gesture.x, gesture.y);
  });
  onWx('onTouchCancel', function () {
    pointer.cancel();
  });

  let generation = 0;

  function schedule(cb) {
    if (canvas && typeof canvas.requestAnimationFrame === 'function') {
      canvas.requestAnimationFrame(cb);
      return;
    }
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(cb);
      return;
    }
    setTimeout(function () { cb(Date.now()); }, 16);
  }

  function startLoop() {
    const token = ++generation;
    let lastTs = 0;
    function frame(ts) {
      if (token !== generation) return;
      const now = typeof ts === 'number' ? ts : Date.now();
      if (state.paused) {
        lastTs = 0;
        render.draw(ctx, state, layout);
        if (token === generation) schedule(frame);
        return;
      }
      if (!lastTs) lastTs = now;
      let dt = now - lastTs;
      lastTs = now;
      if (!Number.isFinite(dt) || dt < 0) dt = 0;
      if (dt > 48) dt = 48;
      update(dt);
      if (token !== generation) return;
      render.draw(ctx, state, layout);
      if (token === generation) schedule(frame);
    }
    schedule(frame);
  }

  onWx('onHide', function () {
    state.paused = true;
    generation += 1;
    persist();
  });
  onWx('onShow', function () {
    state.paused = false;
    startLoop();
  });
  onWx('onWindowResize', function () {
    refreshLayout();
  });

  function update(dt) {
    state.clock += dt;
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt / 280);
    if (state.floater) {
      state.floater.age += dt;
      if (state.floater.age >= state.floater.life) state.floater = null;
    }
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        state.particles.splice(i, 1);
        continue;
      }
      const sec = dt / 1000;
      p.x += p.vx * sec;
      p.y += p.vy * sec;
      p.vy += 240 * sec;
    }

    if (state.scene === 'play') {
      if (state.card) state.card.age += dt;
      state.timeLeft -= dt;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        failRun('timeout');
      }
      return;
    }
    if (state.scene === 'fly') {
      state.sceneT += dt;
      if (state.sceneT < FLY_MS) return;
      state.hitsDone += 1;
      if (state.hitsDone >= state.hitsRequired) celebrate();
      else spawnCard();
      return;
    }
    if (state.scene === 'die') {
      state.sceneT += dt;
      if (state.sceneT >= DIE_MS) {
        state.scene = 'fail';
        state.sceneT = 0;
        syncMenu();
      }
      return;
    }
    if (state.scene === 'celebrate') {
      state.sceneT += dt;
      if (state.sceneT >= CELEBRATE_MS) {
        state.scene = 'clear';
        state.sceneT = 0;
        syncMenu();
      }
    }
  }

  fitCanvas();
  session.relayout(layout);
  syncMenu();
  startLoop();
}

module.exports = {
  boot: boot,
};
