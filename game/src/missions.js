// 5-mission Palma Rey story campaign: objectives, map markers, dialogue, spawns, and cash rewards.

import { LANDMARKS, WORLD } from './config.js';
import { addPopup } from './effects.js';
import { dist } from './math.js';
import { createPed } from './pedestrians.js';
import { clearWantedLevel, setWantedStars } from './police.js';
import { createVehicle } from './vehicles.js';

export const MISSION_CATALOG = [
  {
    id: 'm1_welcome',
    index: 0,
    title: 'Welcome to Palma Rey',
    giver: 'tito',
    reward: 1500,
    startPoint: LANDMARKS.titoGarage,
    briefing: 'Meet Tito Vance at his garage in Barrio Verde.',
  },
  {
    id: 'm2_neon_debt',
    index: 1,
    title: 'Neon Debt Collection',
    giver: 'tito',
    reward: 2500,
    startPoint: LANDMARKS.titoGarage,
    briefing: 'Recover Tito’s ledger from Cinder Cartel lookouts at Coral Neon Plaza.',
  },
  {
    id: 'm3_harbor_hijack',
    index: 2,
    title: 'Harbor Hijack',
    giver: 'nadia',
    reward: 4000,
    startPoint: LANDMARKS.marinaDock,
    briefing: 'Steal the Cartel chip shipment van from Puerto Dorado Docks.',
  },
  {
    id: 'm4_beachfront_blitz',
    index: 3,
    title: 'Beachfront Blitz',
    giver: 'nadia',
    reward: 6000,
    startPoint: { x: WORLD.plazaX, y: WORLD.plazaY - 120, name: 'Plaza del Sol' },
    briefing: 'Intercept three Cinder Cartel courier vehicles cruising Palma Rey.',
  },
  {
    id: 'm5_last_sunset',
    index: 4,
    title: "Cinder's Last Sunset",
    giver: 'tito',
    reward: 15000,
    startPoint: LANDMARKS.titoGarage,
    briefing: 'Storm Hector Salgado’s estate in Laguna Heights and escape to the Lighthouse Pier.',
  },
];

export function createMissionState() {
  return {
    completedCount: 0,
    active: null, // { id, index, title, stage, objective, marker, reward, targets, timer }
    bannerTimer: 0,
    bannerTitle: '',
    bannerSub: '',
    startCooldown: 0,
    campaignComplete: false,
  };
}

export function getNextAvailableMission(missions) {
  if (missions.completedCount >= MISSION_CATALOG.length) return null;
  return MISSION_CATALOG[missions.completedCount];
}

