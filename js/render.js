/**
 * 全部界面画在 canvas 上。颜色：底 #0B0B12，强调色粉 / 紫 / 薄荷 / 黄。
 */

const BG = '#0B0B12';
const TEXT = '#F4F1FF';
const DIM = 'rgba(244, 241, 255, 0.62)';
const PINK = '#FF2E93';
const PURPLE = '#7C5CFF';
const MINT = '#3DFFB0';
const GOLD = '#FFE14A';

const DIR_COLOR = {
  up: MINT,
  down: PINK,
  left: PURPLE,
  right: GOLD,
};

function font(size, weight) {
  return weight + ' ' + Math.round(size) + 'px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
}

function unit(layout) {
  return Math.max(0.82, Math.min(layout.w / 390, 1.2));
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function cardRect(layout) {
  const w = Math.min(layout.w * 0.78, 420);
  const h = Math.min(layout.h * 0.4, 440);
  return {
    x: (layout.w - w) / 2,
    y: Math.max(layout.safeTop + 78, layout.h * 0.28),
    w: w,
    h: h,
  };
}

function buttonBlockTop(layout) {
  const block = 64 + 16 + 48;
  return Math.max(layout.h * 0.56, Math.min(layout.h * 0.66, layout.h - block - 28));
}

function primaryRect(layout) {
  const w = Math.min(layout.w - 48, 440);
  return {
    id: 'replay',
    x: (layout.w - w) / 2,
    y: buttonBlockTop(layout),
    w: w,
    h: 64,
    label: '再刷一下',
  };
}

function secondaryRect(layout) {
  const primary = primaryRect(layout);
  return {
    id: 'next',
    x: primary.x,
    y: primary.y + primary.h + 16,
    w: primary.w,
    h: 48,
    label: '下一关',
  };
}

function paintBackground(ctx, layout) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, layout.w, layout.h);
  const glow = ctx.createRadialGradient(
    layout.w * 0.5,
    layout.h * 0.3,
    16,
    layout.w * 0.5,
    layout.h * 0.42,
    layout.h * 0.72
  );
  glow.addColorStop(0, 'rgba(124, 92, 255, 0.22)');
  glow.addColorStop(0.5, 'rgba(255, 46, 147, 0.07)');
  glow.addColorStop(1, 'rgba(11, 11, 18, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, layout.w, layout.h);
}

