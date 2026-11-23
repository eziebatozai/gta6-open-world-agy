// Palma Rey: Suncoast Syndicate — Browser bootstrap, canvas sizing, and animation loop.

import { InputManager } from './input.js';
import { createGameEngine } from './engine.js';
import { renderWorld } from './renderWorld.js';
import { renderHudAndMenus } from './renderHud.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const ctx = canvas.getContext('2d');

const input = new InputManager(canvas);
const engine = createGameEngine(input, (msg) => {
  if (statusEl) statusEl.textContent = msg;
});

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  engine.state.viewW = w;
  engine.state.viewH = h;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let lastTs = performance.now();

function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
  lastTs = now;

  engine.update(dt);
  renderWorld(ctx, engine.state, engine.state.viewW, engine.state.viewH);
  renderHudAndMenus(ctx, engine.state, engine.state.viewW, engine.state.viewH);
  input.endFrame();

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