export function startMission(state, missionIndex) {
  const def = MISSION_CATALOG[missionIndex];
  if (!def) return;

  // Clear previous mission tags
  for (const v of state.vehicles) {
    if (v.missionTag && v.missionTag.startsWith('active_')) v.missionTag = null;
  }

  const m = {
    id: def.id,
    index: def.index,
    title: def.title,
    stage: 0,
    objective: '',
    marker: null,
    reward: def.reward,
    extra: {},
  };
  state.missions.active = m;
  state.missions.bannerTitle = `MISSION ${def.index + 1}: ${def.title.toUpperCase()}`;
  state.missions.bannerSub = def.briefing;
  state.missions.bannerTimer = 3.8;

  if (def.id === 'm1_welcome') {
    m.objective = 'Steal the coral Solero GT from Solero Motors on Coral Strip';
    m.marker = { x: LANDMARKS.coralShowroom.x, y: LANDMARKS.coralShowroom.y + 80, color: '#ffd166', label: 'SOLERO GT' };
    // Ensure a gleaming coral Solero GT waits at the showroom
    let targetCar = state.vehicles.find((v) => v.missionTag === 'showroom' && !v.wrecked);
    if (!targetCar) {
      targetCar = createVehicle('coupe', LANDMARKS.coralShowroom.x - 100, LANDMARKS.coralShowroom.y + 70, 0, {
        color: '#ff5e6c',
        missionTag: 'active_solero',
      });
      state.vehicles.push(targetCar);
    } else {
      targetCar.missionTag = 'active_solero';
      targetCar.color = '#ff5e6c';
      targetCar.hp = targetCar.maxHp;
    }
    m.extra.vehicleId = targetCar.id;
    state.pushDialogue('tito', 'Camila! Good to have you back in Palma Rey. Grab that Solero GT from Coral Strip!', 4.2);
  } else if (def.id === 'm2_neon_debt') {
    m.objective = 'Eliminate the 4 Cinder Cartel lookouts at Coral Neon Plaza (0/4)';
    const cx = 2525;
    const cy = 1790;
    m.marker = { x: cx, y: cy, color: '#ff5263', label: 'CARTEL LOOKOUTS' };
    const offsets = [
      [-62, -28],
      [48, -32],
      [-48, 52],
      [62, 46],
    ];
    m.extra.enemyIds = [];
    for (const [ox, oy] of offsets) {
      const guard = createPed('cartel', cx + ox, cy + oy, { missionTag: 'active_m2_guard' });
      state.peds.push(guard);
      m.extra.enemyIds.push(guard.id);
    }
    state.pushDialogue('tito', 'Salgado’s crew lifted my shop ledger. Hit Coral Neon Plaza and take it back!', 4.2);
  } else if (def.id === 'm3_harbor_hijack') {
    m.objective = 'Clear Cartel dock guards and hijack the Carga Van at Puerto Dorado';
    const mx = LANDMARKS.marinaDock.x;
    const my = LANDMARKS.marinaDock.y;
    m.marker = { x: mx, y: my, color: '#ff9f43', label: 'CARGA VAN' };
    let van = state.vehicles.find((v) => v.missionTag === 'marina' && !v.wrecked);
    if (!van) {
      van = createVehicle('van', mx - 40, my + 20, 0, { color: '#3f76a8', missionTag: 'active_m3_van' });
      state.vehicles.push(van);
    } else {
      van.missionTag = 'active_m3_van';
      van.hp = van.maxHp;
    }
    m.extra.vehicleId = van.id;
    const guardOffsets = [
      [-32, -65],
      [42, -65],
      [0, 62],
      [255, -25],
    ];
    for (const [ox, oy] of guardOffsets) {
      state.peds.push(createPed('cartel', mx + ox, my + oy, { missionTag: 'active_m3_guard' }));
    }
    state.pushDialogue('nadia', 'My scanner tagged a Cartel chip van at Pier 4. Grab it and haul it to Centro Vault!', 4.2);
  } else if (def.id === 'm4_beachfront_blitz') {
    m.objective = 'Destroy 3 Cartel courier cars cruising Palma Rey (0/3)';
    m.extra.courierIds = [];
    const spawns = [
      { x: 2160, y: 880 + WORLD.laneOffset, angle: 0, axis: 'x', dir: 1 },
      { x: 1560 - WORLD.laneOffset, y: 2000, angle: -Math.PI / 2, axis: 'y', dir: -1 },
      { x: 960, y: 1440 - WORLD.laneOffset, angle: Math.PI, axis: 'x', dir: -1 },
    ];
    for (const sp of spawns) {
      const car = createVehicle('coupe', sp.x, sp.y, sp.angle, {
        driver: 'cartel',
        color: '#c92a3e',
        aiAxis: sp.axis,
        aiDir: sp.dir,
        missionTag: 'active_m4_courier',
      });
      car.hp = 95;
      car.maxHp = 95;
      state.vehicles.push(car);
      m.extra.courierIds.push(car.id);
    }
    state.pushDialogue('nadia', 'Three red Cartel couriers are running circuits across town. Take all three offline!', 4.4);
  } else if (def.id === 'm5_last_sunset') {
    m.objective = 'Storm Villa Salgado in Laguna Heights and defeat Hector "El Cobre"';
    const vx = LANDMARKS.hectorVilla.x;
    const vy = LANDMARKS.hectorVilla.y;
    m.marker = { x: vx, y: vy, color: '#ff4757', label: 'VILLA SALGADO' };
    const boss = createPed('boss', vx, vy - 25, { missionTag: 'active_hector' });
    state.peds.push(boss);
    m.extra.bossId = boss.id;
    const bodyguards = [
      [-160, 48],
      [-55, 58],
      [55, 38],
      [15, 92],
    ];
    for (const [ox, oy] of bodyguards) {
      state.peds.push(createPed('cartel', vx + ox, vy + oy, { missionTag: 'active_m5_guard' }));
    }
    // Park Hector's golden Rayo Super in the driveway!
    let escapeCar = state.vehicles.find((v) => v.missionTag === 'villa' && !v.wrecked);
    if (!escapeCar) {
      escapeCar = createVehicle('supercar', vx + 55, vy + 135, 0, {
        color: '#ffd036',
        missionTag: 'active_rayo',
      });
      state.vehicles.push(escapeCar);
    } else {
      escapeCar.missionTag = 'active_rayo';
      escapeCar.color = '#ffd036';
      escapeCar.hp = escapeCar.maxHp;
    }
    m.extra.vehicleId = escapeCar.id;
    state.pushDialogue('tito', 'Time to finish this, Camila. Take down Salgado at his Laguna estate!', 4.4);
  }
}