function drawTimer(ctx, rect, ratio, color) {
  const y = rect.y - 20;
  const h = 8;
  const clamped = ratio < 0 ? 0 : ratio > 1 ? 1 : ratio;
  roundRect(ctx, rect.x, y, rect.w, h, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();
  const fillW = Math.max(clamped > 0 ? 8 : 0, rect.w * clamped);
  if (fillW <= 0) return;
  roundRect(ctx, rect.x, y, Math.min(rect.w, fillW), h, 4);
  ctx.fillStyle = clamped < 0.28 ? PINK : color;
  ctx.fill();
}

function drawCard(ctx, layout, state) {
  const rect = cardRect(layout);
  const card = state.card;
  if (!card) return rect;
  const color = DIR_COLOR[card.id] || TEXT;
  let ox = 0;
  let oy = 0;
  let alpha = 1;
  let scale = 1;
  const pop = Math.min(1, card.age / 90);
  scale = 0.94 + 0.06 * pop;

  if (state.scene === 'fly') {
    const t = Math.min(1, state.sceneT / 160);
    const ease = t * t;
    const dist = Math.max(layout.w, layout.h) * 1.05;
    if (card.id === 'left') ox = -dist * ease;
    if (card.id === 'right') ox = dist * ease;
    if (card.id === 'up') oy = -dist * ease;
    if (card.id === 'down') oy = dist * ease;
    alpha = 1 - t;
  } else if (state.scene === 'die') {
    const k = 1 - Math.min(1, state.sceneT / 280);
    const mag = state.failReason === 'wrong' ? 12 : 5;
    ox = Math.sin(state.sceneT / 16) * mag * k;
    if (state.failReason === 'timeout') alpha = Math.max(0.25, k);
  }

  const u = unit(layout);
  ctx.save();
  ctx.translate(rect.x + rect.w / 2 + ox, rect.y + rect.h / 2 + oy);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  ctx.translate(-rect.w / 2, -rect.h / 2);

  roundRect(ctx, 0, 0, rect.w, rect.h, 36);
  ctx.fillStyle = card.viral ? '#241808' : '#14141E';
  ctx.shadowColor = card.viral ? 'rgba(255, 225, 74, 0.45)' : 'rgba(124, 92, 255, 0.35)';
  ctx.shadowBlur = 28;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 6;
  ctx.strokeStyle = card.viral ? GOLD : color;
  ctx.stroke();

  if (card.viral) {
    ctx.fillStyle = GOLD;
    ctx.font = font(16 * u, 700);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('爆款', rect.w / 2, 36);
  }

  ctx.fillStyle = color;
  ctx.font = font(rect.h * 0.42, 800);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(card.arrow, rect.w / 2, rect.h * 0.46);
  ctx.fillStyle = TEXT;
  ctx.font = font(28 * u, 700);
  ctx.fillText(card.cue, rect.w / 2, rect.h * 0.78);
  ctx.restore();
  return rect;
}

function drawHud(ctx, layout, state) {
  const u = unit(layout);
  const top = layout.safeTop + 22;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = DIM;
  ctx.font = font(15 * u, 600);
  ctx.fillText('第 ' + state.level + ' 关', 24, top);
  ctx.textAlign = 'right';
  ctx.fillStyle = TEXT;
  ctx.font = font(28 * u, 800);
  ctx.fillText(String(state.score), layout.w - 24, top);
  if (state.combo >= 2) {
    ctx.fillStyle = MINT;
    ctx.font = font(16 * u, 700);
    ctx.fillText('连击 ' + state.combo, layout.w - 24, top + 30);
  }
  const rect = cardRect(layout);
  ctx.textAlign = 'center';
  ctx.fillStyle = DIM;
  ctx.font = font(14 * u, 600);
  ctx.fillText(state.hitsDone + ' / ' + state.hitsRequired, layout.w / 2, rect.y + rect.h + 28);
}

function drawFloater(ctx, layout, state) {
  if (!state.floater) return;
  const rect = cardRect(layout);
  const p = state.floater.life <= 0 ? 1 : state.floater.age / state.floater.life;
  ctx.globalAlpha = Math.max(0, 1 - p);
  ctx.fillStyle = state.floater.color;
  ctx.font = font(28 * unit(layout), 800);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(state.floater.text, layout.w / 2, rect.y - 36 - p * 24);
  ctx.globalAlpha = 1;
}

function drawButton(ctx, rect, primary) {
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, rect.h / 2);
  if (primary) {
    ctx.fillStyle = PINK;
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
  } else {
    ctx.fillStyle = 'rgba(124, 92, 255, 0.12)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = PURPLE;
    ctx.stroke();
    ctx.fillStyle = '#E4DCFF';
  }
  ctx.font = font(primary ? 24 : 18, 800);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(rect.label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
}

function pushHotspot(state, rect) {
  state.hotspots.push({
    id: rect.id,
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
  });
}

function drawStart(ctx, layout, state) {
  const u = unit(layout);
  const cx = layout.w / 2;
  const cy = layout.h * 0.38;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = TEXT;
  ctx.font = font(Math.min(56, 48 * u), 800);
  ctx.fillText('再刷一下', cx, cy);
  ctx.fillStyle = DIM;
  ctx.font = font(18 * u, 500);
  ctx.fillText('看箭头，往那边滑', cx, cy + 52);
  ctx.fillStyle = PURPLE;
  ctx.font = font(18 * u, 700);
  ctx.fillText('第 ' + state.level + ' 关', cx, cy + 104);
  ctx.fillStyle = GOLD;
  ctx.fillText('最高 ' + state.bestScore, cx, cy + 136);
  if (state.streak >= 2) {
    ctx.fillStyle = MINT;
    ctx.font = font(14 * u, 600);
    ctx.fillText('连续 ' + state.streak + ' 天', cx, cy + 170);
  }
  const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(state.clock / 260));
  ctx.globalAlpha = 0.55 + 0.45 * pulse;
  ctx.fillStyle = PINK;
  ctx.font = font(22 * u, 800);
  ctx.fillText('点击开始', cx, layout.h * 0.78);
  ctx.globalAlpha = 1;
  state.hotspots.push({ id: 'start', x: 0, y: 0, w: layout.w, h: layout.h });
}

function drawNickname(ctx, layout, state, y) {
  if (!state.nickname) return;
  ctx.fillStyle = DIM;
  ctx.font = font(14 * unit(layout), 500);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(state.nickname, layout.w / 2, y);
}

