// Visual particle effects, explosions, tracers, tire skidmarks, and floating popups.

export function createEffectsState() {
  return {
    particles: [],
    skids: [],
    popups: [],
    flashes: [],
    shockwaves: [],
  };
}

export function spawnParticle(fx, p) {
  if (fx.particles.length > 420) fx.particles.shift();
  fx.particles.push({
    x: p.x,
    y: p.y,
    vx: p.vx || 0,
    vy: p.vy || 0,
    size: p.size || 4,
    grow: p.grow || 0,
    life: p.life || 0.5,
    maxLife: p.life || 0.5,
    color: p.color || '#ffffff',
    alpha: p.alpha ?? 1,
    drag: p.drag ?? 2.4,
  });
}

export function addSkidmark(fx, x1, y1, x2, y2, alpha = 0.34, width = 4) {
  if (fx.skids.length > 360) fx.skids.shift();
  fx.skids.push({ x1, y1, x2, y2, alpha, width, life: 16 });
}

export function addPopup(fx, x, y, text, color = '#6df5a0') {
  fx.popups.push({ x, y, text, color, life: 1.55, maxLife: 1.55 });
}

export function spawnMuzzleFlash(fx, x, y, angle, color = '#ffe57f') {
  fx.flashes.push({ x, y, angle, color, life: 0.065, maxLife: 0.065 });
  for (let i = 0; i < 4; i++) {
    const spread = (Math.random() - 0.5) * 0.6;
    const spd = 80 + Math.random() * 140;
    spawnParticle(fx, {
      x,
      y,
      vx: Math.cos(angle + spread) * spd,
      vy: Math.sin(angle + spread) * spd,
      size: 2.5 + Math.random() * 2,
      life: 0.14 + Math.random() * 0.1,
      color: i % 2 === 0 ? '#fff2b2' : '#ff9f43',
      drag: 6,
    });
  }
}

export function spawnHitSparks(fx, x, y, color = '#ffd166', count = 7) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 65 + Math.random() * 165;
    spawnParticle(fx, {
      x,
      y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      size: 2 + Math.random() * 2.5,
      life: 0.22 + Math.random() * 0.18,
      color,
      drag: 4.2,
    });
  }
}

export function spawnSmoke(fx, x, y, dark = false) {
  spawnParticle(fx, {
    x: x + (Math.random() - 0.5) * 8,
    y: y + (Math.random() - 0.5) * 8,
    vx: (Math.random() - 0.5) * 26,
    vy: (Math.random() - 0.5) * 26 - 10,
    size: 5 + Math.random() * 5,
    grow: 14,
    life: 0.55 + Math.random() * 0.35,
    color: dark ? '#2f3540' : '#d7dee6',
    alpha: dark ? 0.55 : 0.38,
    drag: 1.5,
  });
}

export function spawnExplosion(fx, x, y, radius = 92) {
  fx.shockwaves.push({ x, y, r: 8, maxR: radius, life: 0.42, maxLife: 0.42 });
  for (let i = 0; i < 34; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 60 + Math.random() * 260;
    const hot = i < 18;
    spawnParticle(fx, {
      x,
      y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      size: hot ? 8 + Math.random() * 10 : 12 + Math.random() * 14,
      grow: hot ? -4 : 18,
      life: hot ? 0.35 + Math.random() * 0.25 : 0.75 + Math.random() * 0.55,
      color: hot ? (i % 2 === 0 ? '#ffdd59' : '#ff5e3a') : '#2b303a',
      alpha: hot ? 0.95 : 0.65,
      drag: hot ? 3.2 : 2.1,
    });
  }
}

export function updateEffects(fx, dt) {
  for (let i = fx.particles.length - 1; i >= 0; i--) {
    const p = fx.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      fx.particles.splice(i, 1);
      continue;
    }
    const damp = Math.exp(-p.drag * dt);
    p.vx *= damp;
    p.vy *= damp;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.size = Math.max(0.5, p.size + p.grow * dt);
  }

  for (let i = fx.skids.length - 1; i >= 0; i--) {
    fx.skids[i].life -= dt;
    if (fx.skids[i].life <= 0) fx.skids.splice(i, 1);
  }

  for (let i = fx.popups.length - 1; i >= 0; i--) {
    const pop = fx.popups[i];
    pop.life -= dt;
    pop.y -= 28 * dt;
    if (pop.life <= 0) fx.popups.splice(i, 1);
  }

  for (let i = fx.flashes.length - 1; i >= 0; i--) {
    fx.flashes[i].life -= dt;
    if (fx.flashes[i].life <= 0) fx.flashes.splice(i, 1);
  }

  for (let i = fx.shockwaves.length - 1; i >= 0; i--) {
    const sw = fx.shockwaves[i];
    sw.life -= dt;
    if (sw.life <= 0) {
      fx.shockwaves.splice(i, 1);
      continue;
    }
    const t = 1 - sw.life / sw.maxLife;
    sw.r = sw.maxR * (0.15 + 0.85 * (1 - (1 - t) * (1 - t)));
  }
}
