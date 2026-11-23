// Player entity, civilian pedestrians, Cartel hostiles, combat, projectiles, and cash drops.

import { PLAYER_SPAWN, WEAPONS, WORLD } from './config.js';
import { addPopup, spawnHitSparks, spawnMuzzleFlash } from './effects.js';
import { hasLineOfSight, isInWater, isOnSidewalk, pointBlockedByBuilding, resolveCircleWorldCollision } from './city.js';
import { clamp, dist, wrapAngle } from './math.js';
import { damageVehicle } from './vehicles.js';

let nextPedId = 1;

const CIV_SHIRTS = ['#ff6b8b', '#3ad1c9', '#ffd166', '#61b5ff', '#ff9f43', '#a8e6cf', '#ffffff', '#c59bff'];
const CIV_SKINS = ['#f2c29b', '#dca37b', '#b87a52', '#8c5535', '#f7d6ba'];
const CIV_HAIR = ['#231f20', '#5a3825', '#d9a441', '#8a3a26', '#3b3d42'];

export function createPlayer() {
  return {
    x: PLAYER_SPAWN.x,
    y: PLAYER_SPAWN.y,
    vx: 0,
    vy: 0,
    angle: PLAYER_SPAWN.angle,
    radius: 13,
    hp: 100,
    maxHp: 100,
    armor: 35,
    maxArmor: 100,
    stamina: 100,
    cash: 650,
    vehicle: null,
    weaponIndex: 1, // Start with 9mm Palma & Street Baton unlocked
    unlockedWeapons: new Set(['baton', 'pistol']),
    ammo: {
      baton: Infinity,
      pistol: 72,
      smg: 0,
      shotgun: 0,
    },
    fireCooldown: 0,
    walkCycle: 0,
    alive: true,
    bustedProgress: 0,
    busted: false,
    respawnTimer: 0,
    stats: {
      carsStolen: 0,
      enemiesDefeated: 0,
      missionsCompleted: 0,
      distanceDriven: 0,
    },
  };
}

export function createPed(kind, x, y, opts = {}) {
  const isPolice = kind === 'police';
  const isCartel = kind === 'cartel';
  const isBoss = kind === 'boss';
  return {
    id: nextPedId++,
    kind, // 'civilian' | 'police' | 'cartel' | 'boss'
    x,
    y,
    vx: 0,
    vy: 0,
    angle: opts.angle ?? Math.random() * Math.PI * 2,
    radius: isBoss ? 15 : 12,
    hp: opts.hp || (isBoss ? 220 : isCartel ? 75 : isPolice ? 80 : 40),
    maxHp: opts.hp || (isBoss ? 220 : isCartel ? 75 : isPolice ? 80 : 40),
    alive: true,
    state: opts.state || 'stroll', // 'stroll' | 'flee' | 'chase' | 'attack' | 'guard'
    walkCycle: Math.random() * 6.28,
    stateTimer: 1 + Math.random() * 3,
    fireCooldown: 0.4 + Math.random() * 0.5,
    shirt: isPolice
      ? '#1f4e8c'
      : isBoss
        ? '#c92a3e'
        : isCartel
          ? '#d64545'
          : CIV_SHIRTS[Math.floor(Math.random() * CIV_SHIRTS.length)],
    skin: CIV_SKINS[Math.floor(Math.random() * CIV_SKINS.length)],
    hair: CIV_HAIR[Math.floor(Math.random() * CIV_HAIR.length)],
    hasHat: !isPolice && !isCartel && Math.random() < 0.25,
    weapon: isBoss ? 'shotgun' : isCartel ? (Math.random() < 0.4 ? 'smg' : 'pistol') : isPolice ? 'pistol' : null,
    missionTag: opts.missionTag || null,
    despawnTimer: 0,
    homeX: x,
    homeY: y,
  };
}

export function spawnInitialPeds(city) {
  const peds = [];
  let attempts = 0;
  while (peds.length < 44 && attempts < 400) {
    attempts++;
    const onBeach = peds.length < 10;
    let x;
    let y;
    if (onBeach) {
      x = WORLD.boardwalkX + 12 + Math.random() * 250;
      y = 220 + Math.random() * (WORLD.height - 440);
    } else {
      x = 180 + Math.random() * 2660;
      y = 180 + Math.random() * 2240;
      if (!isOnSidewalk(x, y)) continue;
    }
    if (isInWater(x, y) || pointBlockedByBuilding(city, x, y, 16)) continue;
    if (peds.some((p) => dist(p.x, p.y, x, y) < 60)) continue;
    peds.push(createPed('civilian', x, y));
  }

  // Spawn 4 patrolling PRPD beat officers around downtown & Coral Strip
  const beatSpots = [
    { x: 1860, y: 1850 },
    { x: 1560, y: 1290 },
    { x: 2675, y: 1620 },
    { x: 960, y: 1360 },
  ];
  for (const spot of beatSpots) {
    peds.push(createPed('police', spot.x, spot.y, { state: 'stroll' }));
  }

  return peds;
}

