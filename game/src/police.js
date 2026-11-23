// Wanted level (0-5 stars), PRPD cruiser pursuit & roadblock AI, and foot officer arrest logic.

import { WORLD } from './config.js';
import { hasLineOfSight, isInWater } from './city.js';
import { angleDiff, clamp, dist } from './math.js';
import { createPed } from './pedestrians.js';
import { createVehicle } from './vehicles.js';

const STAR_THRESHOLDS = [0, 14, 42, 85, 145, 220];

export function createPoliceState() {
  return {
    heat: 0,
    stars: 0,
    evadeTimer: 0,
    evading: false,
    spawnCooldown: 0,
    lastReason: '',
    dispatchTimer: 0,
    sirenProximity: 0,
  };
}

export function addPoliceHeat(state, amount, reason = '') {
  const pol = state.police;
  const prevStars = pol.stars;
  pol.heat = clamp(pol.heat + amount, 0, 260);
  pol.evadeTimer = 0;
  pol.evading = false;
  if (reason) pol.lastReason = reason;

  let newStars = 0;
  for (let s = 5; s >= 1; s--) {
    if (pol.heat >= STAR_THRESHOLDS[s]) {
      newStars = s;
      break;
    }
  }
  pol.stars = Math.max(pol.stars, newStars);

  if (pol.stars > prevStars) {
    state.audio.playWantedUp();
    if (pol.stars === 2) {
      state.pushDialogue('dispatch', 'All units: suspect fleeing on suncoast avenues. Intercept authorized.', 3.4);
    } else if (pol.stars === 4) {
      state.pushDialogue('dispatch', 'Code 4! Deploying PRPD Enforcer tactical units to containment grid!', 3.6);
    }
  }
}

export function setWantedStars(state, minStars, reason = '') {
  const pol = state.police;
  const targetHeat = STAR_THRESHOLDS[clamp(minStars, 0, 5)] + 4;
  if (pol.stars < minStars) {
    pol.heat = Math.max(pol.heat, targetHeat);
    pol.stars = minStars;
    pol.evadeTimer = 0;
    pol.evading = false;
    if (reason) pol.lastReason = reason;
    state.audio.playWantedUp();
  }
}

export function clearWantedLevel(state) {
  const pol = state.police;
  pol.heat = 0;
  pol.stars = 0;
  pol.evadeTimer = 0;
  pol.evading = false;
  state.player.bustedProgress = 0;
  for (const v of state.vehicles) {
    if (v.driver === 'police') {
      v.sirenOn = false;
      v.driver = 'traffic';
    }
  }
}

function spawnPoliceUnit(state) {
  const pol = state.police;
  const px = state.player.x;
  const py = state.player.y;

  // Pick a road point ~560-820px from player
  const horizontal = Math.random() < 0.5;
  let sx;
  let sy;
  let angle;

  if (horizontal) {
    const ry = WORLD.roadY.reduce((best, r) => (Math.abs(r - py) < Math.abs(best - py) ? r : best));
    const side = Math.random() < 0.5 ? -1 : 1;
    sx = clamp(px + side * (580 + Math.random() * 200), 220, 2740);
    sy = ry + (side > 0 ? -WORLD.laneOffset : WORLD.laneOffset);
    angle = side > 0 ? Math.PI : 0;
  } else {
    const rx = WORLD.roadX.reduce((best, r) => (Math.abs(r - px) < Math.abs(best - px) ? r : best));
    const side = Math.random() < 0.5 ? -1 : 1;
    sx = rx + (side > 0 ? WORLD.laneOffset : -WORLD.laneOffset);
    sy = clamp(py + side * (520 + Math.random() * 200), 200, 2380);
    angle = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  }

  if (isInWater(sx, sy) || dist(sx, sy, px, py) < 380) return;
  if (state.vehicles.some((v) => dist(v.x, v.y, sx, sy) < 95)) return;

  if (pol.stars === 1) {
    // Foot officer reinforcement
    state.peds.push(createPed('police', sx, sy, { state: 'chase' }));
    return;
  }

  const type = pol.stars >= 4 && Math.random() < 0.45 ? 'enforcer' : 'police';
  const cruiser = createVehicle(type, sx, sy, angle, {
    driver: 'police',
    sirenOn: true,
  });
  state.vehicles.push(cruiser);
}