function completeActiveMission(state) {
  const m = state.missions.active;
  if (!m) return;

  state.player.cash += m.reward;
  state.player.stats.missionsCompleted += 1;
  state.missions.completedCount = Math.max(state.missions.completedCount, m.index + 1);
  addPopup(state.fx, state.player.x, state.player.y - 28, `MISSION COMPLETE +$${m.reward}`, '#ffd166');
  state.audio.playMissionComplete();

  // Progression unlocks per mission
  if (m.id === 'm1_welcome') {
    state.player.ammo.pistol = Math.min(180, state.player.ammo.pistol + 60);
    state.pushDialogue('tito', 'Clean drive! Check my bay whenever you want the next job — we’re taking Palma Rey back.', 4.5);
  } else if (m.id === 'm2_neon_debt') {
    state.player.unlockedWeapons.add('smg');
    state.player.ammo.smg = Math.max(state.player.ammo.smg, 140);
    state.player.weaponIndex = 2;
    state.pushDialogue('nadia', 'Ledger secured! Dropped a Viper SMG in your stash. Meet me at Puerto Dorado Docks.', 4.5);
  } else if (m.id === 'm3_harbor_hijack') {
    state.player.armor = 100;
    state.pushDialogue('nadia', 'Chips unloaded! Full armor vest equipped. Meet at Plaza del Sol to hit their couriers.', 4.5);
  } else if (m.id === 'm4_beachfront_blitz') {
    state.player.unlockedWeapons.add('shotgun');
    state.player.ammo.shotgun = Math.max(state.player.ammo.shotgun, 42);
    state.player.weaponIndex = 3;
    state.pushDialogue('tito', 'Salgado is cornered! Grab the Breacher 12G and meet at my garage for the finale.', 4.5);
  } else if (m.id === 'm5_last_sunset') {
    state.missions.campaignComplete = true;
    clearWantedLevel(state);
    state.pushDialogue('camila', 'Palma Rey is ours. Suncoast skies, clean slate, and the golden Rayo Super.', 5.5);
  }

  state.missions.bannerTitle = 'MISSION PASSED!';
  state.missions.bannerSub = `${m.title} — Reward $${m.reward.toLocaleString()}`;
  state.missions.bannerTimer = 4.2;
  state.missions.startCooldown = 3.2;
  state.missions.active = null;
  state.autoSave();
  state.announce(`Mission passed: ${m.title}. Reward $${m.reward}. Completed ${state.missions.completedCount}/${MISSION_CATALOG.length}.`);
}

