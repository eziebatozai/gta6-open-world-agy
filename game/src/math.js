// Deterministic PRNG, 2D geometry, angle math, and collision utilities.

export function createRng(seed = 20261123) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

export function distSq(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function angleDiff(from, to) {
  return wrapAngle(to - from);
}

export function moveAngle(current, target, maxDelta) {
  const diff = angleDiff(current, target);
  if (Math.abs(diff) <= maxDelta) return target;
  return wrapAngle(current + Math.sign(diff) * maxDelta);
}

export function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function circleRectPush(cx, cy, radius, rect) {
  const nearestX = clamp(cx, rect.x, rect.x + rect.w);
  const nearestY = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  const d2 = dx * dx + dy * dy;
  if (d2 >= radius * radius) return null;

  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    const push = radius - d;
    return { nx: dx / d, ny: dy / d, overlap: push };
  }

  // Center is inside rect; push along minimum penetration axis.
  const left = cx - rect.x;
  const right = rect.x + rect.w - cx;
  const top = cy - rect.y;
  const bottom = rect.y + rect.h - cy;
  const minPen = Math.min(left, right, top, bottom);
  if (minPen === left) return { nx: -1, ny: 0, overlap: left + radius };
  if (minPen === right) return { nx: 1, ny: 0, overlap: right + radius };
  if (minPen === top) return { nx: 0, ny: -1, overlap: top + radius };
  return { nx: 0, ny: 1, overlap: bottom + radius };
}

export function segmentIntersectsRect(x1, y1, x2, y2, r) {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const checks = [
    [-dx, x1 - r.x],
    [dx, r.x + r.w - x1],
    [-dy, y1 - r.y],
    [dy, r.y + r.h - y1],
  ];
  for (const [p, q] of checks) {
    if (Math.abs(p) < 1e-8) {
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return t0 <= t1;
}

export function pointToRotatedRect(px, py, rx, ry, angle, halfLen, halfWid) {
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const dx = px - rx;
  const dy = py - ry;
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return {
    inside: Math.abs(lx) <= halfLen && Math.abs(ly) <= halfWid,
    lx,
    ly,
  };
}