export function updatePolice(state, dt) {
  const pol = state.police;
  const player = state.player;
  pol.sirenProximity = 0;

  if (pol.stars <= 0 || !player.alive) {
    player.bustedProgress = Math.max(0, player.bustedProgress - dt * 0.8);
    return;
  }

  // Count active police units & determine line of sight
  const activeCruisers = state.vehicles.filter((v) => v.driver === 'police' && !v.wrecked);
  const activeOfficers = state.peds.filter((p) => p.alive && p.kind === 'police');
  let spotted = false;
  let nearestSirenDist = 9999;

  for (const c of activeCruisers) {
    const d = dist(c.x, c.y, player.x, player.y);
    if (d < nearestSirenDist) nearestSirenDist = d;
    if (d < 540 && hasLineOfSight(state.city, c.x, c.y, player.x, player.y)) {
      spotted = true;
    }

    // Compute tactical pursuit controls
    const leadX = player.x + (player.vehicle ? player.vehicle.vx * 0.35 : player.vx * 0.25);
    const leadY = player.y + (player.vehicle ? player.vehicle.vy * 0.35 : player.vy * 0.25);
    const desiredAngle = Math.atan2(leadY - c.y, leadX - c.x);
    const diff = angleDiff(c.angle, desiredAngle);
    const closeStop = d < 125 && (!player.vehicle || player.vehicle.speed < 75);

    c.sirenOn = true;
    c.aiControl = {
      throttle: closeStop ? 0 : Math.abs(diff) > 1.3 ? 0.35 : 0.92,
      brake: closeStop ? 0.9 : 0,
      steer: clamp(diff * 2.1, -1, 1),
      handbrake: Math.abs(diff) > 1.05 && c.speed > 190,
    };

    // Deploy a foot officer when cruiser closes in on slow/on-foot suspect
    if (closeStop && activeOfficers.length < 3 + pol.stars * 2 && Math.random() < dt * 1.1) {
      const exitX = c.x + Math.cos(c.angle + Math.PI / 2) * 30;
      const exitY = c.y + Math.sin(c.angle + Math.PI / 2) * 30;
      if (!isInWater(exitX, exitY)) {
        state.peds.push(createPed('police', exitX, exitY, { state: 'chase' }));
      }
    }

    // Despawn far cruisers
    if (d > 1550) {
      c.driver = 'traffic';
      c.sirenOn = false;
    }
  }

  // Check foot officers spotting & arresting player
  let arrestingCopClose = false;
  for (const cop of activeOfficers) {
    const d = dist(cop.x, cop.y, player.x, player.y);
    if (d < 440 && hasLineOfSight(state.city, cop.x, cop.y, player.x, player.y)) {
      spotted = true;
    }
    const slowEnough = !player.vehicle || player.vehicle.speed < 48;
    if (d < 46 && slowEnough) {
      arrestingCopClose = true;
    }
  }

  if (arrestingCopClose) {
    player.bustedProgress += dt * 0.52;
    if (player.bustedProgress >= 1) {
      state.triggerBusted();
      return;
    }
  } else {
    player.bustedProgress = Math.max(0, player.bustedProgress - dt * 0.65);
  }

  pol.sirenProximity = clamp(1 - nearestSirenDist / 900, 0, 1);

  // Spawn reinforcements up to star cap
  const maxCruisers = pol.stars === 1 ? 0 : Math.min(6, pol.stars + 1);
  const maxFoot = Math.min(8, 2 + pol.stars);
  pol.spawnCooldown -= dt;
  if (pol.spawnCooldown <= 0) {
    if (activeCruisers.length < maxCruisers || (pol.stars === 1 && activeOfficers.length < maxFoot)) {
      spawnPoliceUnit(state);
      pol.spawnCooldown = Math.max(1.8, 4.4 - pol.stars * 0.55);
    }
  }

  // Evasion / cooldown logic when out of police sight
  if (spotted) {
    pol.evadeTimer = 0;
    pol.evading = false;
  } else {
    pol.evadeTimer += dt;
    if (pol.evadeTimer > 4.0) {
      pol.evading = true;
      const evadeTarget = 11 + pol.stars * 2.5;
      if (pol.evadeTimer >= evadeTarget) {
        clearWantedLevel(state);
        state.pushDialogue('camila', 'Coast is clear. Lost the PRPD tail.', 2.8);
      }
    }
  }
}