function drawFail(ctx, layout, state) {
  const u = unit(layout);
  const cx = layout.w / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = TEXT;
  ctx.font = font(44 * u, 800);
  ctx.fillText('断了', cx, layout.h * 0.2);
  ctx.fillStyle = DIM;
  ctx.font = font(16 * u, 500);
  ctx.fillText(state.failReason === 'timeout' ? '超时' : '滑反了', cx, layout.h * 0.2 + 40);
  ctx.fillStyle = TEXT;
  ctx.font = font(76 * u, 800);
  ctx.fillText(String(state.score), cx, layout.h * 0.38);
  ctx.fillStyle = PURPLE;
  ctx.font = font(18 * u, 700);
  ctx.fillText('最高连击 ' + state.bestCombo, cx, layout.h * 0.38 + 58);
  if (state.nearMiss) {
    ctx.fillStyle = GOLD;
    ctx.font = font(22 * u, 800);
    ctx.fillText(state.nearMiss, cx, layout.h * 0.38 + 100);
  }
  drawNickname(ctx, layout, state, primaryRect(layout).y - 28);
  const button = primaryRect(layout);
  drawButton(ctx, button, true);
  pushHotspot(state, button);
  if (state.frontier > state.level) {
    const jump = secondaryRect(layout);
    jump.id = 'frontier';
    jump.label = '去第 ' + state.frontier + ' 关';
    drawButton(ctx, jump, false);
    pushHotspot(state, jump);
  }
}

function drawClear(ctx, layout, state) {
  const u = unit(layout);
  const cx = layout.w / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = MINT;
  ctx.font = font(48 * u, 800);
  ctx.fillText('过了', cx, layout.h * 0.22);
  ctx.fillStyle = DIM;
  ctx.font = font(16 * u, 600);
  ctx.fillText('第 ' + state.level + ' 关', cx, layout.h * 0.22 + 44);
  ctx.fillStyle = TEXT;
  ctx.font = font(64 * u, 800);
  ctx.fillText(String(state.score), cx, layout.h * 0.4);
  drawNickname(ctx, layout, state, primaryRect(layout).y - 28);
  const primary = primaryRect(layout);
  const secondary = secondaryRect(layout);
  drawButton(ctx, primary, true);
  drawButton(ctx, secondary, false);
  pushHotspot(state, primary);
  pushHotspot(state, secondary);
}

function drawCelebrate(ctx, layout, state) {
  const u = unit(layout);
  const t = Math.min(1, state.sceneT / 280);
  const scale = 0.86 + 0.14 * t;
  ctx.save();
  ctx.translate(layout.w / 2, layout.h * 0.4);
  ctx.scale(scale, scale);
  ctx.fillStyle = MINT;
  ctx.font = font(64 * u, 800);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('过了', 0, 0);
  ctx.fillStyle = TEXT;
  ctx.font = font(28 * u, 700);
  ctx.fillText(String(state.score), 0, 64);
  ctx.restore();
}

function drawParticles(ctx, state) {
  const list = state.particles;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const k = p.life <= 0 ? 1 : p.age / p.life;
    ctx.globalAlpha = Math.max(0, 1 - k);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFlash(ctx, layout, state) {
  if (state.flash <= 0) return;
  ctx.globalAlpha = state.flash * 0.28;
  ctx.fillStyle = state.flashColor;
  ctx.fillRect(0, 0, layout.w, layout.h);
  ctx.globalAlpha = 1;
}

function draw(ctx, state, layout) {
  const dpr = layout.dpr || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, layout.w, layout.h);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  state.hotspots.length = 0;
  paintBackground(ctx, layout);

  if (state.scene === 'start') {
    drawStart(ctx, layout, state);
  } else if (state.scene === 'celebrate') {
    drawCelebrate(ctx, layout, state);
  } else if (state.scene === 'clear') {
    drawClear(ctx, layout, state);
  } else if (state.scene === 'fail') {
    drawFail(ctx, layout, state);
  } else {
    drawHud(ctx, layout, state);
    const rect = cardRect(layout);
    const color = state.card ? (DIR_COLOR[state.card.id] || GOLD) : GOLD;
    const ratio = state.windowTotal > 0 ? state.timeLeft / state.windowTotal : 0;
    drawTimer(ctx, rect, ratio, state.card && state.card.viral ? GOLD : color);
    drawCard(ctx, layout, state);
    drawFloater(ctx, layout, state);
  }

  drawParticles(ctx, state);
  drawFlash(ctx, layout, state);
}

module.exports = {
  draw: draw,
  cardRect: cardRect,
  primaryRect: primaryRect,
  secondaryRect: secondaryRect,
};