export function alertPedsInRadius(state, x, y, radius = 320) {
  for (const p of state.peds) {
    if (!p.alive || p.kind !== 'civilian') continue;
    if (dist(p.x, p.y, x, y) < radius) {
      p.state = 'flee';
      p.stateTimer = 4.5 + Math.random() * 3;
      p.angle = Math.atan2(p.y - y, p.x - x) + (Math.random() - 0.5) * 0.5;
    }
  }
}

export function fireWeapon(state, shooter, weaponId, originX, originY, angle, isPlayer) {
  const weapon = WEAPONS.find((w) => w.id === weaponId) || WEAPONS[1];

  if (weapon.melee) {
    state.audio.playGunshot('baton');
    const hitX = originX + Math.cos(angle) * 28;
    const hitY = originY + Math.sin(angle) * 28;
    spawnHitSparks(state.fx, hitX, hitY, '#ffffff', 4);
    for (const p of state.peds) {
      if (!p.alive || p === shooter) continue;
      if (dist(hitX, hitY, p.x, p.y) < 30) {
        p.hp -= weapon.damage;
        spawnHitSparks(state.fx, p.x, p.y, '#ff5e6c', 6);
        if (isPlayer) {
          if (p.kind === 'police') state.addHeat(24, 'Assaulting Officer');
          else if (p.kind === 'civilian') state.addHeat(12, 'Street Assault');
        }
        if (p.hp <= 0) state.killPed(p, isPlayer ? 'player' : 'npc');
      }
    }
    return;
  }

  state.audio.playGunshot(weapon.id);
  const muzzleX = originX + Math.cos(angle) * 18;
  const muzzleY = originY + Math.sin(angle) * 18;
  spawnMuzzleFlash(state.fx, muzzleX, muzzleY, angle, weapon.color);

  if (isPlayer) {
    alertPedsInRadius(state, originX, originY, 360);
    state.camera.shake = Math.max(state.camera.shake, weapon.id === 'shotgun' ? 5.2 : 1.8);
    // Firing in public attracts police attention if near officers
    const nearCop = state.peds.some((p) => p.alive && p.kind === 'police' && dist(p.x, p.y, originX, originY) < 420);
    if (nearCop) state.addHeat(8, 'Weapons Discharge');
  }

  const pellets = weapon.pellets || 1;
  for (let i = 0; i < pellets; i++) {
    const spread = (Math.random() - 0.5) * weapon.spread * 2;
    const a = angle + spread;
    state.bullets.push({
      x: muzzleX,
      y: muzzleY,
      prevX: muzzleX,
      prevY: muzzleY,
      vx: Math.cos(a) * weapon.speed,
      vy: Math.sin(a) * weapon.speed,
      damage: weapon.damage,
      life: weapon.range / weapon.speed,
      owner: isPlayer ? 'player' : shooter.kind,
      color: weapon.color,
    });
  }
}

