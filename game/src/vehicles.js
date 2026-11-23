// Vehicle entities, arcade-drift driving physics, vehicle collisions, damage, and NPC traffic AI.

import { VEHICLE_TYPES, WORLD } from './config.js';
import { addSkidmark, spawnExplosion, spawnHitSparks, spawnSmoke } from './effects.js';
import { angleDiff, clamp, dist, wrapAngle } from './math.js';
import { resolveCircleWorldCollision } from './city.js';

let nextVehicleId = 1;

export function createVehicle(typeId, x, y, angle = 0, opts = {}) {
  const spec = VEHICLE_TYPES[typeId] || VEHICLE_TYPES.sedan;
  const color = opts.color || spec.colors[Math.floor(Math.random() * spec.colors.length)];
  return {
    id: nextVehicleId++,
    type: spec.id,
    spec,
    x,
    y,
    prevX: x,
    prevY: y,
    vx: 0,
    vy: 0,
    speed: 0,
    angle,
    color,
    hp: spec.hp,
    maxHp: spec.hp,
    driver: opts.driver || null, // 'player' | 'traffic' | 'police' | 'cartel' | null
    sirenOn: Boolean(opts.sirenOn),
    sirenPhase: Math.random() * 6.28,
    braking: false,
    drifting: false,
    wrecked: false,
    wreckTimer: 0,
    smokeTimer: 0,
    aiAxis: opts.aiAxis || (Math.abs(Math.cos(angle)) > 0.5 ? 'x' : 'y'),
    aiDir: opts.aiDir || 1,
    aiTargetSpeed: spec.maxSpeed * (0.38 + Math.random() * 0.14),
    aiTurnCooldown: 0,
    missionTag: opts.missionTag || null,
    honkCooldown: 0,
    crashCooldown: 0,
    radius: Math.max(spec.length, spec.width) * 0.44,
  };
}

