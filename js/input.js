/**
 * 滑动识别。小于阈值的移动当成点击，斜向分不出主轴就丢掉。
 */

const SWIPE_THRESHOLD = 36;

function isNum(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function classifySwipe(dx, dy, threshold) {
  const limit = typeof threshold === 'number' ? threshold : SWIPE_THRESHOLD;
  if (!isNum(dx) || !isNum(dy)) return null;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < limit && ay < limit) return null;
  if (ax === ay) return null;
  if (ax > ay) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

function createPointer(threshold) {
  const limit = typeof threshold === 'number' ? threshold : SWIPE_THRESHOLD;
  let active = null;

  return {
    down: function (x, y) {
      if (!isNum(x) || !isNum(y)) return;
      active = { x: x, y: y, sx: x, sy: y };
    },
    move: function (x, y) {
      if (!active || !isNum(x) || !isNum(y)) return;
      active.x = x;
      active.y = y;
    },
    up: function (x, y) {
      if (!active) return null;
      const endX = isNum(x) ? x : active.x;
      const endY = isNum(y) ? y : active.y;
      const dx = endX - active.sx;
      const dy = endY - active.sy;
      active = null;
      const direction = classifySwipe(dx, dy, limit);
      if (direction) {
        return { type: 'swipe', direction: direction, dx: dx, dy: dy, x: endX, y: endY };
      }
      if (Math.abs(dx) < limit && Math.abs(dy) < limit) {
        return { type: 'tap', x: endX, y: endY, dx: dx, dy: dy };
      }
      return { type: 'ignore', x: endX, y: endY, dx: dx, dy: dy };
    },
    cancel: function () {
      active = null;
    },
  };
}

function pointFromTouch(event) {
  if (!event) return null;
  const touch = (event.changedTouches && event.changedTouches[0])
    || (event.touches && event.touches[0]);
  if (!touch) return null;
  const x = isNum(touch.clientX) ? touch.clientX : touch.x;
  const y = isNum(touch.clientY) ? touch.clientY : touch.y;
  if (!isNum(x) || !isNum(y)) return null;
  return { x: x, y: y };
}

module.exports = {
  SWIPE_THRESHOLD: SWIPE_THRESHOLD,
  classifySwipe: classifySwipe,
  createPointer: createPointer,
  pointFromTouch: pointFromTouch,
};