export function updateBullets(state, dt) {
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.prevX = b.x;
    b.prevY = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;

    if (b.life <= 0 || pointBlockedByBuilding(state.city, b.x, b.y, 1)) {
      if (b.life > 0) spawnHitSparks(state.fx, b.x, b.y, '#ffe699', 4);
      state.bullets.splice(i, 1);
      continue;
    }

    // Check hit on player
    if (b.owner !== 'player' && state.player.alive) {
      const target = state.player.vehicle || state.player;
      const hitR = state.player.vehicle ? state.player.vehicle.radius * 0.78 : state.player.radius + 3;
      if (dist(b.x, b.y, target.x, target.y) < hitR) {
        if (state.player.vehicle) {
          damageVehicle(state, state.player.vehicle, b.damage * 0.3, b.owner);
          spawnHitSparks(state.fx, b.x, b.y, '#ffd166', 4);
        } else {
          state.damagePlayer(b.damage * 0.52, b.owner === 'police' ? 'PRPD Fire' : 'Cartel Fire');
          spawnHitSparks(state.fx, b.x, b.y, '#ff5e6c', 5);
        }
        state.bullets.splice(i, 1);
        continue;
      }
    }

    // Check hit on peds
    let consumed = false;
    for (const p of state.peds) {
      if (!p.alive) continue;
      if (b.owner === p.kind) continue;
      if (b.owner === 'boss' && p.kind === 'cartel') continue;
      if (b.owner === 'cartel' && p.kind === 'boss') continue;
      if (dist(b.x, b.y, p.x, p.y) < p.radius + 4) {
        p.hp -= b.damage;
        spawnHitSparks(state.fx, b.x, b.y, '#ff5e6c', 6);
        if (b.owner === 'player') {
          if (p.kind === 'police') state.addHeat(22, 'Firing on Officer');
          else if (p.kind === 'civilian') state.addHeat(16, 'Civilian Harmed');
        }
        if (p.hp <= 0) {
          state.killPed(p, b.owner);
        } else if (p.kind === 'civilian') {
          p.state = 'flee';
          p.stateTimer = 6;
        }
        state.bullets.splice(i, 1);
        consumed = true;
        break;
      }
    }
    if (consumed) continue;

    // Check hit on vehicles
    for (const v of state.vehicles) {
      if (v === state.player.vehicle && b.owner === 'player') continue;
      if (dist(b.x, b.y, v.x, v.y) < v.radius * 0.78) {
        damageVehicle(state, v, b.damage * 0.65, b.owner);
        spawnHitSparks(state.fx, b.x, b.y, '#ffd166', 5);
        if (b.owner === 'player' && v.spec.isPolice) {
          state.addHeat(12, 'Damaging PRPD Cruiser');
        }
        state.bullets.splice(i, 1);
        break;
      }
    }
  }
}

