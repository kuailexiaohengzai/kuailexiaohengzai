/**
 * 关卡曲线、得分和临近失败文案。纯函数，不依赖 wx。
 *
 * 第 1 关 8 下。计时从 1200ms 收到 450ms。
 * 之后每关加目标，并缩短窗口；20 关之后继续加难，但有下限。
 */

const DIRECTIONS = [
  { id: 'up', arrow: '↑', cue: '上滑' },
  { id: 'down', arrow: '↓', cue: '下滑' },
  { id: 'left', arrow: '←', cue: '左滑' },
  { id: 'right', arrow: '→', cue: '右滑' },
];

const VIRAL_RATE = 1 / 8;
const TIMER_FLOOR = 280;
const OPEN_FLOOR = 350;

function normalizeLevel(level) {
  const n = Math.floor(Number(level));
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

function clamp01(t) {
  if (t < 0) return 0;
  if (t > 1) return 1;
  return t;
}

function easeOut(t) {
  const x = clamp01(t);
  return 1 - (1 - x) * (1 - x);
}

function smoothstep01(t) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

function hitsForLevel(level) {
  const k = normalizeLevel(level) - 1;
  return 8 + k + Math.floor(k / 3);
}

function openingWindowMs(level) {
  const n = normalizeLevel(level);
  const eased = easeOut((n - 1) / 19);
  let open = 1200 - 500 * eased;
  if (n > 20) open -= (n - 20) * 8;
  if (open < OPEN_FLOOR) open = OPEN_FLOOR;
  return open;
}

function closingWindowMs(level) {
  const n = normalizeLevel(level);
  const eased = easeOut((n - 1) / 19);
  let end = 450 - 150 * eased;
  if (n > 20) end -= (n - 20) * 3;
  const open = openingWindowMs(n);
  if (end > open - 50) end = open - 50;
  if (end < TIMER_FLOOR) end = TIMER_FLOOR;
  return end;
}

function windowMs(level, hitIndex) {
  const n = normalizeLevel(level);
  const hits = hitsForLevel(n);
  let index = Math.floor(Number(hitIndex));
  if (!Number.isFinite(index) || index < 0) index = 0;
  if (index > hits - 1) index = hits - 1;
  const open = openingWindowMs(n);
  const end = closingWindowMs(n);
  const t = hits <= 1 ? 1 : index / (hits - 1);
  return Math.round(open + (end - open) * smoothstep01(t));
}

function pointsForHit(combo, viral) {
  const c = Math.floor(Number(combo));
  if (!Number.isFinite(c) || c < 1) return 0;
  return 10 * c * (viral ? 3 : 1);
}

function pickDirection(previousId, rng) {
  const roll = typeof rng === 'function' ? rng : Math.random;
  let index = Math.floor(roll() * DIRECTIONS.length);
  if (index < 0) index = 0;
  if (index >= DIRECTIONS.length) index = DIRECTIONS.length - 1;
  if (previousId && DIRECTIONS[index].id === previousId) {
    index = Math.floor(roll() * DIRECTIONS.length);
    if (index < 0) index = 0;
    if (index >= DIRECTIONS.length) index = DIRECTIONS.length - 1;
  }
  return DIRECTIONS[index];
}

function nearMissLine(info) {
  const src = info || {};
  const hitsDone = Number(src.hitsDone) || 0;
  const hitsRequired = Number(src.hitsRequired) || 0;
  const remain = hitsRequired - hitsDone;
  if (remain === 1) return '就差 1 下';

  const score = Number(src.score) || 0;
  const best = Number(src.bestScore) || 0;
  const combo = Number(src.combo) || 0;
  if (best > score) {
    const gap = best - score;
    let gained = 0;
    let stepCombo = combo;
    let steps = 0;
    while (steps < 3 && gained < gap) {
      stepCombo += 1;
      gained += 10 * stepCombo;
      steps += 1;
    }
    if (gained >= gap) return '再对几下就破纪录';
  }

  if (remain > 1 && remain <= 3) return '就差 ' + remain + ' 下';
  return '';
}

module.exports = {
  DIRECTIONS: DIRECTIONS,
  VIRAL_RATE: VIRAL_RATE,
  TIMER_FLOOR: TIMER_FLOOR,
  OPEN_FLOOR: OPEN_FLOOR,
  hitsForLevel: hitsForLevel,
  openingWindowMs: openingWindowMs,
  closingWindowMs: closingWindowMs,
  windowMs: windowMs,
  pointsForHit: pointsForHit,
  pickDirection: pickDirection,
  nearMissLine: nearMissLine,
};