export function updateMissions(state, dt) {
  const ms = state.missions;
  if (ms.bannerTimer > 0) ms.bannerTimer = Math.max(0, ms.bannerTimer - dt);
  if (ms.startCooldown > 0) ms.startCooldown = Math.max(0, ms.startCooldown - dt);

  const player = state.player;
  if (!player.alive) return;

  // If no active mission, check if player entered the next mission's start beacon
  if (!ms.active) {
    if (ms.startCooldown > 0) return;
    const next = getNextAvailableMission(ms);
    if (next && dist(player.x, player.y, next.startPoint.x, next.startPoint.y) < 58) {
      startMission(state, next.index);
    }
    return;
  }

  const m = ms.active;

  if (m.id === 'm1_welcome') {
    const targetCar = state.vehicles.find((v) => v.id === m.extra.vehicleId);
    if (!targetCar || targetCar.wrecked) {
      // Respawn target car if accidentally wrecked
      const fresh = createVehicle('coupe', LANDMARKS.coralShowroom.x - 100, LANDMARKS.coralShowroom.y + 70, 0, {
        color: '#ff5e6c',
        missionTag: 'active_solero',
      });
      state.vehicles.push(fresh);
      m.extra.vehicleId = fresh.id;
      m.stage = 0;
      return;
    }

    if (m.stage === 0) {
      m.marker = { x: targetCar.x, y: targetCar.y, color: '#ffd166', label: 'SOLERO GT' };
      if (player.vehicle === targetCar) {
        m.stage = 1;
        m.objective = "Deliver the Solero GT to Tito's Garage in Barrio Verde";
        m.marker = { x: LANDMARKS.titoGarage.x, y: LANDMARKS.titoGarage.y, color: '#2fd6c4', label: "TITO'S GARAGE" };
        setWantedStars(state, 2, 'Showroom Heist');
        state.pushDialogue('camila', 'Alarm tripped! PRPD is rolling — flooring it back to Tito’s!', 3.8);
      }
    } else if (m.stage === 1) {
      if (player.vehicle !== targetCar) {
        m.marker = { x: targetCar.x, y: targetCar.y, color: '#ffd166', label: 'GET BACK IN CAR' };
      } else {
        m.marker = { x: LANDMARKS.titoGarage.x, y: LANDMARKS.titoGarage.y, color: '#2fd6c4', label: "TITO'S GARAGE" };
        if (dist(player.x, player.y, LANDMARKS.titoGarage.x, LANDMARKS.titoGarage.y) < 68) {
          clearWantedLevel(state);
          completeActiveMission(state);
        }
      }
    }
  } else if (m.id === 'm2_neon_debt') {
    if (m.stage === 0) {
      const aliveGuards = state.peds.filter((p) => p.alive && m.extra.enemyIds.includes(p.id));
      const defeated = m.extra.enemyIds.length - aliveGuards.length;
      m.objective = `Eliminate Cinder Cartel lookouts at Coral Neon Plaza (${defeated}/${m.extra.enemyIds.length})`;
      if (aliveGuards.length > 0) {
        m.marker = { x: aliveGuards[0].x, y: aliveGuards[0].y, color: '#ff5263', label: 'CARTEL' };
      } else {
        m.stage = 1;
        m.objective = 'Deliver Tito’s Ledger to Nadia at Puerto Dorado Marina';
        m.marker = { x: LANDMARKS.marinaDock.x, y: LANDMARKS.marinaDock.y, color: '#2fd6c4', label: 'MARINA DROP' };
        setWantedStars(state, 2, 'Plaza Shootout');
        state.pushDialogue('camila', 'Got the ledger! Heading down to Puerto Dorado Marina.', 3.4);
      }
    } else if (m.stage === 1) {
      if (dist(player.x, player.y, LANDMARKS.marinaDock.x, LANDMARKS.marinaDock.y) < 70) {
        clearWantedLevel(state);
        completeActiveMission(state);
      }
    }
  } else if (m.id === 'm3_harbor_hijack') {
    const van = state.vehicles.find((v) => v.id === m.extra.vehicleId);
    if (!van || van.wrecked) {
      const fresh = createVehicle('van', LANDMARKS.marinaDock.x - 40, LANDMARKS.marinaDock.y + 20, 0, {
        color: '#3f76a8',
        missionTag: 'active_m3_van',
      });
      state.vehicles.push(fresh);
      m.extra.vehicleId = fresh.id;
      m.stage = 0;
      return;
    }

    if (m.stage === 0) {
      m.marker = { x: van.x, y: van.y, color: '#ff9f43', label: 'CARGA VAN' };
      if (player.vehicle === van) {
        m.stage = 1;
        m.objective = 'Outrun PRPD and haul the Carga Van to Centro Vault Garage';
        m.marker = { x: LANDMARKS.downtownDrop.x, y: LANDMARKS.downtownDrop.y, color: '#ffd166', label: 'VAULT DROP' };
        setWantedStars(state, 3, 'Harbor Heist');
        state.pushDialogue('nadia', 'PRPD interceptors inbound! Take Central Avenue straight to Centro Vault!', 3.8);
      }
    } else if (m.stage === 1) {
      if (player.vehicle !== van) {
        m.marker = { x: van.x, y: van.y, color: '#ff9f43', label: 'CARGA VAN' };
      } else {
        m.marker = { x: LANDMARKS.downtownDrop.x, y: LANDMARKS.downtownDrop.y, color: '#ffd166', label: 'VAULT DROP' };
        if (dist(player.x, player.y, LANDMARKS.downtownDrop.x, LANDMARKS.downtownDrop.y) < 76) {
          clearWantedLevel(state);
          completeActiveMission(state);
        }
      }
    }
  } else if (m.id === 'm4_beachfront_blitz') {
    const aliveCouriers = state.vehicles.filter((v) => !v.wrecked && m.extra.courierIds.includes(v.id));
    const destroyed = m.extra.courierIds.length - aliveCouriers.length;
    if (m.stage === 0) {
      m.objective = `Destroy Cartel courier cars cruising Palma Rey (${destroyed}/${m.extra.courierIds.length})`;
      if (aliveCouriers.length > 0) {
        // Mark closest courier
        let closest = aliveCouriers[0];
        let bestD = dist(player.x, player.y, closest.x, closest.y);
        for (const c of aliveCouriers) {
          const d = dist(player.x, player.y, c.x, c.y);
          if (d < bestD) {
            bestD = d;
            closest = c;
          }
        }
        m.marker = { x: closest.x, y: closest.y, color: '#ff5263', label: 'COURIER' };
      } else {
        m.stage = 1;
        m.objective = 'Regroup at Plaza del Sol Fountain';
        m.marker = { x: WORLD.plazaX, y: WORLD.plazaY - 120, color: '#2fd6c4', label: 'PLAZA DEL SOL' };
        state.pushDialogue('nadia', 'All three couriers down! Meet back at Plaza del Sol.', 3.4);
      }
    } else if (m.stage === 1) {
      if (dist(player.x, player.y, WORLD.plazaX, WORLD.plazaY - 120) < 76) {
        completeActiveMission(state);
      }
    }
  } else if (m.id === 'm5_last_sunset') {
    const boss = state.peds.find((p) => p.id === m.extra.bossId);
    if (m.stage === 0) {
      if (boss && boss.alive) {
        m.marker = { x: boss.x, y: boss.y, color: '#ff4757', label: 'EL COBRE' };
      } else {
        m.stage = 1;
        m.objective = 'Escape in Hector’s golden Rayo Super to Mirador Lighthouse Pier!';
        setWantedStars(state, 4, 'Cartel Takedown');
        state.pushDialogue('hector', 'You think you own Palma Rey?! The whole precinct is coming down on you!', 3.8);
      }
    } else if (m.stage === 1) {
      const car = state.vehicles.find((v) => v.id === m.extra.vehicleId);
      if (car && !car.wrecked && player.vehicle !== car && dist(player.x, player.y, LANDMARKS.lighthousePier.x, LANDMARKS.lighthousePier.y) > 400) {
        m.marker = { x: car.x, y: car.y, color: '#ffd036', label: 'RAYO SUPER' };
      } else {
        m.marker = { x: LANDMARKS.lighthousePier.x, y: LANDMARKS.lighthousePier.y, color: '#2bd4df', label: 'LIGHTHOUSE PIER' };
      }
      if (dist(player.x, player.y, LANDMARKS.lighthousePier.x, LANDMARKS.lighthousePier.y) < 92) {
        completeActiveMission(state);
      }
    }
  }
}