export function updatePeds(state, dt) {
  const player = state.player;
  const px = player.x;
  const py = player.y;

  // Maintain civilian population around player
  const civCount = state.peds.filter((p) => p.alive && p.kind === 'civilian').length;
  if (civCount < 38) {
    const a = Math.random() * Math.PI * 2;
    const r = 560 + Math.random() * 440;
    const sx = clamp(px + Math.cos(a) * r, 140, 3180);
    const sy = clamp(py + Math.sin(a) * r, 140, 2520);
    if (!isInWater(sx, sy) && !pointBlockedByBuilding(state.city, sx, sy, 16) && (isOnSidewalk(sx, sy) || sx > WORLD.boardwalkX)) {
      state.peds.push(createPed('civilian', sx, sy));
    }
  }

  for (let i = state.peds.length - 1; i >= 0; i--) {
    const p = state.peds[i];
    if (!p.alive) {
      p.despawnTimer -= dt;
      if (p.despawnTimer <= 0) state.peds.splice(i, 1);
      continue;
    }

    const dPlayer = dist(p.x, p.y, px, py);

    // Despawn far civilians
    if (p.kind === 'civilian' && dPlayer > 1400) {
      state.peds.splice(i, 1);
      continue;
    }

    let moveSpeed = 0;

    if (p.kind === 'civilian') {
      p.stateTimer -= dt;
      if (p.state === 'flee') {
        moveSpeed = 135;
        p.angle = Math.atan2(p.y - py, p.x - px);
        if (p.stateTimer <= 0 && dPlayer > 360) {
          p.state = 'stroll';
          p.stateTimer = 2 + Math.random() * 3;
        }
      } else {
        moveSpeed = 48;
        if (p.stateTimer <= 0) {
          p.stateTimer = 2.2 + Math.random() * 3.5;
          p.angle = wrapAngle(p.angle + (Math.random() - 0.5) * 1.8);
        }
      }
    } else if (p.kind === 'cartel' || p.kind === 'boss') {
      const engageDist = p.kind === 'boss' ? 560 : 480;
      if (player.alive && dPlayer < engageDist) {
        p.angle = Math.atan2(py - p.y, px - p.x);
        const canSee = hasLineOfSight(state.city, p.x, p.y, px, py);
        if (dPlayer > 180 || !canSee) {
          moveSpeed = p.kind === 'boss' ? 128 : 112;
        } else if (dPlayer < 110) {
          moveSpeed = -50;
        }
        p.fireCooldown -= dt;
        if (canSee && p.fireCooldown <= 0) {
          p.fireCooldown = p.kind === 'boss' ? 0.72 : p.weapon === 'smg' ? 0.34 : 0.78;
          fireWeapon(state, p, p.weapon || 'pistol', p.x, p.y, p.angle + (Math.random() - 0.5) * 0.14, false);
        }
      } else {
        // Guard around home position
        if (dist(p.x, p.y, p.homeX, p.homeY) > 70) {
          p.angle = Math.atan2(p.homeY - p.y, p.homeX - p.x);
          moveSpeed = 65;
        }
      }
    } else if (p.kind === 'police') {
      if (state.police.stars > 0 && player.alive) {
        p.angle = Math.atan2(py - p.y, px - p.x);
        const canSee = hasLineOfSight(state.city, p.x, p.y, px, py);
        if (dPlayer > 155 || state.police.stars === 1 || !canSee) {
          moveSpeed = 142 + state.police.stars * 8;
        }
        // At 2+ stars, officers engage with sidearms
        if (state.police.stars >= 2 && canSee && dPlayer < 410) {
          p.fireCooldown -= dt;
          if (p.fireCooldown <= 0) {
            p.fireCooldown = Math.max(0.42, 0.95 - state.police.stars * 0.1);
            fireWeapon(state, p, 'pistol', p.x, p.y, p.angle + (Math.random() - 0.5) * 0.15, false);
          }
        }
      } else {
        // Patrol beat calmly
        p.stateTimer -= dt;
        moveSpeed = 52;
        if (p.stateTimer <= 0) {
          p.stateTimer = 2.5 + Math.random() * 2.5;
          p.angle = wrapAngle(p.angle + (Math.random() - 0.5) * 1.5);
        }
      }
    }

    p.vx = Math.cos(p.angle) * moveSpeed;
    p.vy = Math.sin(p.angle) * moveSpeed;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (Math.abs(moveSpeed) > 10) {
      p.walkCycle += dt * (Math.abs(moveSpeed) * 0.09);
    }

    const hitWall = resolveCircleWorldCollision(state.city, p, p.radius);
    if (hitWall && p.state === 'stroll') {
      p.angle = wrapAngle(p.angle + Math.PI * 0.72);
    }

    // Check fast-moving vehicle collisions against pedestrians
    for (const v of state.vehicles) {
      if (v.speed < 85) continue;
      if (dist(p.x, p.y, v.x, v.y) < v.radius * 0.72 + p.radius) {
        const hitDmg = v.speed * 0.42;
        p.hp -= hitDmg;
        spawnHitSparks(state.fx, p.x, p.y, '#ff5e6c', 7);
        if (v.driver === 'player') {
          state.audio.playCrash(0.35);
          if (p.kind === 'police') state.addHeat(30, 'Hit Police Officer');
          else if (p.kind === 'civilian') state.addHeat(16, 'Reckless Driving');
        }
        if (p.hp <= 0) {
          state.killPed(p, v.driver);
        } else {
          // Push ped aside
          const pushA = Math.atan2(p.y - v.y, p.x - v.x);
          p.x += Math.cos(pushA) * 26;
          p.y += Math.sin(pushA) * 26;
        }
        break;
      }
    }
  }

  // Update & collect ground pickups (cash, medkits, ammo)
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const item = state.pickups[i];
    item.bob += dt * 4;
    item.life -= dt;
    if (item.life <= 0) {
      state.pickups.splice(i, 1);
      continue;
    }
    if (player.alive && dist(player.x, player.y, item.x, item.y) < 34) {
      if (item.kind === 'cash') {
        player.cash += item.amount;
        addPopup(state.fx, item.x, item.y - 12, `+$${item.amount}`, '#6ef2a8');
      } else if (item.kind === 'medkit') {
        player.hp = Math.min(player.maxHp, player.hp + 45);
        addPopup(state.fx, item.x, item.y - 12, '+45 HP', '#5ce1e6');
      } else if (item.kind === 'ammo') {
        player.ammo.pistol = Math.min(180, player.ammo.pistol + 24);
        if (player.unlockedWeapons.has('smg')) player.ammo.smg = Math.min(320, player.ammo.smg + 40);
        if (player.unlockedWeapons.has('shotgun')) player.ammo.shotgun = Math.min(96, player.ammo.shotgun + 10);
        addPopup(state.fx, item.x, item.y - 12, '+AMMO', '#ffd166');
      }
      state.audio.playPickup();
      state.pickups.splice(i, 1);
    }
  }
}
