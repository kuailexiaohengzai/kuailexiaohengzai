const test = require('node:test');
const assert = require('node:assert/strict');

const input = require('../js/input.js');
const levels = require('../js/levels.js');
const storage = require('../js/storage.js');

test('swipe classification ignores tiny and ambiguous moves', function () {
  assert.equal(input.classifySwipe(0, -80), 'up');
  assert.equal(input.classifySwipe(0, 80), 'down');
  assert.equal(input.classifySwipe(-80, 0), 'left');
  assert.equal(input.classifySwipe(80, 0), 'right');
  assert.equal(input.classifySwipe(8, -6), null);
  assert.equal(input.classifySwipe(40, 40), null);
  assert.equal(input.classifySwipe(48, 10), 'right');
  assert.equal(input.classifySwipe(-12, 50), 'down');
  assert.equal(input.classifySwipe(Number.NaN, 40), null);

  const pointer = input.createPointer(36);
  pointer.down(20, 20);
  pointer.move(28, 24);
  assert.equal(pointer.up(30, 26).type, 'tap');

  const swipe = input.createPointer(36);
  swipe.down(100, 80);
  assert.equal(swipe.up(20, 90).direction, 'left');
});

test('level target and timer curve', function () {
  assert.equal(levels.hitsForLevel(1), 8);
  assert.equal(levels.hitsForLevel(0), 8);
  assert.equal(levels.hitsForLevel(2), 9);
  assert.equal(levels.hitsForLevel(20), 33);
  assert.equal(levels.windowMs(1, 0), 1200);
  assert.equal(levels.windowMs(1, 7), 450);
  assert.equal(levels.windowMs(20, 0), 700);
  assert.equal(levels.windowMs(21, 0), 692);
  assert.equal(levels.pointsForHit(1, false), 10);
  assert.equal(levels.pointsForHit(4, true), 120);

  let prevHits = 0;
  let prevOpen = Infinity;
  for (let level = 1; level <= 30; level++) {
    const hits = levels.hitsForLevel(level);
    assert.ok(hits > prevHits, 'hits should grow at level ' + level);
    prevHits = hits;
    const open = levels.windowMs(level, 0);
    const close = levels.windowMs(level, hits - 1);
    assert.ok(open <= 1200);
    assert.ok(close < open);
    assert.ok(close >= levels.TIMER_FLOOR);
    assert.ok(open >= levels.OPEN_FLOOR);
    if (level > 1) assert.ok(open < prevOpen, 'window should shrink at level ' + level);
    prevOpen = open;
    let prev = open;
    for (let i = 1; i < hits; i++) {
      const ms = levels.windowMs(level, i);
      assert.ok(ms <= prev, 'timer speeds up inside level ' + level);
      prev = ms;
    }
  }
});

test('storage blob roundtrip and streak', function () {
  const mem = {};
  const fake = {
    setStorageSync: function (key, val) { mem[key] = val; },
    getStorageSync: function (key) { return mem[key]; },
  };
  const blob = storage.saveProgress({
    level: 4,
    bestScore: 320,
    bestCombo: 9,
    totalRuns: 3,
    lastPlayedDate: '2026-10-26',
    dailyStreak: 2,
  }, fake);
  assert.equal(typeof blob, 'string');
  assert.equal(typeof mem[storage.STORAGE_KEY], 'string');
  assert.deepEqual(JSON.parse(mem[storage.STORAGE_KEY]), {
    level: 4,
    bestScore: 320,
    bestCombo: 9,
    totalRuns: 3,
    lastPlayedDate: '2026-10-26',
    dailyStreak: 2,
  });
  assert.deepEqual(storage.loadProgress(fake), JSON.parse(blob));

  mem[storage.STORAGE_KEY] = '{bad';
  assert.equal(storage.loadProgress(fake).level, 1);
  mem[storage.STORAGE_KEY] = '';
  assert.equal(storage.loadProgress(fake).bestScore, 0);

  const today = new Date(2026, 9, 26);
  const first = storage.touchStreak(storage.emptyProgress(), today);
  assert.equal(first.dailyStreak, 1);
  assert.equal(first.lastPlayedDate, '2026-10-26');
  const sameDay = storage.touchStreak(first, today);
  assert.equal(sameDay.dailyStreak, 1);
  const nextDay = storage.touchStreak(first, new Date(2026, 9, 27));
  assert.equal(nextDay.dailyStreak, 2);
  assert.equal(nextDay.lastPlayedDate, '2026-10-27');
  const skipped = storage.touchStreak(first, new Date(2026, 9, 28));
  assert.equal(skipped.dailyStreak, 1);

  let cloud = null;
  const api = {
    setStorageSync: function (key, val) { mem[key] = val; },
    getStorageSync: function (key) { return mem[key]; },
    setUserCloudStorage: function (opts) { cloud = opts.KVDataList; },
  };
  const store = storage.createStore(api);
  const saved = store.save({
    level: 3,
    bestScore: 90,
    bestCombo: 6,
    totalRuns: 2,
    lastPlayedDate: '2026-10-26',
    dailyStreak: 2,
    extra: 'drop-me',
  });
  assert.equal(saved.extra, undefined);
  assert.deepEqual(cloud, [
    { key: 'bestScore', value: '90' },
    { key: 'bestCombo', value: '6' },
  ]);
  assert.equal(store.load().level, 3);

  const throwing = {
    setStorageSync: function () { throw new Error('full'); },
    getStorageSync: function () { return null; },
    setUserCloudStorage: function () { throw new Error('no appid'); },
  };
  assert.equal(storage.createStore(throwing).save({ level: 2, bestScore: 1 }).level, 2);
  assert.equal(storage.createStore(null).load().level, 1);
});