export function spawnInitialVehicles(city) {
  const list = [];
  // Spawn parked cars in landmark/curbside parking spots
  for (const spot of city.parkingSpots) {
    const v = createVehicle(spot.type, spot.x, spot.y, spot.angle, {
      driver: null,
      missionTag: spot.reserved || null,
    });
    list.push(v);
  }

  // Spawn lively initial NPC traffic along Palma Rey's boulevards & avenues
  const civilianTypes = ['sedan', 'coupe', 'cabrio', 'suv', 'sedan', 'van'];
  const featuredTraffic = [
    { x: 2760 - WORLD.laneOffset, y: 1220, angle: Math.PI / 2, type: 'coupe', axis: 'y', dir: 1 },
    { x: 2760 + WORLD.laneOffset, y: 1640, angle: -Math.PI / 2, type: 'cabrio', axis: 'y', dir: -1 },
    { x: 2320, y: 1440 + WORLD.laneOffset, angle: 0, type: 'sedan', axis: 'x', dir: 1 },
    { x: 2510, y: 1440 - WORLD.laneOffset, angle: Math.PI, type: 'suv', axis: 'x', dir: -1 },
    { x: 2160 - WORLD.laneOffset, y: 1310, angle: Math.PI / 2, type: 'coupe', axis: 'y', dir: 1 },
    { x: 1840, y: 1440 + WORLD.laneOffset, angle: 0, type: 'cabrio', axis: 'x', dir: 1 },
    { x: 1220, y: 1440 - WORLD.laneOffset, angle: Math.PI, type: 'van', axis: 'x', dir: -1 },
    { x: 960 + WORLD.laneOffset, y: 1180, angle: -Math.PI / 2, type: 'sedan', axis: 'y', dir: -1 },
  ];
  for (const ft of featuredTraffic) {
    list.push(
      createVehicle(ft.type, ft.x, ft.y, ft.angle, {
        driver: 'traffic',
        aiAxis: ft.axis,
        aiDir: ft.dir,
      }),
    );
  }

  for (let i = 0; i < 28; i++) {
    const horizontal = i % 2 === 0;
    const type = civilianTypes[i % civilianTypes.length];
    let x;
    let y;
    let angle;
    let aiDir;
    if (horizontal) {
      const ry = WORLD.roadY[i % WORLD.roadY.length];
      aiDir = i % 4 < 2 ? 1 : -1;
      y = ry + aiDir * WORLD.laneOffset;
      x = 240 + ((i * 237) % 2400);
      angle = aiDir > 0 ? 0 : Math.PI;
    } else {
      const rx = WORLD.roadX[i % WORLD.roadX.length];
      aiDir = i % 4 < 2 ? 1 : -1;
      x = rx - aiDir * WORLD.laneOffset;
      y = 220 + ((i * 271) % 2100);
      angle = aiDir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    if (list.some((other) => dist(other.x, other.y, x, y) < 110)) continue;
    list.push(
      createVehicle(type, x, y, angle, {
        driver: 'traffic',
        aiAxis: horizontal ? 'x' : 'y',
        aiDir,
      }),
    );
  }
  return list;
}

export function maintainTraffic(state) {
  const activeTraffic = state.vehicles.filter((v) => v.driver === 'traffic' && !v.wrecked);
  if (activeTraffic.length >= 30) return;

  const cam = state.camera;
  const civilianTypes = ['sedan', 'sedan', 'coupe', 'cabrio', 'suv', 'van'];
  const horizontal = Math.random() < 0.5;
  let x;
  let y;
  let angle;
  let aiDir;

  if (horizontal) {
    const ry = WORLD.roadY[Math.floor(Math.random() * WORLD.roadY.length)];
    aiDir = Math.random() < 0.5 ? 1 : -1;
    y = ry + aiDir * WORLD.laneOffset;
    x = clamp(cam.x + (Math.random() < 0.5 ? -860 : 860), 220, 2720);
    angle = aiDir > 0 ? 0 : Math.PI;
  } else {
    const rx = WORLD.roadX[Math.floor(Math.random() * WORLD.roadX.length)];
    aiDir = Math.random() < 0.5 ? 1 : -1;
    x = rx - aiDir * WORLD.laneOffset;
    y = clamp(cam.y + (Math.random() < 0.5 ? -680 : 680), 180, 2400);
    angle = aiDir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  if (dist(x, y, state.player.x, state.player.y) < 520) return;
  if (state.vehicles.some((v) => dist(v.x, v.y, x, y) < 120)) return;
  if (x < WORLD.harborX && y > WORLD.harborY - 60) return;

  const type = civilianTypes[Math.floor(Math.random() * civilianTypes.length)];
  state.vehicles.push(
    createVehicle(type, x, y, angle, {
      driver: 'traffic',
      aiAxis: horizontal ? 'x' : 'y',
      aiDir,
    }),
  );
}

export function damageVehicle(state, vehicle, amount, attacker = null) {
  if (vehicle.wrecked) return;
  vehicle.hp -= amount;
  if (vehicle.hp <= 0) {
    vehicle.hp = 0;
    explodeVehicle(state, vehicle, attacker);
  }
}

export function explodeVehicle(state, vehicle, attacker = null) {
  if (vehicle.wrecked) return;
  vehicle.wrecked = true;
  vehicle.driver = null;
  vehicle.sirenOn = false;
  vehicle.wreckTimer = 18;
  vehicle.vx *= 0.25;
  vehicle.vy *= 0.25;

  spawnExplosion(state.fx, vehicle.x, vehicle.y, 118);
  state.audio.playExplosion();
  state.camera.shake = Math.max(state.camera.shake, 16);

  // Blast damage to player, peds, and nearby vehicles
  const blastR = 128;
  if (state.player.vehicle === vehicle) {
    state.player.vehicle = null;
    state.player.x = vehicle.x + Math.cos(vehicle.angle + Math.PI / 2) * 34;
    state.player.y = vehicle.y + Math.sin(vehicle.angle + Math.PI / 2) * 34;
    state.damagePlayer(55, 'Explosion');
  } else if (dist(state.player.x, state.player.y, vehicle.x, vehicle.y) < blastR) {
    state.damagePlayer(38, 'Explosion');
  }

  for (const p of state.peds) {
    if (!p.alive) continue;
    const d = dist(p.x, p.y, vehicle.x, vehicle.y);
    if (d < blastR) {
      p.hp -= 120 * (1 - d / blastR);
      if (p.hp <= 0) state.killPed(p, attacker);
    }
  }

  if (attacker === 'player') {
    state.addHeat(vehicle.spec.isPolice ? 38 : 22, 'Vehicle Destroyed');
  }
}

export function driveVehicleWithControls(vehicle, controls, dt, fx) {
  const spec = vehicle.spec;
  const fwdX = Math.cos(vehicle.angle);
  const fwdY = Math.sin(vehicle.angle);
  const rightX = -fwdY;
  const rightY = fwdX;

  let forwardSpeed = vehicle.vx * fwdX + vehicle.vy * fwdY;
  let lateralSpeed = vehicle.vx * rightX + vehicle.vy * rightY;

  vehicle.braking = false;
  vehicle.drifting = false;

  if (controls.throttle > 0) {
    forwardSpeed += spec.accel * controls.throttle * dt;
  } else if (controls.brake > 0) {
    if (forwardSpeed > 25) {
      forwardSpeed = Math.max(0, forwardSpeed - spec.brake * controls.brake * dt);
      vehicle.braking = true;
    } else {
      forwardSpeed -= spec.accel * 0.65 * controls.brake * dt;
      vehicle.braking = true;
    }
  } else {
    // Natural rolling friction
    forwardSpeed *= Math.exp(-1.55 * dt);
  }

  if (controls.handbrake) {
    forwardSpeed *= Math.exp(-2.4 * dt);
    vehicle.braking = true;
  }

  forwardSpeed = clamp(forwardSpeed, -spec.reverseSpeed, spec.maxSpeed);

  // Speed-sensitive steering
  const speedFactor = clamp(Math.abs(forwardSpeed) / 110, 0, 1);
  if (Math.abs(controls.steer) > 0.01 && speedFactor > 0.05) {
    const dir = forwardSpeed >= -5 ? 1 : -1;
    const driftBoost = controls.handbrake ? 1.28 : 1.0;
    vehicle.angle = wrapAngle(
      vehicle.angle + controls.steer * spec.turnRate * driftBoost * speedFactor * dir * dt,
    );
  }

  const grip = controls.handbrake ? spec.driftGrip : spec.grip;
  lateralSpeed *= Math.exp(-grip * dt);

  const newFwdX = Math.cos(vehicle.angle);
  const newFwdY = Math.sin(vehicle.angle);
  const newRightX = -newFwdY;
  const newRightY = newFwdX;

  vehicle.vx = newFwdX * forwardSpeed + newRightX * lateralSpeed;
  vehicle.vy = newFwdY * forwardSpeed + newRightY * lateralSpeed;
  vehicle.speed = Math.hypot(vehicle.vx, vehicle.vy);

  // Drift tire marks & smoke
  if (Math.abs(lateralSpeed) > 68 || (controls.handbrake && vehicle.speed > 135)) {
    vehicle.drifting = true;
    const rearX = vehicle.x - newFwdX * (spec.length * 0.34);
    const rearY = vehicle.y - newFwdY * (spec.length * 0.34);
    const prevRearX = vehicle.prevX - newFwdX * (spec.length * 0.34);
    const prevRearY = vehicle.prevY - newFwdY * (spec.length * 0.34);
    const halfTrack = spec.width * 0.36;
    addSkidmark(
      fx,
      prevRearX + newRightX * halfTrack,
      prevRearY + newRightY * halfTrack,
      rearX + newRightX * halfTrack,
      rearY + newRightY * halfTrack,
    );
    addSkidmark(
      fx,
      prevRearX - newRightX * halfTrack,
      prevRearY - newRightY * halfTrack,
      rearX - newRightX * halfTrack,
      rearY - newRightY * halfTrack,
    );
    if (Math.random() < 0.45) {
      spawnSmoke(fx, rearX, rearY, false);
    }
  }
}

function updateTrafficAI(state, v, dt) {
  v.aiTurnCooldown = Math.max(0, v.aiTurnCooldown - dt);
  v.honkCooldown = Math.max(0, v.honkCooldown - dt);

  // Check if approaching an intersection to optionally turn
  if (v.aiTurnCooldown <= 0) {
    const nearX = WORLD.roadX.find((rx) => Math.abs(v.x - rx) < 26);
    const nearY = WORLD.roadY.find((ry) => Math.abs(v.y - ry) < 26);
    if (nearX !== undefined && nearY !== undefined) {
      // Avoid driving into harbor water
      const roll = Math.random();
      if (roll < 0.28) {
        if (v.aiAxis === 'x') {
          v.aiAxis = 'y';
          v.aiDir = Math.random() < 0.5 ? 1 : -1;
          if (nearX < WORLD.harborX && nearY >= 2000) v.aiDir = -1;
        } else {
          v.aiAxis = 'x';
          v.aiDir = Math.random() < 0.5 ? 1 : -1;
          if (nearX >= 2700) v.aiDir = -1;
        }
        v.aiTurnCooldown = 1.6;
      } else {
        v.aiTurnCooldown = 0.8;
      }
    }
  }

  // Turn around cleanly at map road borders
  if (v.aiAxis === 'x') {
    if (v.x > 2740 && v.aiDir > 0) {
      v.aiAxis = 'y';
      v.aiDir = v.y > 1400 ? -1 : 1;
      v.aiTurnCooldown = 1.4;
    } else if (v.x < 340 && v.aiDir < 0) {
      v.aiAxis = 'y';
      v.aiDir = v.y > 1200 ? -1 : 1;
      v.aiTurnCooldown = 1.4;
    }
  } else {
    if (v.y > 2430 && v.aiDir > 0) {
      v.aiAxis = 'x';
      v.aiDir = v.x > 1500 ? -1 : 1;
      v.aiTurnCooldown = 1.4;
    } else if (v.y < 310 && v.aiDir < 0) {
      v.aiAxis = 'x';
      v.aiDir = v.x > 1500 ? -1 : 1;
      v.aiTurnCooldown = 1.4;
    }
  }

  // Compute desired lane position and heading
  let targetAngle = 0;
  let laneError = 0;
  if (v.aiAxis === 'x') {
    targetAngle = v.aiDir > 0 ? 0 : Math.PI;
    const nearestRy = WORLD.roadY.reduce((best, ry) =>
      Math.abs(ry - v.y) < Math.abs(best - v.y) ? ry : best,
    );
    const desiredY = nearestRy + v.aiDir * WORLD.laneOffset;
    laneError = clamp((desiredY - v.y) * v.aiDir * 0.015, -0.45, 0.45);
  } else {
    targetAngle = v.aiDir > 0 ? Math.PI / 2 : -Math.PI / 2;
    const nearestRx = WORLD.roadX.reduce((best, rx) =>
      Math.abs(rx - v.x) < Math.abs(best - v.x) ? rx : best,
    );
    const desiredX = nearestRx - v.aiDir * WORLD.laneOffset;
    laneError = clamp((v.x - desiredX) * v.aiDir * 0.015, -0.45, 0.45);
  }

  // Steer gently around central Plaza del Sol fountain
  const dPlaza = dist(v.x, v.y, WORLD.plazaX, WORLD.plazaY);
  if (dPlaza < 125) {
    const away = Math.atan2(v.y - WORLD.plazaY, v.x - WORLD.plazaX);
    targetAngle = wrapAngle(away + Math.PI / 2);
    laneError = 0;
  }

  const desiredHeading = wrapAngle(targetAngle + laneError);
  const steerDiff = angleDiff(v.angle, desiredHeading);

  // Check for obstacles ahead (other cars or player)
  let blocked = false;
  const fwdX = Math.cos(v.angle);
  const fwdY = Math.sin(v.angle);
  for (const other of state.vehicles) {
    if (other === v) continue;
    const dx = other.x - v.x;
    const dy = other.y - v.y;
    const d = Math.hypot(dx, dy);
    if (d < 115 && d > 1) {
      const forwardDot = (dx * fwdX + dy * fwdY) / d;
      if (forwardDot > 0.72) {
        blocked = true;
        break;
      }
    }
  }
  if (!blocked && !state.player.vehicle) {
    const dx = state.player.x - v.x;
    const dy = state.player.y - v.y;
    const d = Math.hypot(dx, dy);
    if (d < 78 && (dx * fwdX + dy * fwdY) / Math.max(1, d) > 0.75) {
      blocked = true;
      if (v.honkCooldown <= 0 && d < 65) {
        v.honkCooldown = 3.5;
        state.audio.playHorn();
      }
    }
  }

  const controls = {
    throttle: blocked ? 0 : v.speed < v.aiTargetSpeed ? 0.65 : 0.1,
    brake: blocked ? 0.9 : 0,
    steer: clamp(steerDiff * 1.9, -1, 1),
    handbrake: false,
  };
  driveVehicleWithControls(v, controls, dt, state.fx);
}

export function updateVehicles(state, dt, playerControls) {
  maintainTraffic(state);

  for (let i = state.vehicles.length - 1; i >= 0; i--) {
    const v = state.vehicles[i];
    v.prevX = v.x;
    v.prevY = v.y;

    if (v.wrecked) {
      v.vx *= Math.exp(-3 * dt);
      v.vy *= Math.exp(-3 * dt);
      v.x += v.vx * dt;
      v.y += v.vy * dt;
      v.wreckTimer -= dt;
      v.smokeTimer -= dt;
      if (v.smokeTimer <= 0) {
        v.smokeTimer = 0.24;
        spawnSmoke(state.fx, v.x, v.y, true);
      }
      if (v.wreckTimer <= 0 && dist(v.x, v.y, state.player.x, state.player.y) > 950) {
        state.vehicles.splice(i, 1);
      }
      continue;
    }

    if (v.sirenOn) {
      v.sirenPhase += dt * 9.5;
    }
    if (v.crashCooldown > 0) {
      v.crashCooldown = Math.max(0, v.crashCooldown - dt);
    }

    if (v.driver === 'player') {
      driveVehicleWithControls(v, playerControls, dt, state.fx);
    } else if (v.driver === 'traffic') {
      updateTrafficAI(state, v, dt);
    } else if (v.driver === 'police') {
      // Police AI drives via police.js helper attached onto v.aiControl
      if (v.aiControl) {
        driveVehicleWithControls(v, v.aiControl, dt, state.fx);
      }
    } else if (v.driver === 'cartel') {
      if (v.aiControl) {
        driveVehicleWithControls(v, v.aiControl, dt, state.fx);
      } else {
        updateTrafficAI(state, v, dt);
      }
    } else {
      // Parked / coasting empty vehicle
      v.vx *= Math.exp(-3.2 * dt);
      v.vy *= Math.exp(-3.2 * dt);
      v.speed = Math.hypot(v.vx, v.vy);
      v.braking = false;
      v.drifting = false;
    }

    v.x += v.vx * dt;
    v.y += v.vy * dt;

    // World & building collisions
    const hitWall = resolveCircleWorldCollision(state.city, v, v.radius * 0.85);
    if (hitWall) {
      const impact = v.speed;
      v.vx *= -0.22;
      v.vy *= -0.22;
      if (impact > 165 && v.crashCooldown <= 0) {
        v.crashCooldown = 0.35;
        const dmg = Math.min(20, (impact - 150) * 0.045);
        damageVehicle(state, v, dmg, v.driver);
        spawnHitSparks(state.fx, v.x, v.y, '#ffd166', 6);
        if (v.driver === 'player') {
          state.audio.playCrash(clamp(impact / 420, 0.25, 1));
          state.camera.shake = Math.max(state.camera.shake, clamp(impact / 60, 2, 8));
        }
      }
    }

    // Smoke & flames on damaged vehicles
    const hpRatio = v.hp / v.maxHp;
    if (hpRatio < 0.45) {
      v.smokeTimer -= dt;
      if (v.smokeTimer <= 0) {
        v.smokeTimer = hpRatio < 0.2 ? 0.08 : 0.18;
        const hoodX = v.x + Math.cos(v.angle) * (v.spec.length * 0.32);
        const hoodY = v.y + Math.sin(v.angle) * (v.spec.length * 0.32);
        spawnSmoke(state.fx, hoodX, hoodY, true);
        if (hpRatio < 0.18) {
          spawnHitSparks(state.fx, hoodX, hoodY, '#ff6338', 2);
          damageVehicle(state, v, 7 * dt, null);
        }
      }
    }

    // Despawn distant generic traffic
    if (
      v.driver === 'traffic' &&
      !v.missionTag &&
      dist(v.x, v.y, state.player.x, state.player.y) > 1550
    ) {
      state.vehicles.splice(i, 1);
    }
  }

  // Vehicle-to-vehicle collisions
  for (let i = 0; i < state.vehicles.length; i++) {
    const a = state.vehicles[i];
    for (let j = i + 1; j < state.vehicles.length; j++) {
      const b = state.vehicles[j];
      const minD = (a.radius + b.radius) * 0.86;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d < minD && d > 0.01) {
        const nx = dx / d;
        const ny = dy / d;
        const overlap = minD - d;
        const totalMass = a.spec.mass + b.spec.mass;
        const ratioA = b.spec.mass / totalMass;
        const ratioB = a.spec.mass / totalMass;
        a.x -= nx * overlap * ratioA;
        a.y -= ny * overlap * ratioA;
        b.x += nx * overlap * ratioB;
        b.y += ny * overlap * ratioB;

        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const relVel = rvx * nx + rvy * ny;
        if (relVel < 0) {
          const impulse = -relVel * 1.15;
          a.vx -= nx * impulse * ratioA;
          a.vy -= ny * impulse * ratioA;
          b.vx += nx * impulse * ratioB;
          b.vy += ny * impulse * ratioB;

          const impact = Math.abs(relVel);
          if (impact > 125 && (a.crashCooldown <= 0 || b.crashCooldown <= 0)) {
            const mx = (a.x + b.x) * 0.5;
            const my = (a.y + b.y) * 0.5;
            spawnHitSparks(state.fx, mx, my, '#ffd166', 7);
            const dmg = Math.min(24, (impact - 105) * 0.055);
            if (a.crashCooldown <= 0) {
              a.crashCooldown = 0.35;
              damageVehicle(state, a, dmg * ratioA, b.driver);
            }
            if (b.crashCooldown <= 0) {
              b.crashCooldown = 0.35;
              damageVehicle(state, b, dmg * ratioB, a.driver);
            }

            if (a.driver === 'player' || b.driver === 'player') {
              state.audio.playCrash(clamp(impact / 380, 0.25, 1));
              state.camera.shake = Math.max(state.camera.shake, clamp(impact / 50, 2, 10));
              const other = a.driver === 'player' ? b : a;
              if (other.spec.isPolice) {
                state.addHeat(18, 'Ramming PRPD Cruiser');
              }
            }
          }
        }
      }
    }
  }
}
