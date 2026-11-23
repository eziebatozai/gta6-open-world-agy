// High-craft 2D Canvas world renderer for Palma Rey: ocean, beach, roads, 2.5D buildings, vehicles, characters, and FX.

import { PALETTE, WORLD } from './config.js';
import { getNextAvailableMission } from './missions.js';

export function renderWorld(ctx, state, viewW, viewH) {
  const pal = PALETTE[state.timeMode] || PALETTE.suncoast;
  const cam = state.camera;
  const t = state.time;

  // Screen shake offset
  const shakeX = cam.shake > 0.2 ? (Math.random() - 0.5) * cam.shake * 2 : 0;
  const shakeY = cam.shake > 0.2 ? (Math.random() - 0.5) * cam.shake * 2 : 0;
  const camLeft = cam.x - viewW / 2 + shakeX;
  const camTop = cam.y - viewH / 2 + shakeY;

  ctx.save();
  ctx.translate(-camLeft, -camTop);

  const cull = {
    x0: camLeft - 140,
    y0: camTop - 140,
    x1: camLeft + viewW + 140,
    y1: camTop + viewH + 140,
  };

  drawTerrainAndOcean(ctx, pal, t, cull);
  drawRoadsAndPlaza(ctx, pal, t, cull);
  drawParksAndPools(ctx, state.city, pal, t, cull);
  drawHarborDetails(ctx, state.city, pal, t, cull);
  drawSkidmarks(ctx, state.fx, cull);
  drawShopsAndStashes(ctx, state, t, cull);
  drawMissionMarkersGround(ctx, state, t);
  drawPickups(ctx, state.pickups, t, cull);
  drawVehicles(ctx, state.vehicles, pal, t, cull);
  drawPedsAndPlayer(ctx, state, t, cull);
  drawBulletsAndFlashes(ctx, state, cull);
  drawBuildings(ctx, state.city.buildings, pal, t, cull);
  drawContainers(ctx, state.city.containers, pal, cull);
  drawPalmsAndUmbrellas(ctx, state.city, pal, t, cull);
  drawStreetLamps(ctx, state.city.lamps, pal, cull);
  drawParticlesAndPopups(ctx, state.fx, cull);

  ctx.restore();

  // Warm suncoast / sunset / night atmospheric tint
  ctx.fillStyle = pal.ambientTint;
  ctx.fillRect(0, 0, viewW, viewH);

  // Subtle sunbeams in top-right during Suncoast / Sunset modes
  if (state.timeMode !== 'night') {
    const grad = ctx.createRadialGradient(viewW * 0.88, viewH * 0.08, 20, viewW * 0.88, viewH * 0.08, viewW * 0.65);
    grad.addColorStop(0, state.timeMode === 'sunset' ? 'rgba(255, 168, 92, 0.2)' : 'rgba(255, 246, 200, 0.14)');
    grad.addColorStop(1, 'rgba(255, 246, 200, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, viewW, viewH);
  }
}

function inCull(cull, x, y, w = 0, h = 0) {
  return x + w >= cull.x0 && x <= cull.x1 && y + h >= cull.y0 && y <= cull.y1;
}

function drawTerrainAndOcean(ctx, pal, t, cull) {
  // Base warm concrete/urban earth
  ctx.fillStyle = pal.sidewalk;
  ctx.fillRect(0, 0, WORLD.boardwalkX, WORLD.height);

  // Subtle sidewalk paving grid
  ctx.strokeStyle = pal.sidewalkLine;
  ctx.lineWidth = 1;
  const startX = Math.max(0, Math.floor(cull.x0 / 48) * 48);
  const endX = Math.min(WORLD.boardwalkX, cull.x1);
  const startY = Math.max(0, Math.floor(cull.y0 / 48) * 48);
  const endY = Math.min(WORLD.height, cull.y1);
  ctx.beginPath();
  for (let x = startX; x <= endX; x += 48) {
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
  }
  for (let y = startY; y <= endY; y += 48) {
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
  }
  ctx.stroke();

  // Boardwalk promenade
  if (cull.x1 >= WORLD.boardwalkX - 20) {
    ctx.fillStyle = pal.boardwalk;
    ctx.fillRect(WORLD.boardwalkX, 0, WORLD.beachX - WORLD.boardwalkX, WORLD.height);
    ctx.strokeStyle = 'rgba(70, 48, 28, 0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let y = startY; y <= endY; y += 16) {
      ctx.moveTo(WORLD.boardwalkX, y);
      ctx.lineTo(WORLD.beachX, y);
    }
    ctx.stroke();

    // Golden Mirador Beach sand
    ctx.fillStyle = pal.sand;
    ctx.fillRect(WORLD.beachX, 0, WORLD.oceanX - WORLD.beachX + 20, WORLD.height);
    // Wet shoreline sand strip
    ctx.fillStyle = pal.sandWet;
    ctx.fillRect(WORLD.oceanX - 32, 0, 44, WORLD.height);

    // Emerald Gulf Ocean depth bands
    ctx.fillStyle = pal.oceanShallow;
    ctx.fillRect(WORLD.oceanX, 0, 120, WORLD.height);
    ctx.fillStyle = pal.oceanMid;
    ctx.fillRect(WORLD.oceanX + 100, 0, 130, WORLD.height);
    ctx.fillStyle = pal.oceanDeep;
    ctx.fillRect(WORLD.oceanX + 210, 0, WORLD.width - (WORLD.oceanX + 210) + 400, WORLD.height);

    // Animated white foam shoreline & ocean wave ripples
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let y = startY; y <= endY; y += 20) {
      const wave = Math.sin(y * 0.022 + t * 2.4) * 9 + Math.cos(y * 0.05 - t * 1.6) * 4;
      const wx = WORLD.oceanX + wave;
      if (y === startY) ctx.moveTo(wx, y);
      else ctx.lineTo(wx, y);
    }
    ctx.stroke();

    // Second gentle offshore wave line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let y = startY; y <= endY; y += 24) {
      const wave = Math.sin(y * 0.018 + t * 1.9 + 2.1) * 11;
      const wx = WORLD.oceanX + 68 + wave;
      if (y === startY) ctx.moveTo(wx, y);
      else ctx.lineTo(wx, y);
    }
    ctx.stroke();

    // Mirador Lighthouse Pier at y = 1440
    if (cull.y0 <= 1520 && cull.y1 >= 1360) {
      const pierY = 1404;
      const pierH = 72;
      ctx.fillStyle = 'rgba(8, 28, 42, 0.35)';
      ctx.fillRect(WORLD.beachX + 10, pierY + 12, 3495 - WORLD.beachX, pierH);
      ctx.fillStyle = '#b99364';
      ctx.fillRect(WORLD.beachX, pierY, 3495 - WORLD.beachX, pierH);
      ctx.strokeStyle = 'rgba(65, 42, 20, 0.35)';
      ctx.lineWidth = 2;
      for (let px = WORLD.beachX; px < 3495; px += 14) {
        ctx.beginPath();
        ctx.moveTo(px, pierY);
        ctx.lineTo(px, pierY + pierH);
        ctx.stroke();
      }
      // Circular Lighthouse tower at pier tip
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(3465, 1440, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff5263';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(3465, 1440, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawRoadsAndPlaza(ctx, pal, t, cull) {
  const rw = WORLD.roadWidth;
  const half = rw / 2;
  const maxRoadX = WORLD.roadX[WORLD.roadX.length - 1] + half;

  // Curb shadow borders
  ctx.fillStyle = pal.asphaltDark;
  for (const rx of WORLD.roadX) {
    const hEnd = rx < WORLD.harborX ? WORLD.harborY : WORLD.height - 60;
    ctx.fillRect(rx - half - 4, 40, rw + 8, hEnd - 40);
  }
  for (const ry of WORLD.roadY) {
    const xStart = ry >= WORLD.harborY ? WORLD.harborX : 40;
    ctx.fillRect(xStart, ry - half - 4, maxRoadX - xStart + 4, rw + 8);
  }

  // Main asphalt road surface
  ctx.fillStyle = pal.asphalt;
  for (const rx of WORLD.roadX) {
    const hEnd = rx < WORLD.harborX ? WORLD.harborY : WORLD.height - 60;
    ctx.fillRect(rx - half, 40, rw, hEnd - 40);
  }
  for (const ry of WORLD.roadY) {
    const xStart = ry >= WORLD.harborY ? WORLD.harborX : 40;
    ctx.fillRect(xStart, ry - half, maxRoadX - xStart, rw);
  }

  // Double yellow centerlines & white dashed lane dividers
  for (const rx of WORLD.roadX) {
    if (rx + half < cull.x0 || rx - half > cull.x1) continue;
    const hEnd = rx < WORLD.harborX ? WORLD.harborY - 12 : WORLD.height - 80;
    ctx.strokeStyle = '#f2c14e';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(rx - 2.5, 60);
    ctx.lineTo(rx - 2.5, hEnd);
    ctx.moveTo(rx + 2.5, 60);
    ctx.lineTo(rx + 2.5, hEnd);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([16, 16]);
    ctx.beginPath();
    ctx.moveTo(rx - 32, 60);
    ctx.lineTo(rx - 32, hEnd);
    ctx.moveTo(rx + 32, 60);
    ctx.lineTo(rx + 32, hEnd);
    ctx.stroke();
  }

  for (const ry of WORLD.roadY) {
    if (ry + half < cull.y0 || ry - half > cull.y1) continue;
    const xStart = ry >= WORLD.harborY ? WORLD.harborX + 12 : 60;
    ctx.strokeStyle = '#f2c14e';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(xStart, ry - 2.5);
    ctx.lineTo(maxRoadX - 10, ry - 2.5);
    ctx.moveTo(xStart, ry + 2.5);
    ctx.lineTo(maxRoadX - 10, ry + 2.5);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([16, 16]);
    ctx.beginPath();
    ctx.moveTo(xStart, ry - 32);
    ctx.lineTo(maxRoadX - 10, ry - 32);
    ctx.moveTo(xStart, ry + 32);
    ctx.lineTo(maxRoadX - 10, ry + 32);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Clean intersections + zebra crosswalks
  for (const rx of WORLD.roadX) {
    for (const ry of WORLD.roadY) {
      if (rx < WORLD.harborX && ry >= WORLD.harborY) continue;
      if (!inCull(cull, rx - half - 20, ry - half - 20, rw + 40, rw + 40)) continue;
      ctx.fillStyle = pal.asphalt;
      ctx.fillRect(rx - half, ry - half, rw, rw);

      // Zebra crosswalk bars on all four sides
      ctx.fillStyle = 'rgba(245, 245, 240, 0.72)';
      for (let s = -half + 12; s <= half - 18; s += 16) {
        ctx.fillRect(rx + s, ry - half - 14, 9, 12);
        ctx.fillRect(rx + s, ry + half + 2, 9, 12);
        ctx.fillRect(rx - half - 14, ry + s, 12, 9);
        ctx.fillRect(rx + half + 2, ry + s, 12, 9);
      }
    }
  }

  // Grand Plaza del Sol Roundabout & Animated Turquoise Fountain
  if (inCull(cull, WORLD.plazaX - 130, WORLD.plazaY - 130, 260, 260)) {
    ctx.fillStyle = pal.asphalt;
    ctx.beginPath();
    ctx.arc(WORLD.plazaX, WORLD.plazaY, WORLD.plazaRadius + 30, 0, Math.PI * 2);
    ctx.fill();

    // Decorative travertine plaza island
    ctx.fillStyle = '#ebe1cc';
    ctx.beginPath();
    ctx.arc(WORLD.plazaX, WORLD.plazaY, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d4b888';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Sparkling turquoise fountain basin
    ctx.fillStyle = '#29c7d9';
    ctx.beginPath();
    ctx.arc(WORLD.plazaX, WORLD.plazaY, 36, 0, Math.PI * 2);
    ctx.fill();

    // Animated water ripples
    const ripple = (t * 20) % 28;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(WORLD.plazaX, WORLD.plazaY, 6 + ripple, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#fff9e6';
    ctx.beginPath();
    ctx.arc(WORLD.plazaX, WORLD.plazaY, 9, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParksAndPools(ctx, city, pal, t, cull) {
  for (const park of city.parks) {
    if (!inCull(cull, park.x, park.y, park.w, park.h)) continue;
    if (park.kind === 'plaza') {
      ctx.fillStyle = '#efe3cc';
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.strokeStyle = '#d4a373';
      ctx.lineWidth = 3;
      ctx.strokeRect(park.x + 6, park.y + 6, park.w - 12, park.h - 12);
    } else {
      ctx.fillStyle = pal.grass;
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.fillStyle = pal.grassAlt;
      for (let gx = park.x; gx < park.x + park.w; gx += 32) {
        ctx.fillRect(gx, park.y, 16, park.h);
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 2;
      ctx.strokeRect(park.x + 2, park.y + 2, park.w - 4, park.h - 4);
    }
  }

  // Sparkling swimming pools
  for (const pool of city.pools) {
    if (!inCull(cull, pool.x, pool.y, pool.w, pool.h)) continue;
    ctx.fillStyle = '#e7edf2';
    ctx.fillRect(pool.x - 5, pool.y - 5, pool.w + 10, pool.h + 10);
    ctx.fillStyle = '#2ad3e8';
    ctx.fillRect(pool.x, pool.y, pool.w, pool.h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.lineWidth = 2;
    const shift = Math.sin(t * 2.5 + pool.x) * 6;
    ctx.beginPath();
    ctx.moveTo(pool.x + 10, pool.y + pool.h * 0.35 + shift * 0.4);
    ctx.lineTo(pool.x + pool.w - 10, pool.y + pool.h * 0.35 - shift * 0.4);
    ctx.moveTo(pool.x + 14, pool.y + pool.h * 0.68 - shift * 0.4);
    ctx.lineTo(pool.x + pool.w - 14, pool.y + pool.h * 0.68 + shift * 0.4);
    ctx.stroke();
  }
}

function drawHarborDetails(ctx, city, pal, t, cull) {
  if (cull.x0 <= WORLD.harborX + 40 && cull.y1 >= WORLD.harborY - 20) {
    ctx.fillStyle = pal.harborWater;
    ctx.fillRect(0, WORLD.harborY, WORLD.harborX, WORLD.height - WORLD.harborY + 40);

    // Subtle harbor water shimmer lines
    ctx.strokeStyle = 'rgba(130, 224, 240, 0.22)';
    ctx.lineWidth = 2;
    for (let y = WORLD.harborY + 30; y < WORLD.height; y += 38) {
      const shift = Math.sin(t * 2 + y * 0.05) * 14;
      ctx.beginPath();
      ctx.moveTo(20 + shift, y);
      ctx.lineTo(WORLD.harborX - 30 + shift, y);
      ctx.stroke();
    }

    // Concrete docks & piers
    ctx.fillStyle = '#b9bec4';
    ctx.fillRect(0, WORLD.harborY - 12, WORLD.harborX, 18);
    ctx.fillRect(180, WORLD.harborY, 110, 360);
    ctx.fillRect(470, WORLD.harborY, 110, 360);
    ctx.fillRect(740, WORLD.harborY, 120, 360);
    ctx.strokeStyle = '#7e868f';
    ctx.lineWidth = 3;
    ctx.strokeRect(180, WORLD.harborY, 110, 360);
    ctx.strokeRect(470, WORLD.harborY, 110, 360);
    ctx.strokeRect(740, WORLD.harborY, 120, 360);
  }

  // Moored luxury yachts & offshore boats
  for (const b of city.boats) {
    if (!inCull(cull, b.x - b.len, b.y - b.len, b.len * 2, b.len * 2)) continue;
    ctx.save();
    ctx.translate(b.x, b.y + Math.sin(t * 2 + b.x * 0.01) * 2.5);
    ctx.rotate(b.angle);

    // Water wake shadow
    ctx.fillStyle = 'rgba(0, 18, 32, 0.34)';
    ctx.beginPath();
    ctx.ellipse(4, 6, b.len * 0.52, b.wid * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hull
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.moveTo(b.len * 0.52, 0);
    ctx.quadraticCurveTo(b.len * 0.2, b.wid * 0.55, -b.len * 0.48, b.wid * 0.44);
    ctx.lineTo(-b.len * 0.48, -b.wid * 0.44);
    ctx.quadraticCurveTo(b.len * 0.2, -b.wid * 0.55, b.len * 0.52, 0);
    ctx.closePath();
    ctx.fill();

    // Teak deck & cabin windshield
    ctx.fillStyle = '#d4a373';
    ctx.fillRect(-b.len * 0.38, -b.wid * 0.32, b.len * 0.32, b.wid * 0.64);
    ctx.fillStyle = b.trim;
    ctx.fillRect(-b.len * 0.08, -b.wid * 0.28, b.len * 0.34, b.wid * 0.56);
    ctx.fillStyle = '#1b3147';
    ctx.fillRect(b.len * 0.14, -b.wid * 0.22, b.len * 0.12, b.wid * 0.44);
    ctx.restore();
  }
}

function drawSkidmarks(ctx, fx, cull) {
  for (const s of fx.skids) {
    if (!inCull(cull, Math.min(s.x1, s.x2), Math.min(s.y1, s.y2), 30, 30)) continue;
    const fade = Math.min(1, s.life / 4);
    ctx.strokeStyle = `rgba(18, 20, 24, ${s.alpha * fade})`;
    ctx.lineWidth = s.width;
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  }
}

function drawShopsAndStashes(ctx, state, t, cull) {
  for (const shop of state.city.shops) {
    if (!inCull(cull, shop.x - 60, shop.y - 60, 120, 120)) continue;
    const pulse = 0.78 + Math.sin(t * 4) * 0.22;
    ctx.save();
    ctx.strokeStyle = shop.color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.85 * pulse;
    ctx.beginPath();
    ctx.arc(shop.x, shop.y, shop.r * (0.85 + Math.sin(t * 3) * 0.08), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = shop.color;
    ctx.globalAlpha = 0.16;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(shop.label, shop.x, shop.y - shop.r - 8);
    ctx.restore();
  }

  for (const st of state.city.stashes) {
    if (st.collected || !inCull(cull, st.x - 30, st.y - 30, 60, 60)) continue;
    const bob = Math.sin(t * 4.5 + st.x) * 3;
    ctx.save();
    ctx.fillStyle = 'rgba(72, 245, 163, 0.25)';
    ctx.beginPath();
    ctx.arc(st.x, st.y, 18 + Math.sin(t * 5) * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3ee8a5';
    ctx.fillRect(st.x - 10, st.y - 7 + bob, 20, 14);
    ctx.strokeStyle = '#0f3d2c';
    ctx.lineWidth = 2;
    ctx.strokeRect(st.x - 10, st.y - 7 + bob, 20, 14);
    ctx.fillStyle = '#0f3d2c';
    ctx.font = 'bold 10px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', st.x, st.y + 4 + bob);
    ctx.restore();
  }
}

function drawMissionMarkersGround(ctx, state, t) {
  let marker = null;
  if (state.missions.active && state.missions.active.marker) {
    marker = state.missions.active.marker;
  } else {
    const next = getNextAvailableMission(state.missions);
    if (next) {
      marker = {
        x: next.startPoint.x,
        y: next.startPoint.y,
        color: '#ffd166',
        label: `MISSION ${next.index + 1}: ${next.title.toUpperCase()}`,
      };
    }
  }
  if (!marker) return;

  const pulse = (t * 2.2) % 1;
  ctx.save();
  ctx.strokeStyle = marker.color;
  ctx.lineWidth = 4;
  ctx.globalAlpha = 1 - pulse;
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, 24 + pulse * 34, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.28;
  ctx.fillStyle = marker.color;
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, 28, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.95;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, 26, 0, Math.PI * 2);
  ctx.stroke();

  // Floating pill label
  ctx.font = 'bold 12px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  const tw = ctx.measureText(marker.label).width + 16;
  ctx.fillStyle = 'rgba(12, 18, 28, 0.84)';
  ctx.fillRect(marker.x - tw / 2, marker.y - 54, tw, 20);
  ctx.strokeStyle = marker.color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(marker.x - tw / 2, marker.y - 54, tw, 20);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(marker.label, marker.x, marker.y - 40);
  ctx.restore();
}

function drawPickups(ctx, pickups, t, cull) {
  for (const item of pickups) {
    if (!inCull(cull, item.x - 20, item.y - 20, 40, 40)) continue;
    const bob = Math.sin(item.bob) * 2.5;
    ctx.save();
    ctx.translate(item.x, item.y + bob);
    if (item.kind === 'cash') {
      ctx.fillStyle = '#3ee8a5';
      ctx.fillRect(-8, -5, 16, 10);
      ctx.strokeStyle = '#145238';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-8, -5, 16, 10);
      ctx.fillStyle = '#145238';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 3);
    } else if (item.kind === 'medkit') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = '#ff4757';
      ctx.fillRect(-2.5, -6, 5, 12);
      ctx.fillRect(-6, -2.5, 12, 5);
    } else {
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(-7, -5, 14, 10);
      ctx.strokeStyle = '#5c3c00';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-7, -5, 14, 10);
    }
    ctx.restore();
  }
}

function drawVehicles(ctx, vehicles, pal, t, cull) {
  for (const v of vehicles) {
    if (!inCull(cull, v.x - 80, v.y - 80, 160, 160)) continue;
    const len = v.spec.length;
    const wid = v.spec.width;
    const halfL = len / 2;
    const halfW = wid / 2;

    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.angle);

    // Headlight beam cones
    if (!v.wrecked && (v.driver || v.sirenOn)) {
      const beamAlpha = pal.headlightAlpha;
      const grad = ctx.createLinearGradient(halfL, 0, halfL + 115, 0);
      grad.addColorStop(0, `rgba(255, 246, 200, ${beamAlpha})`);
      grad.addColorStop(1, 'rgba(255, 246, 200, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(halfL - 2, -halfW * 0.72);
      ctx.lineTo(halfL + 115, -halfW * 2.1);
      ctx.lineTo(halfL + 115, halfW * 2.1);
      ctx.lineTo(halfL - 2, halfW * 0.72);
      ctx.closePath();
      ctx.fill();
    }

    // Soft drop shadow
    ctx.fillStyle = 'rgba(10, 16, 24, 0.36)';
    roundRect(ctx, -halfL + 4, -halfW + 5, len, wid, 7);
    ctx.fill();

    // Wheels peeking slightly at corners
    ctx.fillStyle = '#181c22';
    ctx.fillRect(halfL - 15, -halfW - 2, 11, 4);
    ctx.fillRect(halfL - 15, halfW - 2, 11, 4);
    ctx.fillRect(-halfL + 6, -halfW - 2, 11, 4);
    ctx.fillRect(-halfL + 6, halfW - 2, 11, 4);

    // Main painted chassis
    ctx.fillStyle = v.wrecked ? '#363a40' : v.color;
    roundRect(ctx, -halfL, -halfW, len, wid, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(12, 18, 28, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Police livery stripes & push bumper
    if (v.spec.style === 'police' && !v.wrecked) {
      ctx.fillStyle = '#1d3c6e';
      ctx.fillRect(-halfL + 2, -halfW + 2, 15, wid - 4);
      ctx.fillRect(halfL - 16, -halfW + 2, 14, wid - 4);
      // Front push bumper
      ctx.fillStyle = '#182230';
      ctx.fillRect(halfL - 1, -halfW * 0.68, 4, wid * 0.68);
    } else if (v.spec.style === 'enforcer' && !v.wrecked) {
      ctx.fillStyle = '#2c5da8';
      ctx.fillRect(-halfL + 4, -halfW + 4, len - 8, 4);
      ctx.fillRect(-halfL + 4, halfW - 8, len - 8, 4);
    }

    // Racing stripe on Solero GT & Rayo Super
    if ((v.spec.style === 'coupe' || v.spec.style === 'supercar') && !v.wrecked) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
      ctx.fillRect(-halfL + 2, -3, len - 4, 6);
    }

    // Cabin / Windshield / Open-top convertible interior
    if (v.spec.style === 'cabrio' && !v.wrecked) {
      // Open-top seats & dashboard
      ctx.fillStyle = '#4e3529';
      roundRect(ctx, -halfL * 0.45, -halfW * 0.72, len * 0.54, wid * 0.72, 4);
      ctx.fill();
      ctx.fillStyle = '#b98862';
      ctx.fillRect(-halfL * 0.34, -halfW * 0.56, 11, wid * 0.44);
      ctx.fillRect(-halfL * 0.34, halfW * 0.12, 11, wid * 0.44);
      // Windshield strip
      ctx.fillStyle = '#2a465c';
      ctx.fillRect(halfL * 0.1, -halfW * 0.74, 8, wid * 0.74);
    } else {
      // Dark tinted windshield + rear glass
      ctx.fillStyle = '#1c2b3a';
      roundRect(ctx, -halfL * 0.54, -halfW * 0.76, len * 0.72, wid * 0.76, 5);
      ctx.fill();

      // Painted roof panel
      const roofLen = v.spec.style === 'van' ? len * 0.66 : v.spec.style === 'suv' ? len * 0.52 : len * 0.38;
      const roofX = v.spec.style === 'van' ? -halfL + 5 : -halfL * 0.36;
      ctx.fillStyle = v.wrecked ? '#292c30' : v.spec.style === 'police' ? '#ffffff' : v.color;
      roundRect(ctx, roofX, -halfW * 0.66, roofLen, wid * 0.66, 4);
      ctx.fill();

      // Subtle glossy highlight across windshield
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(halfL * 0.08, -halfW * 0.64, 5, wid * 0.64);
    }

    // Rear spoiler on Rayo Super
    if (v.spec.style === 'supercar') {
      ctx.fillStyle = '#191f28';
      ctx.fillRect(-halfL + 1, -halfW + 1, 5, wid - 2);
    }

    // Headlights & Taillights / Brake glow
    if (!v.wrecked) {
      ctx.fillStyle = '#fff5cc';
      ctx.fillRect(halfL - 3, -halfW + 3, 3, 6);
      ctx.fillRect(halfL - 3, halfW - 9, 3, 6);

      ctx.fillStyle = v.braking ? '#ff2a44' : '#a82230';
      ctx.fillRect(-halfL, -halfW + 3, 3, 6);
      ctx.fillRect(-halfL, halfW - 9, 3, 6);
    }

    // Flashing red & blue PRPD roof lightbar with volumetric glow halo!
    if (v.spec.isPolice && !v.wrecked) {
      const redActive = Math.sin(v.sirenPhase) >= 0;
      ctx.fillStyle = '#1b222c';
      ctx.fillRect(-4, -halfW * 0.56, 8, wid * 0.56);

      ctx.fillStyle = v.sirenOn && redActive ? '#ff2e4c' : '#7a1929';
      ctx.fillRect(-3, -halfW * 0.52, 6, wid * 0.24);
      ctx.fillStyle = v.sirenOn && !redActive ? '#2699ff' : '#163f6e';
      ctx.fillRect(-3, halfW * 0.04, 6, wid * 0.24);

      if (v.sirenOn) {
        const glowY = redActive ? -halfW * 0.35 : halfW * 0.35;
        const glowColor = redActive ? 'rgba(255, 46, 76, 0.72)' : 'rgba(38, 153, 255, 0.72)';
        const glow = ctx.createRadialGradient(0, glowY, 3, 0, glowY, 58);
        glow.addColorStop(0, glowColor);
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, glowY, 58, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Mission target chevron above special mission cars
    if (v.missionTag && v.missionTag.startsWith('active_') && v.driver !== 'player') {
      ctx.rotate(-v.angle);
      const bounce = Math.sin(t * 6) * 4;
      ctx.fillStyle = v.driver === 'cartel' ? '#ff4757' : '#ffd166';
      ctx.beginPath();
      ctx.moveTo(0, -34 + bounce);
      ctx.lineTo(-8, -46 + bounce);
      ctx.lineTo(8, -46 + bounce);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawHuman(ctx, entity, isPlayer, t) {
  ctx.save();
  ctx.translate(entity.x, entity.y);

  // Subtle player ground ring so Camila stands out cleanly at a glance
  if (isPlayer) {
    ctx.strokeStyle = 'rgba(47, 214, 196, 0.72)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, entity.radius + 5 + Math.sin(t * 5) * 1.2, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.rotate(entity.angle);

  // Drop shadow
  ctx.fillStyle = 'rgba(12, 18, 26, 0.32)';
  ctx.beginPath();
  ctx.ellipse(2, 4, 11, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  const swing = Math.sin(entity.walkCycle || 0) * 4;

  // Feet stepping
  ctx.fillStyle = '#222831';
  ctx.beginPath();
  ctx.ellipse(swing, -5, 4.5, 3, 0, 0, Math.PI * 2);
  ctx.ellipse(-swing, 5, 4.5, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Shoulders / Torso
  ctx.fillStyle = isPlayer ? '#ff5e78' : entity.shirt;
  roundRect(ctx, -6, -11, 13, 22, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(15, 20, 28, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Arms & held weapon
  ctx.fillStyle = isPlayer ? '#f0be96' : entity.skin;
  const armed = isPlayer || entity.weapon;
  if (armed) {
    ctx.fillRect(4, 3, 10, 4);
    ctx.fillStyle = '#252c36';
    ctx.fillRect(10, 2, 11, 3.5);
  } else {
    ctx.fillRect(swing * 0.5, -13, 7, 3.5);
    ctx.fillRect(-swing * 0.5, 9.5, 7, 3.5);
  }

  // Head
  ctx.fillStyle = isPlayer ? '#f0be96' : entity.skin;
  ctx.beginPath();
  ctx.arc(1, 0, 6.8, 0, Math.PI * 2);
  ctx.fill();

  // Hair / Police cap / Sun hat
  if (isPlayer) {
    ctx.fillStyle = '#1c1922';
    ctx.beginPath();
    ctx.arc(-1, 0, 6.8, Math.PI * 0.45, Math.PI * 1.55);
    ctx.fill();
  } else if (entity.kind === 'police') {
    ctx.fillStyle = '#16325c';
    ctx.beginPath();
    ctx.arc(1, 0, 7.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(4, -2, 3, 4);
  } else if (entity.kind === 'boss') {
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(0, 0, 7.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b1b17';
    ctx.beginPath();
    ctx.arc(1, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (entity.hasHat) {
    ctx.fillStyle = '#f2d398';
    ctx.beginPath();
    ctx.arc(1, 0, 8.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff6b8b';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    ctx.fillStyle = entity.hair;
    ctx.beginPath();
    ctx.arc(-1, 0, 6.6, Math.PI * 0.4, Math.PI * 1.6);
    ctx.fill();
  }

  ctx.restore();

  // Overhead health bar for Cartel hostiles & Boss
  if (!isPlayer && (entity.kind === 'cartel' || entity.kind === 'boss') && entity.alive) {
    const bw = entity.kind === 'boss' ? 42 : 28;
    const ratio = Math.max(0, entity.hp / entity.maxHp);
    ctx.fillStyle = 'rgba(10, 14, 20, 0.78)';
    ctx.fillRect(entity.x - bw / 2, entity.y - 24, bw, 5);
    ctx.fillStyle = entity.kind === 'boss' ? '#ffd166' : '#ff4757';
    ctx.fillRect(entity.x - bw / 2 + 1, entity.y - 23, (bw - 2) * ratio, 3);
    if (entity.kind === 'boss') {
      ctx.font = 'bold 10px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd166';
      ctx.fillText('EL COBRE', entity.x, entity.y - 29);
    }
  }
}

function drawPedsAndPlayer(ctx, state, t, cull) {
  for (const p of state.peds) {
    if (!inCull(cull, p.x - 30, p.y - 30, 60, 60)) continue;
    if (!p.alive) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.6, p.despawnTimer / 4);
      ctx.fillStyle = '#75222d';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }
    drawHuman(ctx, p, false, t);
  }

  if (state.player.alive && !state.player.vehicle) {
    drawHuman(ctx, state.player, true, t);
  }
}

function drawBulletsAndFlashes(ctx, state, cull) {
  ctx.lineCap = 'round';
  for (const b of state.bullets) {
    if (!inCull(cull, b.x - 20, b.y - 20, 40, 40)) continue;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.prevX, b.prevY);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  for (const f of state.fx.flashes) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.angle);
    ctx.fillStyle = f.color;
    ctx.globalAlpha = f.life / f.maxLife;
    ctx.beginPath();
    ctx.ellipse(6, 0, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawBuildings(ctx, buildings, pal, t, cull) {
  for (const b of buildings) {
    if (!inCull(cull, b.x - 40, b.y - 40, b.w + 90, b.h + 90)) continue;

    // Ground drop shadow cast by sun angle
    const sScale = b.height / 28;
    const sdx = pal.shadowDx * sScale;
    const sdy = pal.shadowDy * sScale;
    ctx.fillStyle = pal.shadowColor;
    ctx.fillRect(b.x + sdx, b.y + sdy, b.w, b.h);

    // Faux-2.5D roof offset (slight upward-left architectural lift)
    const liftX = -b.height * 0.14;
    const liftY = -b.height * 0.18;

    // Extruded 2.5D south & east walls connecting base footprint to lifted roof
    const rx = b.x + liftX;
    const ry = b.y + liftY;

    // South facade wall
    ctx.fillStyle = b.body;
    ctx.beginPath();
    ctx.moveTo(rx, ry + b.h);
    ctx.lineTo(rx + b.w, ry + b.h);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.lineTo(b.x, b.y + b.h);
    ctx.closePath();
    ctx.fill();

    // East shaded facade wall
    ctx.fillStyle = 'rgba(18, 28, 42, 0.24)';
    ctx.beginPath();
    ctx.moveTo(rx + b.w, ry);
    ctx.lineTo(b.x + b.w, b.y);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.lineTo(rx + b.w, ry + b.h);
    ctx.closePath();
    ctx.fill();

    // Subtle sunlit window slits along south facade
    const winStep = 20;
    ctx.fillStyle = pal.neonGlow > 0.5 ? 'rgba(255, 224, 140, 0.72)' : 'rgba(30, 56, 78, 0.45)';
    for (let wx = rx + 10; wx < rx + b.w - 14; wx += winStep) {
      ctx.fillRect(wx, ry + b.h + 2, 10, Math.max(3, Math.abs(liftY) * 0.55));
    }

    // Roof deck lifted cleanly
    ctx.fillStyle = b.roof;
    ctx.fillRect(rx, ry, b.w, b.h);

    // Parapet trim border
    ctx.strokeStyle = b.trim;
    ctx.lineWidth = 4;
    ctx.strokeRect(rx + 2, ry + 2, b.w - 4, b.h - 4);

    // Interior recessed roof terrace & skylight grid for modern towers
    if (b.w > 70 && b.h > 70) {
      ctx.fillStyle = 'rgba(15, 28, 42, 0.08)';
      ctx.fillRect(rx + 12, ry + 12, b.w - 24, b.h - 24);
      if (b.style === 'tower' && !b.hasHelipad) {
        ctx.fillStyle = 'rgba(97, 181, 255, 0.26)';
        ctx.fillRect(rx + 20, ry + 20, b.w - 40, b.h - 40);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(rx + 20, ry + 20, b.w - 40, b.h - 40);
      }
    }

    // Rooftop details: pools, helipads, skylights, AC vents
    if (b.hasPool && b.w > 100 && b.h > 90) {
      const pw = Math.min(b.w * 0.42, 74);
      const ph = Math.min(b.h * 0.38, 42);
      const px = rx + b.w - pw - 16;
      const py = ry + 16;
      ctx.fillStyle = '#2ad3e8';
      ctx.fillRect(px, py, pw, ph);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, pw, ph);
    }

    if (b.hasHelipad && b.w > 110 && b.h > 100) {
      const hx = rx + b.w * 0.5;
      const hy = ry + b.h * 0.5;
      ctx.strokeStyle = 'rgba(255, 224, 102, 0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(hx, hy, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 224, 102, 0.9)';
      ctx.font = 'bold 22px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('H', hx, hy + 1);
      ctx.textBaseline = 'alphabetic';
    } else if (b.hasAc && b.w > 84 && b.h > 84) {
      ctx.fillStyle = '#9aa6b2';
      ctx.fillRect(rx + 18, ry + 18, 22, 16);
      ctx.fillRect(rx + 46, ry + 18, 16, 16);
      ctx.strokeStyle = '#606c78';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rx + 18, ry + 18, 22, 16);
    }

    // Neon trim strip (glows warmly in sunset & night, crisp pastel accent in day)
    if (b.neon) {
      ctx.save();
      ctx.strokeStyle = b.neon;
      ctx.lineWidth = 3;
      if (pal.neonGlow > 0.35) {
        ctx.shadowColor = b.neon;
        ctx.shadowBlur = 14 * pal.neonGlow;
      }
      ctx.beginPath();
      ctx.moveTo(rx + 6, ry + b.h - 4);
      ctx.lineTo(rx + b.w - 6, ry + b.h - 4);
      ctx.stroke();
      ctx.restore();
    }

    // Crisp landmark sign on rooftop
    if (b.label) {
      ctx.save();
      ctx.font = 'bold 12px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      const lw = ctx.measureText(b.label).width + 14;
      const lx = rx + b.w * 0.5;
      const ly = ry + b.h - 14;
      ctx.fillStyle = 'rgba(12, 20, 32, 0.82)';
      ctx.fillRect(lx - lw / 2, ly - 13, lw, 18);
      ctx.fillStyle = b.neon || '#ffd166';
      ctx.fillText(b.label, lx, ly);
      ctx.restore();
    }
  }
}

function drawContainers(ctx, containers, pal, cull) {
  for (const c of containers) {
    if (!inCull(cull, c.x - 10, c.y - 10, c.w + 30, c.h + 30)) continue;
    ctx.fillStyle = pal.shadowColor;
    ctx.fillRect(c.x + 6, c.y + 7, c.w, c.h);
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(c.x, c.y, c.w, c.h);
    // Corrugated ribs
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    for (let rx = c.x + 8; rx < c.x + c.w - 4; rx += 8) {
      ctx.beginPath();
      ctx.moveTo(rx, c.y + 2);
      ctx.lineTo(rx, c.y + c.h - 2);
      ctx.stroke();
    }
  }
}

function drawPalmsAndUmbrellas(ctx, city, pal, t, cull) {
  // Colorful beach umbrellas & beach towels
  for (const u of city.umbrellas) {
    if (!inCull(cull, u.x - 45, u.y - 45, 90, 90)) continue;
    // Beach lounger towel beside umbrella
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.fillRect(u.x - u.r - 12, u.y - 10, 12, 24);
    ctx.fillStyle = u.color;
    ctx.fillRect(u.x - u.r - 10, u.y - 6, 8, 16);

    ctx.fillStyle = pal.shadowColor;
    ctx.beginPath();
    ctx.arc(u.x + 8, u.y + 9, u.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = u.color;
    ctx.beginPath();
    ctx.arc(u.x, u.y, u.r, 0, Math.PI * 2);
    ctx.fill();

    // Alternating white beach stripes
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    for (let k = 0; k < 4; k++) {
      const a0 = k * (Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.arc(u.x, u.y, u.r, a0, a0 + Math.PI / 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(u.x, u.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Swaying suncoast palm trees
  for (const p of city.palms) {
    if (!inCull(cull, p.x - 45, p.y - 45, 90, 90)) continue;
    const sway = Math.sin(t * 1.8 + p.phase) * 2.5;
    const cx = p.x + sway;
    const cy = p.y + sway * 0.4;

    // Ground shadow
    ctx.fillStyle = 'rgba(14, 24, 30, 0.25)';
    ctx.beginPath();
    ctx.arc(p.x + 11, p.y + 13, p.r * 0.92, 0, Math.PI * 2);
    ctx.fill();

    // Trunk hint
    ctx.strokeStyle = '#7c5c3e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(cx, cy);
    ctx.stroke();

    // 7 layered emerald fronds
    const fronds = 7;
    for (let i = 0; i < fronds; i++) {
      const a = (i / fronds) * Math.PI * 2 + p.phase * 0.25 + sway * 0.025;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = i % 2 === 0 ? '#2f9e59' : '#3fb869';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(p.r * 0.55, -7, p.r, 0);
      ctx.quadraticCurveTo(p.r * 0.55, 7, 0, 0);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#246b3e';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStreetLamps(ctx, lamps, pal, cull) {
  for (const l of lamps) {
    if (!inCull(cull, l.x - 40, l.y - 40, 80, 80)) continue;
    if (pal.neonGlow > 0.4) {
      const grad = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 44);
      grad.addColorStop(0, `rgba(255, 224, 150, ${0.42 * pal.neonGlow})`);
      grad.addColorStop(1, 'rgba(255, 224, 150, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(l.x, l.y, 44, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#55606e';
    ctx.beginPath();
    ctx.arc(l.x, l.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticlesAndPopups(ctx, fx, cull) {
  for (const sw of fx.shockwaves) {
    const a = sw.life / sw.maxLife;
    ctx.strokeStyle = `rgba(255, 220, 120, ${a * 0.8})`;
    ctx.lineWidth = 4 * a;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const p of fx.particles) {
    if (!inCull(cull, p.x - 30, p.y - 30, 60, 60)) continue;
    ctx.save();
    ctx.globalAlpha = (p.life / p.maxLife) * p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.textAlign = 'center';
  ctx.font = 'bold 14px "Segoe UI", sans-serif';
  for (const pop of fx.popups) {
    const a = Math.min(1, pop.life / 0.45);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(10, 15, 24, 0.72)';
    ctx.fillText(pop.text, pop.x + 1, pop.y + 1);
    ctx.fillStyle = pop.color;
    ctx.fillText(pop.text, pop.x, pop.y);
    ctx.restore();
  }
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