test('boot survives a wx mock', function () {
  const mem = {};
  const handlers = {};
  let frame = null;
  let privacyChecked = false;
  let loginCode = '';
  const button = {
    onTap: function (fn) { button.tap = fn; },
    show: function () {},
    hide: function () {},
    destroy: function () {},
  };

  function ctx() {
    const gradient = { addColorStop: function () {} };
    return {
      setTransform: function () {},
      clearRect: function () {},
      fillRect: function () {},
      beginPath: function () {},
      moveTo: function () {},
      arcTo: function () {},
      arc: function () {},
      closePath: function () {},
      fill: function () {},
      stroke: function () {},
      fillText: function () {},
      save: function () {},
      restore: function () {},
      translate: function () {},
      scale: function () {},
      createRadialGradient: function () { return gradient; },
    };
  }

  global.wx = {
    getWindowInfo: function () {
      return { windowWidth: 375, windowHeight: 667, pixelRatio: 2, safeArea: { top: 44 }, statusBarHeight: 44 };
    },
    createCanvas: function () {
      return {
        getContext: function () { return ctx(); },
        requestAnimationFrame: function (cb) { frame = cb; },
      };
    },
    setStorageSync: function (key, value) { mem[key] = value; },
    getStorageSync: function (key) { return mem[key]; },
    login: function (opts) {
      loginCode = 'mock-login-code';
      opts.success({ code: loginCode });
    },
    getPrivacySetting: function (opts) {
      privacyChecked = true;
      opts.success({ needAuthorization: true, privacyContractName: '《隐私保护指引》' });
    },
    requirePrivacyAuthorize: function (opts) { opts.success({}); },
    getSetting: function (opts) { opts.success({ authSetting: {} }); },
    createUserInfoButton: function () { return button; },
    setUserCloudStorage: function () {},
    vibrateShort: function () {},
    onTouchStart: function (fn) { handlers.start = fn; },
    onTouchMove: function (fn) { handlers.move = fn; },
    onTouchEnd: function (fn) { handlers.end = fn; },
    onTouchCancel: function (fn) { handlers.cancel = fn; },
    onHide: function (fn) { handlers.hide = fn; },
    onShow: function (fn) { handlers.show = fn; },
    onWindowResize: function (fn) { handlers.resize = fn; },
  };

  try {
    const Main = require('../js/main.js');
    assert.equal(typeof Main, 'function');
    assert.equal(Main.default, undefined);
    new Main();
    assert.equal(privacyChecked, true);
    assert.equal(JSON.parse(mem[storage.SESSION_KEY]).code, 'mock-login-code');
    const saved = JSON.parse(mem[storage.STORAGE_KEY]);
    assert.equal(saved.level, 1);
    assert.equal(saved.dailyStreak, 1);

    for (let i = 0; i < 3; i++) {
      assert.equal(typeof frame, 'function');
      const next = frame;
      frame = null;
      next(1000 + i * 16);
    }

    handlers.start({ touches: [{ clientX: 180, clientY: 420 }] });
    handlers.end({ changedTouches: [{ clientX: 180, clientY: 424 }] });
    const afterStart = JSON.parse(mem[storage.STORAGE_KEY]);
    assert.equal(afterStart.totalRuns, 1);

    nextFrames(8);
    handlers.start({ touches: [{ clientX: 180, clientY: 400 }] });
    handlers.end({ changedTouches: [{ clientX: 180, clientY: 280 }] });
    nextFrames(12);
    handlers.hide();
    assert.equal(JSON.parse(mem[storage.STORAGE_KEY]).totalRuns, 1);
    handlers.show();
    nextFrames(2);

    button.tap({ userInfo: { nickName: '小恒' } });
    handlers.end({ changedTouches: [{ clientX: 40, clientY: 500 }] });
  } finally {
    delete global.wx;
  }

  function nextFrames(count) {
    for (let i = 0; i < count; i++) {
      if (typeof frame !== 'function') break;
      const next = frame;
      frame = null;
      next(2000 + i * 16);
    }
  }
});

test('near-miss copy selection', function () {
  assert.equal(levels.nearMissLine({
    hitsDone: 7,
    hitsRequired: 8,
    score: 10,
    bestScore: 9999,
    combo: 1,
  }), '就差 1 下');

  assert.equal(levels.nearMissLine({
    hitsDone: 2,
    hitsRequired: 8,
    score: 30,
    bestScore: 50,
    combo: 2,
  }), '再对几下就破纪录');

  assert.equal(levels.nearMissLine({
    hitsDone: 6,
    hitsRequired: 8,
    score: 100,
    bestScore: 10000,
    combo: 6,
  }), '就差 2 下');

  assert.equal(levels.nearMissLine({
    hitsDone: 1,
    hitsRequired: 8,
    score: 10,
    bestScore: 10,
    combo: 1,
  }), '');

  assert.equal(levels.nearMissLine({
    hitsDone: 0,
    hitsRequired: 8,
    score: 0,
    bestScore: 0,
    combo: 0,
  }), '');
});
