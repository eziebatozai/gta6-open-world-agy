// Core game engine: coordinates simulation subsystems, camera, vehicle hijacking, shops, and save/load.

import { LANDMARKS, TIME_MODES, WEAPONS, WORLD } from './config.js';
import { SoundEngine } from './audio.js';
import { buildCity, resolveCircleWorldCollision } from './city.js';
import { addPopup, createEffectsState, spawnHitSparks, updateEffects } from './effects.js';
import { clamp, dist, lerp } from './math.js';
import { createMissionState, updateMissions } from './missions.js';
import { createPed, createPlayer, fireWeapon, spawnInitialPeds, updateBullets, updatePeds } from './pedestrians.js';
import { addPoliceHeat, clearWantedLevel, createPoliceState, updatePolice } from './police.js';
import { loadSavedGame, saveGameState } from './storage.js';
import { spawnInitialVehicles, updateVehicles } from './vehicles.js';

export function createGameEngine(input, announceStatus) {
  const city = buildCity(20261123);
  const audio = new SoundEngine();

  const state = {
    city,
    audio,
    input,
    announce: announceStatus || (() => {}),
    screen: 'title', // 'title' | 'playing' | 'paused' | 'armory' | 'wasted' | 'busted'
    time: 0,
    timeMode: 'suncoast',
    player: createPlayer(),
    vehicles: spawnInitialVehicles(city),
    peds: spawnInitialPeds(city),
    bullets: [],
    pickups: [],
    fx: createEffectsState(),
    police: createPoliceState(),
    missions: createMissionState(),
    camera: { x: 2560, y: 1440, shake: 0 },
    dialogue: null,
    dialogueQueue: [],
    promptText: '',
    uiButtons: [],
    viewW: window.innerWidth,
    viewH: window.innerHeight,

    pushDialogue(speaker, text, duration = 3.8) {
      if (!state.dialogue) {
        state.dialogue = { speaker, text, timer: duration };
      } else {
        if (state.dialogueQueue.length > 3) state.dialogueQueue.shift();
        state.dialogueQueue.push({ speaker, text, timer: duration });
      }
      state.announce(`${speaker}: ${text}`);
    },

    addHeat(amount, reason) {
      addPoliceHeat(state, amount, reason);
    },

    damagePlayer(amount, source = '') {
      const p = state.player;
      if (!p.alive || state.screen !== 'playing') return;
      let rem = amount;
      if (p.armor > 0) {
        const absorbed = Math.min(p.armor, rem * 0.7);
        p.armor -= absorbed;
        rem -= absorbed;
      }
      p.hp = Math.max(0, p.hp - rem);
      state.camera.shake = Math.max(state.camera.shake, 4.5);
      if (p.hp <= 0) {
        p.alive = false;
        p.vehicle = null;
        p.respawnTimer = 3.6;
        state.screen = 'wasted';
        state.announce(`Wasted by ${source || 'injuries'}.`);
      }
    },

    triggerBusted() {
      const p = state.player;
      if (!p.alive) return;
      p.alive = false;
      p.busted = true;
      if (p.vehicle) {
        p.vehicle.driver = null;
        p.vehicle = null;
      }
      p.respawnTimer = 3.6;
      state.screen = 'busted';
      state.announce('Busted by PRPD.');
    },

    killPed(ped, killer) {
      if (!ped.alive) return;
      ped.alive = false;
      ped.despawnTimer = 10;
      if (killer === 'player') {
        state.player.stats.enemiesDefeated += 1;
        const dropAmt = ped.kind === 'boss' ? 1200 : ped.kind === 'cartel' ? 160 : 45;
        state.pickups.push({ kind: 'cash', x: ped.x, y: ped.y, amount: dropAmt, bob: 0, life: 35 });
        if (ped.kind === 'cartel' || ped.kind === 'boss') {
          if (Math.random() < 0.45) {
            state.pickups.push({ kind: 'medkit', x: ped.x + 14, y: ped.y, bob: 1, life: 35 });
          } else {
            state.pickups.push({ kind: 'ammo', x: ped.x + 14, y: ped.y, bob: 2, life: 35 });
          }
        }
        if (ped.kind === 'police') state.addHeat(34, 'Officer Down');
        else if (ped.kind === 'civilian') state.addHeat(22, 'Civilian Casualty');
      }
    },

    autoSave() {
      saveGameState(state);
    },
  };

  function resetWorld(loadSave = false) {
    state.city = buildCity(20261123);
    state.player = createPlayer();
    state.vehicles = spawnInitialVehicles(state.city);
    state.peds = spawnInitialPeds(state.city);
    state.bullets = [];
    state.pickups = [];
    state.fx = createEffectsState();
    state.police = createPoliceState();
    state.missions = createMissionState();
    state.dialogue = null;
    state.dialogueQueue = [];

    if (loadSave) {
      const saved = loadSavedGame();
      if (saved) {
        state.timeMode = TIME_MODES.includes(saved.timeMode) ? saved.timeMode : 'suncoast';
        state.audio.setMuted(Boolean(saved.muted));
        state.player.x = clamp(saved.player.x, 80, WORLD.width - 80);
        state.player.y = clamp(saved.player.y, 80, WORLD.height - 80);
        state.player.angle = saved.player.angle || 0;
        state.player.hp = clamp(saved.player.hp || 100, 25, 100);
        state.player.armor = clamp(saved.player.armor || 0, 0, 100);
        state.player.cash = Math.max(0, saved.player.cash || 0);
        state.player.weaponIndex = saved.player.weaponIndex ?? 1;
        state.player.unlockedWeapons = new Set(saved.player.unlockedWeapons || ['baton', 'pistol']);
        state.player.ammo = { ...state.player.ammo, ...(saved.player.ammo || {}) };
        state.player.stats = { ...state.player.stats, ...(saved.player.stats || {}) };
        state.missions.completedCount = saved.missions?.completedCount || 0;
        state.missions.campaignComplete = Boolean(saved.missions?.campaignComplete);
        for (const st of state.city.stashes) {
          if (saved.collectedStashes?.includes(st.id)) st.collected = true;
        }
        state.pushDialogue('camila', 'Back on the Palma Rey streets. Save loaded.', 3.2);
      }
    } else {
      state.pushDialogue(
        'tito',
        'Camila! Welcome back to Palma Rey. Grab a ride on Coral Strip and meet me at my garage in Barrio Verde!',
        5.2,
      );
    }

    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    state.screen = 'playing';
  }

  function respawnPlayer() {
    const p = state.player;
    const spot = state.screen === 'busted' ? LANDMARKS.precinct : LANDMARKS.clinic;
    p.x = spot.x;
    p.y = spot.y + 110;
    p.hp = p.maxHp;
    p.alive = true;
    p.busted = false;
    p.bustedProgress = 0;
    p.cash = Math.max(0, p.cash - 150);
    clearWantedLevel(state);
    state.screen = 'playing';
    state.camera.x = p.x;
    state.camera.y = p.y;
  }

  function tryToggleVehicle() {
    const p = state.player;
    if (p.vehicle) {
      const v = p.vehicle;
      const exitAngle = v.angle - Math.PI / 2;
      p.x = v.x + Math.cos(exitAngle) * (v.spec.width * 0.65 + 14);
      p.y = v.y + Math.sin(exitAngle) * (v.spec.width * 0.65 + 14);
      p.angle = v.angle;
      v.driver = null;
      p.vehicle = null;
      state.audio.playDoor();
      resolveCircleWorldCollision(state.city, p, p.radius);
      return;
    }

    // Find closest non-wrecked vehicle within entry radius
    let nearest = null;
    let bestD = 88;
    for (const v of state.vehicles) {
      if (v.wrecked) continue;
      const d = dist(p.x, p.y, v.x, v.y);
      if (d < bestD) {
        bestD = d;
        nearest = v;
      }
    }

    if (!nearest) return;

    const wasOccupied = nearest.driver === 'traffic' || nearest.driver === 'police' || nearest.driver === 'cartel';
    if (wasOccupied) {
      const ejectX = nearest.x + Math.cos(nearest.angle + Math.PI / 2) * 32;
      const ejectY = nearest.y + Math.sin(nearest.angle + Math.PI / 2) * 32;
      const pedKind = nearest.driver === 'police' ? 'police' : nearest.driver === 'cartel' ? 'cartel' : 'civilian';
      const ejected = createPed(pedKind, ejectX, ejectY, { state: pedKind === 'civilian' ? 'flee' : 'chase' });
      state.peds.push(ejected);

      if (nearest.spec.isPolice) {
        state.addHeat(44, 'Grand Theft Police Cruiser');
      } else {
        const copNearby = state.peds.some((c) => c.alive && c.kind === 'police' && dist(c.x, c.y, nearest.x, nearest.y) < 420);
        state.addHeat(copNearby ? 22 : 10, 'Vehicle Hijack');
      }
    } else if (nearest.spec.isPolice) {
      state.addHeat(24, 'Stolen PRPD Cruiser');
    }

    nearest.driver = 'player';
    p.vehicle = nearest;
    p.stats.carsStolen += 1;
    state.audio.playDoor();
    addPopup(state.fx, nearest.x, nearest.y - 24, nearest.spec.name.toUpperCase(), '#2fd6c4');
    state.announce(`Entered ${nearest.spec.name}`);
  }

  function tryInteractShop() {
    const p = state.player;
    for (const shop of state.city.shops) {
      if (dist(p.x, p.y, shop.x, shop.y) > shop.r + 22) continue;
      if (shop.kind === 'respray') {
        if (!p.vehicle) {
          addPopup(state.fx, p.x, p.y - 22, 'DRIVE A CAR IN TO RESPRAY', '#ffd166');
          return true;
        }
        if (p.cash < 300) {
          addPopup(state.fx, p.x, p.y - 22, 'NEED $300 FOR RESPRAY', '#ff5263');
          return true;
        }
        p.cash -= 300;
        p.vehicle.hp = p.vehicle.maxHp;
        const colors = p.vehicle.spec.colors;
        p.vehicle.color = colors[Math.floor(Math.random() * colors.length)];
        clearWantedLevel(state);
        state.audio.playPickup();
        addPopup(state.fx, p.x, p.y - 28, 'REPAIRED & HEAT CLEARED!', '#3ee8a5');
        state.autoSave();
        return true;
      }
      if (shop.kind === 'armory') {
        state.screen = 'armory';
        return true;
      }
    }
    return false;
  }

  function handleButtonAction(id) {
    state.audio.unlock();
    if (id === 'new_game' || id === 'restart') {
      resetWorld(false);
    } else if (id === 'continue' || id === 'load') {
      resetWorld(true);
    } else if (id === 'resume') {
      state.screen = 'playing';
    } else if (id === 'save') {
      const ok = saveGameState(state);
      addPopup(state.fx, state.player.x, state.player.y - 26, ok ? 'GAME SAVED!' : 'SAVE FAILED', '#ffd166');
      state.audio.playPickup();
      state.screen = 'playing';
    } else if (id === 'time_cycle') {
      const idx = TIME_MODES.indexOf(state.timeMode);
      state.timeMode = TIME_MODES[(idx + 1) % TIME_MODES.length];
    } else if (id === 'mute') {
      state.audio.toggleMute();
    } else if (id === 'respawn_now') {
      respawnPlayer();
    } else if (id === 'buy_medkit' && state.player.cash >= 250) {
      state.player.cash -= 250;
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + 60);
      state.audio.playPickup();
    } else if (id === 'buy_armor' && state.player.cash >= 400) {
      state.player.cash -= 400;
      state.player.armor = 100;
      state.audio.playPickup();
    } else if (id === 'buy_smg' && state.player.cash >= 800) {
      state.player.cash -= 800;
      state.player.unlockedWeapons.add('smg');
      state.player.ammo.smg = Math.min(320, state.player.ammo.smg + 140);
      state.player.weaponIndex = 2;
      state.audio.playPickup();
    } else if (id === 'buy_shotgun' && state.player.cash >= 1200) {
      state.player.cash -= 1200;
      state.player.unlockedWeapons.add('shotgun');
      state.player.ammo.shotgun = Math.min(96, state.player.ammo.shotgun + 32);
      state.player.weaponIndex = 3;
      state.audio.playPickup();
    } else if (id === 'buy_ammo' && state.player.cash >= 150) {
      state.player.cash -= 150;
      state.player.ammo.pistol = 180;
      if (state.player.unlockedWeapons.has('smg')) state.player.ammo.smg = 320;
      if (state.player.unlockedWeapons.has('shotgun')) state.player.ammo.shotgun = 96;
      state.audio.playPickup();
    }
  }

  function update(dt) {
    const safeDt = Math.min(dt, 0.05);
    state.time += safeDt;

    // Handle UI button clicks across menus
    if (state.input.mouseClicked && state.screen !== 'playing') {
      for (const btn of state.uiButtons) {
        if (
          state.input.mouseX >= btn.x &&
          state.input.mouseX <= btn.x + btn.w &&
          state.input.mouseY >= btn.y &&
          state.input.mouseY <= btn.y + btn.h
        ) {
          handleButtonAction(btn.id);
          return;
        }
      }
    }

    if (state.screen === 'title') {
      // Gentle scenic camera pan over Coral Strip & Mirador Beach behind start overlay
      state.camera.x = 2480 + Math.cos(state.time * 0.14) * 380;
      state.camera.y = 1420 + Math.sin(state.time * 0.18) * 320;
      updateVehicles(state, safeDt, { throttle: 0, brake: 0, steer: 0, handbrake: false });
      updateEffects(state.fx, safeDt);
      if (state.input.anyPressed(['Enter', 'Space'])) {
        state.audio.unlock();
        resetWorld(false);
      }
      return;
    }

    if (state.screen === 'paused' || state.screen === 'armory') {
      if (state.input.anyPressed(['Escape', 'KeyP'])) {
        state.screen = 'playing';
      }
      return;
    }

    if (state.screen === 'wasted' || state.screen === 'busted') {
      state.player.respawnTimer -= safeDt;
      if (state.player.respawnTimer <= 0 || state.input.anyPressed(['Enter', 'Space'])) {
        respawnPlayer();
      }
      updateEffects(state.fx, safeDt);
      return;
    }

    // Playing screen: pause toggle
    if (state.input.anyPressed(['Escape', 'KeyP'])) {
      state.screen = 'paused';
      state.audio.updateContinuous(safeDt, { inVehicle: false, speedRatio: 0, drifting: false, policeNear: 0 });
      return;
    }

    // Time-of-day quick hotkey [T]
    if (state.input.wasPressed('KeyT')) {
      const idx = TIME_MODES.indexOf(state.timeMode);
      state.timeMode = TIME_MODES[(idx + 1) % TIME_MODES.length];
      addPopup(state.fx, state.player.x, state.player.y - 26, state.timeMode.toUpperCase(), '#ffd166');
    }

    // Sound mute hotkey [M]
    if (state.input.wasPressed('KeyM')) {
      const muted = state.audio.toggleMute();
      addPopup(state.fx, state.player.x, state.player.y - 26, muted ? 'SOUND MUTED' : 'SOUND ON', '#2fd6c4');
    }

    // Unlock WebAudio on first key or click in gameplay
    if (state.input.mouseClicked || state.input.pressed.size > 0) {
      state.audio.unlock();
    }

    // Dialogue queue timer
    if (state.dialogue) {
      state.dialogue.timer -= safeDt;
      if (state.dialogue.timer <= 0) {
        state.dialogue = state.dialogueQueue.shift() || null;
      }
    }

    // Weapon switching
    const p = state.player;
    const slotKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
    slotKeys.forEach((code, idx) => {
      if (state.input.wasPressed(code) && p.unlockedWeapons.has(WEAPONS[idx].id)) {
        p.weaponIndex = idx;
      }
    });
    if (state.input.wheelDelta !== 0) {
      const dir = state.input.wheelDelta > 0 ? 1 : -1;
      for (let tries = 0; tries < WEAPONS.length; tries++) {
        p.weaponIndex = (p.weaponIndex + dir + WEAPONS.length) % WEAPONS.length;
        if (p.unlockedWeapons.has(WEAPONS[p.weaponIndex].id)) break;
      }
    }

    // Interact: [E] prioritizes nearby shop, else enter/exit vehicle; [F] always toggles vehicle
    if (state.input.wasPressed('KeyF')) {
      tryToggleVehicle();
    } else if (state.input.wasPressed('KeyE')) {
      if (!tryInteractShop()) tryToggleVehicle();
    }

    // Horn while driving [H]
    if (p.vehicle && state.input.wasPressed('KeyH')) {
      state.audio.playHorn();
    }

    // Player controls (driving vs on foot)
    const up = state.input.anyDown(['KeyW', 'ArrowUp']);
    const down = state.input.anyDown(['KeyS', 'ArrowDown']);
    const left = state.input.anyDown(['KeyA', 'ArrowLeft']);
    const right = state.input.anyDown(['KeyD', 'ArrowRight']);
    const sprint = state.input.anyDown(['ShiftLeft', 'ShiftRight']);

    const driveControls = {
      throttle: up ? 1 : 0,
      brake: down ? 1 : 0,
      steer: (right ? 1 : 0) - (left ? 1 : 0),
      handbrake: state.input.down('Space'),
    };

    if (!p.vehicle) {
      // On-foot movement
      let mx = (right ? 1 : 0) - (left ? 1 : 0);
      let my = (down ? 1 : 0) - (up ? 1 : 0);
      const mag = Math.hypot(mx, my);
      if (mag > 0) {
        mx /= mag;
        my /= mag;
        const speed = sprint && p.stamina > 8 ? 225 : 148;
        if (sprint) p.stamina = Math.max(0, p.stamina - 22 * safeDt);
        else p.stamina = Math.min(100, p.stamina + 26 * safeDt);
        p.vx = mx * speed;
        p.vy = my * speed;
        p.x += p.vx * safeDt;
        p.y += p.vy * safeDt;
        p.walkCycle += safeDt * (speed * 0.09);
      } else {
        p.vx = 0;
        p.vy = 0;
        p.stamina = Math.min(100, p.stamina + 34 * safeDt);
      }
      resolveCircleWorldCollision(state.city, p, p.radius);

      // Aim smoothly toward mouse cursor in world space
      const aimWorldX = state.camera.x - state.viewW / 2 + state.input.mouseX;
      const aimWorldY = state.camera.y - state.viewH / 2 + state.input.mouseY;
      p.angle = Math.atan2(aimWorldY - p.y, aimWorldX - p.x);

      // Firing weapon (Left mouse button or Space on foot)
      p.fireCooldown = Math.max(0, p.fireCooldown - safeDt);
      if ((state.input.mouseDown || state.input.down('Space')) && p.fireCooldown <= 0) {
        const wpn = WEAPONS[p.weaponIndex] || WEAPONS[0];
        if (wpn.unlimited || (p.ammo[wpn.id] ?? 0) > 0) {
          if (!wpn.unlimited) p.ammo[wpn.id] -= 1;
          p.fireCooldown = wpn.fireRate;
          fireWeapon(state, p, wpn.id, p.x, p.y, p.angle, true);
        }
      }
    }

    // Update all world subsystems
    updateVehicles(state, safeDt, driveControls);

    if (p.vehicle) {
      p.x = p.vehicle.x;
      p.y = p.vehicle.y;
      p.angle = p.vehicle.angle;
      p.vx = p.vehicle.vx;
      p.vy = p.vehicle.vy;
      p.stats.distanceDriven += p.vehicle.speed * safeDt;
    }

    updatePolice(state, safeDt);
    updatePeds(state, safeDt);
    updateBullets(state, safeDt);
    updateMissions(state, safeDt);
    updateEffects(state.fx, safeDt);

    // Check hidden cash stashes
    for (const st of state.city.stashes) {
      if (!st.collected && dist(p.x, p.y, st.x, st.y) < 38) {
        st.collected = true;
        p.cash += st.amount;
        addPopup(state.fx, st.x, st.y - 16, `HIDDEN STASH +$${st.amount}!`, '#62f2a6');
        state.audio.playPickup();
        state.autoSave();
      }
    }

    // Compute context prompt pill
    state.promptText = '';
    for (const shop of state.city.shops) {
      if (dist(p.x, p.y, shop.x, shop.y) < shop.r + 22) {
        state.promptText = shop.kind === 'respray' ? '[E] Pay & Respray ($300 — Clear Wanted)' : '[E] Open El Mercado Armory';
        break;
      }
    }
    if (!state.promptText && !p.vehicle) {
      let nearestCar = null;
      let bestD = 84;
      for (const v of state.vehicles) {
        if (v.wrecked) continue;
        const d = dist(p.x, p.y, v.x, v.y);
        if (d < bestD) {
          bestD = d;
          nearestCar = v;
        }
      }
      if (nearestCar) {
        const action = nearestCar.driver ? 'Hijack' : 'Enter';
        state.promptText = `[F] ${action} ${nearestCar.spec.name}`;
      }
    }

    // Smooth camera follow with speed look-ahead
    const lookX = p.vehicle ? p.vehicle.vx * 0.24 : Math.cos(p.angle) * 28;
    const lookY = p.vehicle ? p.vehicle.vy * 0.24 : Math.sin(p.angle) * 28;
    const targetCamX = clamp(p.x + lookX, state.viewW / 2, Math.max(state.viewW / 2, WORLD.width - state.viewW / 2));
    const targetCamY = clamp(p.y + lookY, state.viewH / 2, Math.max(state.viewH / 2, WORLD.height - state.viewH / 2));
    const followRate = 1 - Math.exp(-6.5 * safeDt);
    state.camera.x = lerp(state.camera.x, targetCamX, followRate);
    state.camera.y = lerp(state.camera.y, targetCamY, followRate);
    state.camera.shake = Math.max(0, state.camera.shake - 26 * safeDt);

    // Continuous WebAudio soundscape update
    state.audio.updateContinuous(safeDt, {
      inVehicle: Boolean(p.vehicle),
      speedRatio: p.vehicle ? clamp(p.vehicle.speed / p.vehicle.spec.maxSpeed, 0, 1) : 0,
      baseHz: p.vehicle ? p.vehicle.spec.engineBaseHz : 70,
      drifting: Boolean(p.vehicle?.drifting),
      policeNear: state.police.sirenProximity,
    });
  }

  return {
    state,
    update,
    resetWorld,
    handleButtonAction,
  };
}
