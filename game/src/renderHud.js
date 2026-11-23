// HUD, live vector Minimap with GPS & blips, speedometer, dialogue, Start Screen, Pause & Armory menus.

import { CHARACTERS, PALETTE, WEAPONS, WORLD } from './config.js';
import { getDistrictAt } from './city.js';
import { clamp, dist } from './math.js';
import { getNextAvailableMission, MISSION_CATALOG } from './missions.js';
import { roundRect } from './renderWorld.js';
import { hasSavedGame } from './storage.js';

export function renderHudAndMenus(ctx, state, viewW, viewH) {
  state.uiButtons = [];

  if (state.screen === 'title') {
    drawTitleScreen(ctx, state, viewW, viewH);
    return;
  }

  // Active gameplay HUD
  drawMinimap(ctx, state, viewW, viewH);
  drawTopRightStatus(ctx, state, viewW);
  drawTopLeftMissionCard(ctx, state);
  drawBottomRightPanel(ctx, state, viewW, viewH);
  drawOffscreenMissionArrow(ctx, state, viewW, viewH);
  drawDialogueBar(ctx, state, viewW, viewH);
  drawBannerAndPrompt(ctx, state, viewW, viewH);
  drawAimReticle(ctx, state);

  if (state.screen === 'armory') {
    drawArmoryMenu(ctx, state, viewW, viewH);
  } else if (state.screen === 'paused') {
    drawPauseMenu(ctx, state, viewW, viewH);
  } else if (state.screen === 'wasted' || state.screen === 'busted') {
    drawOutcomeOverlay(ctx, state, viewW, viewH);
  }
}

function registerButton(state, id, x, y, w, h) {
  state.uiButtons.push({ id, x, y, w, h });
}

function drawMinimap(ctx, state, viewW, viewH) {
  const mapW = 232;
  const mapH = 166;
  const mx = 18;
  const my = viewH - mapH - 42;
  const sx = mapW / WORLD.width;
  const sy = mapH / WORLD.height;

  ctx.save();
  // Dark glass backing
  ctx.fillStyle = 'rgba(11, 18, 28, 0.88)';
  roundRect(ctx, mx - 5, my - 5, mapW + 10, mapH + 34, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(47, 214, 196, 0.72)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Clip map canvas
  ctx.save();
  roundRect(ctx, mx, my, mapW, mapH, 8);
  ctx.clip();

  // Land, beach, ocean & harbor
  ctx.fillStyle = '#25313f';
  ctx.fillRect(mx, my, mapW, mapH);
  ctx.fillStyle = '#c8ae7b';
  ctx.fillRect(mx + WORLD.beachX * sx, my, (WORLD.oceanX - WORLD.beachX) * sx, mapH);
  ctx.fillStyle = '#146f91';
  ctx.fillRect(mx + WORLD.oceanX * sx, my, mapW - WORLD.oceanX * sx, mapH);
  ctx.fillStyle = '#12506d';
  ctx.fillRect(mx, my + WORLD.harborY * sy, WORLD.harborX * sx, mapH - WORLD.harborY * sy);

  // Buildings footprint
  ctx.fillStyle = '#405166';
  for (const b of state.city.buildings) {
    ctx.fillRect(mx + b.x * sx, my + b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
  }

  // Roads
  ctx.fillStyle = '#6f7e91';
  const rw = Math.max(4, WORLD.roadWidth * sx);
  for (const rx of WORLD.roadX) {
    const hEnd = rx < WORLD.harborX ? WORLD.harborY : WORLD.height;
    ctx.fillRect(mx + rx * sx - rw / 2, my, rw, hEnd * sy);
  }
  for (const ry of WORLD.roadY) {
    const xStart = ry >= WORLD.harborY ? WORLD.harborX : 0;
    ctx.fillRect(mx + xStart * sx, my + ry * sy - rw / 2, (2824 - xStart) * sx, rw);
  }

  // Shops (respray green, armory orange)
  for (const shop of state.city.shops) {
    ctx.fillStyle = shop.color;
    ctx.beginPath();
    ctx.arc(mx + shop.x * sx, my + shop.y * sy, 3.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // GPS dashed line to active objective or next mission start
  const goal = state.missions.active?.marker || getNextAvailableMission(state.missions)?.startPoint;
  if (goal) {
    ctx.strokeStyle = state.missions.active?.marker?.color || '#ffd166';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(mx + state.player.x * sx, my + state.player.y * sy);
    ctx.lineTo(mx + goal.x * sx, my + goal.y * sy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Pulsing destination dot
    const pulse = 4 + Math.sin(state.time * 7) * 1.6;
    ctx.fillStyle = state.missions.active?.marker?.color || '#ffd166';
    ctx.beginPath();
    ctx.arc(mx + goal.x * sx, my + goal.y * sy, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0d1620';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // Hostile Cartel blips
  ctx.fillStyle = '#ff4757';
  for (const p of state.peds) {
    if (!p.alive || (p.kind !== 'cartel' && p.kind !== 'boss')) continue;
    ctx.beginPath();
    ctx.arc(mx + p.x * sx, my + p.y * sy, p.kind === 'boss' ? 4.5 : 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Police blips (flashing red & blue!)
  const copColor = Math.sin(state.time * 12) >= 0 ? '#ff385c' : '#3ca0ff';
  ctx.fillStyle = copColor;
  for (const v of state.vehicles) {
    if (v.driver !== 'police' || v.wrecked) continue;
    ctx.beginPath();
    ctx.arc(mx + v.x * sx, my + v.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (state.police.stars > 0) {
    for (const p of state.peds) {
      if (!p.alive || p.kind !== 'police') continue;
      ctx.beginPath();
      ctx.arc(mx + p.x * sx, my + p.y * sy, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Player directional arrow + subtle radar cone
  const px = mx + state.player.x * sx;
  const py = my + state.player.y * sy;
  const heading = state.player.vehicle ? state.player.vehicle.angle : state.player.angle;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(heading);
  ctx.fillStyle = 'rgba(47, 214, 196, 0.22)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, 26, -0.45, 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0d1620';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -4.5);
  ctx.lineTo(-2.5, 0);
  ctx.lineTo(-5, 4.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Compass North badge
  ctx.fillStyle = 'rgba(11, 18, 28, 0.85)';
  ctx.beginPath();
  ctx.arc(mx + mapW - 14, my + 14, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 10px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', mx + mapW - 14, my + 17.5);

  ctx.restore(); // end clip

  // District bar at bottom of minimap
  const district = getDistrictAt(state.player.x, state.player.y);
  ctx.fillStyle = district.color;
  ctx.beginPath();
  ctx.arc(mx + 9, my + mapH + 15, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2f7fc';
  ctx.font = 'bold 11px "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(district.name.toUpperCase(), mx + 19, my + mapH + 19);

  ctx.fillStyle = '#92a8bf';
  ctx.font = 'bold 11px "Segoe UI", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`JOBS ${state.missions.completedCount}/${MISSION_CATALOG.length}`, mx + mapW - 4, my + mapH + 19);
  ctx.restore();
}

function drawTopRightStatus(ctx, state, viewW) {
  const rx = viewW - 18;
  const topY = 16;
  const cardW = 248;

  ctx.save();
  // Translucent dark status card
  ctx.fillStyle = 'rgba(11, 18, 28, 0.86)';
  roundRect(ctx, rx - cardW, topY, cardW, 154, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Cash counter
  ctx.font = 'bold 26px "Segoe UI", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#62f2a6';
  ctx.fillText(`$${Math.floor(state.player.cash).toLocaleString()}`, rx - 14, topY + 32);

  // 5 Wanted Stars
  const stars = state.police.stars;
  const flashHide = state.police.evading && Math.floor(state.time * 6) % 2 === 0;
  for (let i = 0; i < 5; i++) {
    const sx = rx - 14 - (4 - i) * 28 - 10;
    const sy = topY + 54;
    const active = i < stars && !flashHide;
    const starColor = active
      ? (Math.sin(state.time * 10 + i) > 0 ? '#ffd166' : '#ff5e6c')
      : 'rgba(255, 255, 255, 0.16)';
    drawStar(ctx, sx, sy, 5, 11, 5, starColor, active ? '#0d1620' : null);
  }

  // Health & Armor bars
  const barX = rx - cardW + 14;
  const barW = cardW - 28;
  drawBar(ctx, barX, topY + 74, barW, 11, state.player.hp / state.player.maxHp, '#ff5263', '#3b1c24', 'HP');
  drawBar(ctx, barX, topY + 91, barW, 9, state.player.armor / state.player.maxArmor, '#48c6ef', '#1a2f40', 'ARMOR');

  // Active Weapon readout + 4 weapon slot pills
  const wpn = WEAPONS[state.player.weaponIndex] || WEAPONS[0];
  const ammoTxt = wpn.unlimited ? 'MELEE' : `${state.player.ammo[wpn.id] ?? 0} RDS`;
  ctx.font = 'bold 12px "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(wpn.name.toUpperCase(), barX, topY + 119);
  ctx.textAlign = 'right';
  ctx.fillStyle = wpn.color;
  ctx.fillText(ammoTxt, rx - 14, topY + 119);

  const pillW = (barW - 12) / 4;
  for (let i = 0; i < WEAPONS.length; i++) {
    const w = WEAPONS[i];
    const unlocked = state.player.unlockedWeapons.has(w.id);
    const selected = state.player.weaponIndex === i;
    const px = barX + i * (pillW + 4);
    const py = topY + 127;
    ctx.fillStyle = selected ? w.color : unlocked ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)';
    roundRect(ctx, px, py, pillW, 18, 4);
    ctx.fill();
    ctx.fillStyle = selected ? '#0b1420' : unlocked ? '#dce8f5' : '#58687a';
    ctx.font = 'bold 9px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${w.slot} ${w.short}`, px + pillW / 2, py + 12);
  }
  ctx.restore();
}

function drawTopLeftMissionCard(ctx, state) {
  const x = 18;
  const y = 16;
  const w = 365;

  const active = state.missions.active;
  const next = !active ? getNextAvailableMission(state.missions) : null;
  let title = 'FREE ROAM — PALMA REY';
  let sub = 'Explore the suncoast, collect stashes, or challenge PRPD.';
  let accent = '#2fd6c4';
  let targetPos = null;

  if (active) {
    title = `MISSION ${active.index + 1}: ${active.title.toUpperCase()}`;
    sub = active.objective;
    accent = active.marker?.color || '#ffd166';
    targetPos = active.marker;
  } else if (next) {
    title = `NEXT STORY JOB: ${next.title.toUpperCase()}`;
    sub = `Go to ${next.startPoint.name} (gold marker) — Reward $${next.reward.toLocaleString()}`;
    accent = '#ffd166';
    targetPos = next.startPoint;
  } else if (state.missions.campaignComplete) {
    title = 'SUNCOAST CHAMPION — ALL 5 MISSIONS COMPLETE';
    sub = 'Palma Rey is yours! Enjoy free roam, chases & hidden cash stashes.';
    accent = '#62f2a6';
  }

  ctx.save();
  ctx.fillStyle = 'rgba(11, 18, 28, 0.84)';
  roundRect(ctx, x, y, w, 66, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Colored left accent stripe
  ctx.fillStyle = accent;
  roundRect(ctx, x + 2, y + 6, 5, 54, 3);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.font = 'bold 12px "Segoe UI", sans-serif';
  ctx.fillStyle = accent;
  ctx.fillText(title, x + 18, y + 24);

  if (targetPos) {
    const meters = Math.round(dist(state.player.x, state.player.y, targetPos.x, targetPos.y) / 8);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#c4d4e6';
    ctx.fillText(`${meters}m`, x + w - 12, y + 24);
  }

  ctx.textAlign = 'left';
  ctx.font = '600 13px "Segoe UI", sans-serif';
  ctx.fillStyle = '#eef4fa';
  ctx.fillText(truncateText(ctx, sub, w - 30), x + 18, y + 48);

  // Wanted Pursuit / Busted alert pill directly below objective card
  if (state.police.stars > 0) {
    const wy = y + 76;
    const isBusted = state.player.bustedProgress > 0.05;
    const alertColor = isBusted ? '#ff2e4c' : state.police.evading ? '#48c6ef' : '#ff5e6c';
    ctx.fillStyle = 'rgba(16, 12, 22, 0.86)';
    roundRect(ctx, x, wy, 286, 30, 8);
    ctx.fill();
    ctx.strokeStyle = alertColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = alertColor;
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    const label = isBusted
      ? `ARREST IN PROGRESS — MOVE! (${Math.round(state.player.bustedProgress * 100)}%)`
      : state.police.evading
        ? 'EVADING PRPD — STAY OUT OF SIGHT'
        : `PRPD PURSUIT • ${state.police.lastReason.toUpperCase() || 'ACTIVE CHASE'}`;
    ctx.fillText(label, x + 12, wy + 19);
  }
  ctx.restore();
}

function drawBottomRightPanel(ctx, state, viewW, viewH) {
  const v = state.player.vehicle;
  ctx.save();
  if (v) {
    const w = 248;
    const h = 96;
    const x = viewW - w - 18;
    const y = viewH - h - 18;

    ctx.fillStyle = 'rgba(11, 18, 28, 0.88)';
    roundRect(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(47, 214, 196, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const mph = Math.round((v.speed / 500) * 118);
    ctx.textAlign = 'right';
    ctx.font = 'bold 30px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${mph}`, x + w - 48, y + 36);
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.fillStyle = '#2fd6c4';
    ctx.fillText('MPH', x + w - 14, y + 36);

    ctx.textAlign = 'left';
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(v.spec.name.toUpperCase(), x + 14, y + 23);
    ctx.fillStyle = '#9bb0c7';
    ctx.font = '600 10px "Segoe UI", sans-serif';
    ctx.fillText('[F] Exit • [Space] Drift', x + 14, y + 40);

    // Speed RPM bar & Vehicle HP bar
    drawBar(ctx, x + 14, y + 52, w - 28, 8, clamp(v.speed / v.spec.maxSpeed, 0, 1), '#2fd6c4', '#1b2c38', '');
    drawBar(ctx, x + 14, y + 68, w - 28, 10, clamp(v.hp / v.maxHp, 0, 1), '#62f2a6', '#1e2c26', 'VEHICLE');
  } else {
    const w = 270;
    const h = 42;
    const x = viewW - w - 18;
    const y = viewH - h - 18;
    ctx.fillStyle = 'rgba(11, 18, 28, 0.78)';
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.font = '600 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#dce8f5';
    ctx.fillText('[WASD] Move  [F] Steal Car  [Click] Fire  [P] Pause', x + w / 2, y + 25);
  }
  ctx.restore();
}

function drawOffscreenMissionArrow(ctx, state, viewW, viewH) {
  const goal = state.missions.active?.marker || getNextAvailableMission(state.missions)?.startPoint;
  if (!goal) return;
  const sx = goal.x - (state.camera.x - viewW / 2);
  const sy = goal.y - (state.camera.y - viewH / 2);
  if (sx > 60 && sx < viewW - 60 && sy > 60 && sy < viewH - 60) return;

  const angle = Math.atan2(sy - viewH / 2, sx - viewW / 2);
  const pad = 48;
  const cx = clamp(viewW / 2 + Math.cos(angle) * (viewW * 0.44), pad, viewW - pad);
  const cy = clamp(viewH / 2 + Math.sin(angle) * (viewH * 0.42), pad + 60, viewH - pad - 40);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = state.missions.active?.marker?.color || '#ffd166';
  ctx.strokeStyle = '#0d1620';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-9, -9);
  ctx.lineTo(-5, 0);
  ctx.lineTo(-9, 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawDialogueBar(ctx, state, viewW, viewH) {
  const dlg = state.dialogue;
  if (!dlg) return;
  const speaker = CHARACTERS[dlg.speaker] || CHARACTERS.tito;
  const w = Math.min(550, viewW - 510);
  if (w < 240) return;
  const textMaxW = w - 76;
  ctx.save();
  ctx.font = '600 13px "Segoe UI", sans-serif';
  const lines = wrapLines(ctx, dlg.text, textMaxW, 2);
  const h = lines.length > 1 ? 74 : 60;
  const x = (viewW - w) / 2;
  const y = viewH - h - 18;

  ctx.fillStyle = 'rgba(10, 16, 26, 0.92)';
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = speaker.color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Stylized avatar badge
  ctx.fillStyle = speaker.color;
  ctx.beginPath();
  ctx.arc(x + 32, y + h / 2, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0d1620';
  ctx.font = 'bold 14px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(speaker.badge, x + 32, y + h / 2 + 1);
  ctx.textBaseline = 'alphabetic';

  ctx.textAlign = 'left';
  ctx.fillStyle = speaker.color;
  ctx.font = 'bold 12px "Segoe UI", sans-serif';
  ctx.fillText(speaker.name.toUpperCase(), x + 62, y + 21);
  ctx.fillStyle = '#f2f7fc';
  ctx.font = '600 13px "Segoe UI", sans-serif';
  lines.forEach((line, idx) => {
    ctx.fillText(line, x + 62, y + 41 + idx * 17);
  });
  ctx.restore();
}

function drawBannerAndPrompt(ctx, state, viewW, viewH) {
  if (state.missions.bannerTimer > 0) {
    const alpha = Math.min(1, state.missions.bannerTimer / 0.6);
    ctx.save();
    ctx.globalAlpha = alpha;
    const bw = 460;
    const bx = (viewW - bw) / 2;
    const by = 88;
    ctx.fillStyle = 'rgba(11, 18, 28, 0.88)';
    roundRect(ctx, bx, by, bw, 66, 12);
    ctx.fill();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = 'bold 20px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(state.missions.bannerTitle, viewW / 2, by + 29);
    ctx.font = '600 13px "Segoe UI", sans-serif';
    ctx.fillStyle = '#eef4fa';
    ctx.fillText(state.missions.bannerSub, viewW / 2, by + 51);
    ctx.restore();
  }

  if (state.promptText) {
    ctx.save();
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    const pw = ctx.measureText(state.promptText).width + 28;
    const px = (viewW - pw) / 2;
    const py = viewH - (state.dialogue ? 116 : 56);
    ctx.fillStyle = 'rgba(11, 18, 28, 0.88)';
    roundRect(ctx, px, py, pw, 30, 15);
    ctx.fill();
    ctx.strokeStyle = '#2fd6c4';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(state.promptText, viewW / 2, py + 19);
    ctx.restore();
  }
}

function drawAimReticle(ctx, state) {
  if (state.screen !== 'playing' || state.player.vehicle) return;
  const mx = state.input.mouseX;
  const my = state.input.mouseY;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.86)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(mx, my, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(mx - 14, my);
  ctx.lineTo(mx - 6, my);
  ctx.moveTo(mx + 6, my);
  ctx.lineTo(mx + 14, my);
  ctx.moveTo(mx, my - 14);
  ctx.lineTo(mx, my - 6);
  ctx.moveTo(mx, my + 6);
  ctx.lineTo(mx, my + 14);
  ctx.stroke();
  ctx.restore();
}

function drawTitleScreen(ctx, state, viewW, viewH) {
  const grad = ctx.createLinearGradient(0, 0, viewW, viewH);
  grad.addColorStop(0, 'rgba(12, 18, 30, 0.72)');
  grad.addColorStop(0.55, 'rgba(16, 26, 40, 0.48)');
  grad.addColorStop(1, 'rgba(255, 94, 120, 0.28)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, viewH);

  const panelW = Math.min(590, viewW - 48);
  const panelH = 394;
  const px = (viewW - panelW) / 2;
  const py = (viewH - panelH) / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(11, 18, 28, 0.88)';
  roundRect(ctx, px, py, panelW, panelH, 18);
  ctx.fill();
  ctx.strokeStyle = '#ff6b9d';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Suncoast accent gradient bar
  const barGrad = ctx.createLinearGradient(px, py, px + panelW, py);
  barGrad.addColorStop(0, '#ff6b7a');
  barGrad.addColorStop(0.5, '#ffd166');
  barGrad.addColorStop(1, '#2fd6c4');
  ctx.fillStyle = barGrad;
  roundRect(ctx, px + 24, py + 22, panelW - 48, 6, 3);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.font = 'bold 46px "Segoe UI", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('PALMA REY', viewW / 2, py + 84);

  ctx.font = 'bold 15px "Segoe UI", sans-serif';
  ctx.fillStyle = '#2fd6c4';
  ctx.fillText('SUNCOAST SYNDICATE  •  OPEN-WORLD CRIME SANDBOX', viewW / 2, py + 110);

  ctx.font = '500 13px "Segoe UI", sans-serif';
  ctx.fillStyle = '#c8d6e5';
  ctx.fillText('Explore 6 coastal districts • Steal 8 vehicle classes • 5-star PRPD chases • 5 story missions', viewW / 2, py + 138);

  const canContinue = hasSavedGame();
  const btnW = 240;
  const btnH = 44;
  const bx = (viewW - btnW) / 2;

  if (canContinue) {
    drawButton(ctx, state, 'continue', bx, py + 166, btnW, btnH, 'CONTINUE SAVE', '#2fd6c4', '#0b1420');
    drawButton(ctx, state, 'new_game', bx, py + 222, btnW, btnH, 'NEW GAME', '#ff5e78', '#ffffff');
  } else {
    drawButton(ctx, state, 'new_game', bx, py + 178, btnW, 48, 'PLAY PALMA REY', '#ff5e78', '#ffffff');
  }

  // Crisp controls footer
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  roundRect(ctx, px + 24, py + 286, panelW - 48, 82, 10);
  ctx.fill();
  ctx.font = 'bold 12px "Segoe UI", sans-serif';
  ctx.fillStyle = '#ffd166';
  ctx.fillText('CONTROLS', viewW / 2, py + 308);
  ctx.font = '500 12px "Segoe UI", sans-serif';
  ctx.fillStyle = '#dce8f5';
  ctx.fillText('WASD / Arrows: Walk & Drive  •  F / E: Steal & Exit Car  •  Space: Handbrake Drift', viewW / 2, py + 332);
  ctx.fillText('Mouse + Click: Aim & Fire  •  1–4: Weapons  •  P / Esc: Pause & Save', viewW / 2, py + 354);
  ctx.restore();
}

function drawPauseMenu(ctx, state, viewW, viewH) {
  ctx.fillStyle = 'rgba(8, 14, 24, 0.72)';
  ctx.fillRect(0, 0, viewW, viewH);

  const w = 360;
  const h = 382;
  const x = (viewW - w) / 2;
  const y = (viewH - h) / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(12, 20, 32, 0.94)';
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = '#2fd6c4';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = 'bold 26px "Segoe UI", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('PAUSED', viewW / 2, y + 46);

  const palName = PALETTE[state.timeMode]?.name || 'Suncoast Day';
  const bx = x + 40;
  const bw = w - 80;
  drawButton(ctx, state, 'resume', bx, y + 72, bw, 40, 'RESUME GAME', '#2fd6c4', '#0b1420');
  drawButton(ctx, state, 'save', bx, y + 122, bw, 40, 'SAVE PROGRESS', '#ffd166', '#0b1420');
  drawButton(ctx, state, 'load', bx, y + 172, bw, 40, 'LOAD SAVED GAME', '#4da6ff', '#0b1420');
  drawButton(ctx, state, 'time_cycle', bx, y + 222, bw, 40, `LIGHTING: ${palName.toUpperCase()}`, '#33465c', '#ffffff');
  drawButton(ctx, state, 'mute', bx, y + 272, bw, 40, state.audio.muted ? 'SOUND: MUTED' : 'SOUND: ON (WEBAUDIO)', '#33465c', '#ffffff');
  drawButton(ctx, state, 'restart', bx, y + 322, bw, 38, 'RESTART NEW GAME', '#ff5263', '#ffffff');
  ctx.restore();
}

function drawArmoryMenu(ctx, state, viewW, viewH) {
  ctx.fillStyle = 'rgba(8, 14, 24, 0.72)';
  ctx.fillRect(0, 0, viewW, viewH);

  const w = 420;
  const h = 365;
  const x = (viewW - w) / 2;
  const y = (viewH - h) / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(12, 20, 32, 0.95)';
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = '#ff9f43';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = 'bold 24px "Segoe UI", sans-serif';
  ctx.fillStyle = '#ff9f43';
  ctx.fillText('EL MERCADO ARMORY', viewW / 2, y + 42);
  ctx.font = 'bold 14px "Segoe UI", sans-serif';
  ctx.fillStyle = '#62f2a6';
  ctx.fillText(`CASH AVAILABLE: $${Math.floor(state.player.cash).toLocaleString()}`, viewW / 2, y + 66);

  const bx = x + 36;
  const bw = w - 72;
  drawButton(ctx, state, 'buy_medkit', bx, y + 86, bw, 38, 'FIRST AID KIT (+60 HP) — $250', '#2d5a4e', '#ffffff');
  drawButton(ctx, state, 'buy_armor', bx, y + 132, bw, 38, 'KEVLAR ARMOR VEST (100%) — $400', '#2a4d6e', '#ffffff');
  drawButton(ctx, state, 'buy_smg', bx, y + 178, bw, 38, 'VIPER SMG + 140 AMMO — $800', '#5e4429', '#ffffff');
  drawButton(ctx, state, 'buy_shotgun', bx, y + 224, bw, 38, 'BREACHER 12G SHOTGUN — $1,200', '#632e36', '#ffffff');
  drawButton(ctx, state, 'buy_ammo', bx, y + 270, bw, 38, 'FULL AMMO REFILL — $150', '#384659', '#ffffff');
  drawButton(ctx, state, 'resume', bx, y + 314, bw, 34, 'LEAVE KIOSK [ESC]', '#ff9f43', '#0b1420');
  ctx.restore();
}

function drawOutcomeOverlay(ctx, state, viewW, viewH) {
  const isBusted = state.screen === 'busted';
  ctx.fillStyle = isBusted ? 'rgba(12, 24, 52, 0.72)' : 'rgba(52, 12, 18, 0.72)';
  ctx.fillRect(0, 0, viewW, viewH);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 64px "Segoe UI", sans-serif';
  ctx.fillStyle = isBusted ? '#4da6ff' : '#ff4757';
  ctx.fillText(isBusted ? 'BUSTED' : 'WASTED', viewW / 2, viewH / 2 - 20);

  ctx.font = '600 16px "Segoe UI", sans-serif';
  ctx.fillStyle = '#eef4fa';
  ctx.fillText(
    isBusted
      ? 'PRPD confiscated $150 bail. Released outside Precinct HQ.'
      : 'Palma Rey Clinic patched you up for $150.',
    viewW / 2,
    viewH / 2 + 24,
  );
  drawButton(ctx, state, 'respawn_now', viewW / 2 - 110, viewH / 2 + 52, 220, 44, 'BACK TO STREETS', '#ffd166', '#0b1420');
  ctx.restore();
}

function drawButton(ctx, state, id, x, y, w, h, label, bg, fg) {
  registerButton(state, id, x, y, w, h);
  const hovered =
    state.input.mouseX >= x &&
    state.input.mouseX <= x + w &&
    state.input.mouseY >= y &&
    state.input.mouseY <= y + h;

  ctx.fillStyle = bg;
  ctx.globalAlpha = hovered ? 1 : 0.9;
  roundRect(ctx, x, y, w, h, 9);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (hovered) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.fillStyle = fg;
  ctx.font = 'bold 13px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  ctx.textBaseline = 'alphabetic';
}

function drawBar(ctx, x, y, w, h, ratio, fill, bg, label) {
  const clamped = clamp(ratio, 0, 1);
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();
  if (clamped > 0.01) {
    ctx.fillStyle = fill;
    roundRect(ctx, x, y, w * clamped, h, 4);
    ctx.fill();
  }
  if (label) {
    ctx.font = 'bold 9px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, x + 5, y + h - 2);
  }
}

function drawStar(ctx, cx, cy, spikes, outerR, innerR, fill, stroke) {
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerR);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
    rot += step;
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
}

function truncateText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let out = text;
  while (out.length > 6 && ctx.measureText(`${out}...`).width > maxW) {
    out = out.slice(0, -1);
  }
  return `${out}...`;
}

function wrapLines(ctx, text, maxW, maxLines = 2) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxW) {
      current = candidate;
    } else if (lines.length < maxLines - 1) {
      if (current) lines.push(current);
      current = word;
    } else {
      const rest = [current, ...words.slice(i)].filter(Boolean).join(' ');
      lines.push(truncateText(ctx, rest, maxW));
      return lines;
    }
  }
  if (current) lines.push(truncateText(ctx, current, maxW));
  return lines;
}
