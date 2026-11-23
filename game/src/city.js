// Procedural city builder for Palma Rey: 6 districts, roads, beachfront, marina, buildings, props, and spatial queries.

import { DISTRICTS, LANDMARKS, WORLD } from './config.js';
import { circleRectPush, createRng, dist, pointInRect, segmentIntersectsRect } from './math.js';

const ART_DECO_PALETTES = [
  { body: '#f7c5c8', roof: '#f9e3e4', trim: '#ff6ba9', accent: '#2bd4df' },
  { body: '#b8eedf', roof: '#def9f1', trim: '#1fb5a3', accent: '#ff8a5b' },
  { body: '#fae3b4', roof: '#fff4da', trim: '#f29f38', accent: '#ff5e84' },
  { body: '#c4e0f9', roof: '#e6f3ff', trim: '#3b9be8', accent: '#ffd166' },
  { body: '#f8d5b8', roof: '#ffeedf', trim: '#f06d4f', accent: '#2fd6c4' },
];

const DOWNTOWN_PALETTES = [
  { body: '#cfd9e3', roof: '#8ea3b8', trim: '#4b86b4', accent: '#62d4ff' },
  { body: '#dbe3e8', roof: '#a5b5c4', trim: '#2e6b8a', accent: '#ffd166' },
  { body: '#c5d6df', roof: '#7c96a8', trim: '#2994a8', accent: '#ff6b8b' },
  { body: '#e5e2dc', roof: '#b7b3ab', trim: '#56708a', accent: '#36c9b8' },
];

const BARRIO_PALETTES = [
  { body: '#e8b087', roof: '#c45b3e', trim: '#f5d799', accent: '#2cc7b3' },
  { body: '#e8c499', roof: '#b85037', trim: '#e07a5f', accent: '#f2cc8f' },
  { body: '#d9a07e', roof: '#a84732', trim: '#f4d35e', accent: '#48b8d0' },
  { body: '#edd3a8', roof: '#c96242', trim: '#e66c55', accent: '#3bb273' },
];

const LAGUNA_PALETTES = [
  { body: '#f4efe6', roof: '#d67a54', trim: '#48b89f', accent: '#ffd166' },
  { body: '#f2eadc', roof: '#c96c4c', trim: '#3898c4', accent: '#ff7e67' },
  { body: '#ebe6dc', roof: '#8598a6', trim: '#58b368', accent: '#42d4c6' },
];

export function getDistrictAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x <= d.x1 && y >= d.y0 && y <= d.y1) return d;
  }
  return DISTRICTS[DISTRICTS.length - 1];
}

export function isOnRoad(x, y) {
  const half = WORLD.roadWidth / 2;
  if (x > WORLD.boardwalkX - 10) return false;
  if (x < WORLD.harborX && y > WORLD.harborY) return false;
  for (const rx of WORLD.roadX) {
    if (Math.abs(x - rx) <= half) return true;
  }
  for (const ry of WORLD.roadY) {
    if (Math.abs(y - ry) <= half && x <= WORLD.roadX[WORLD.roadX.length - 1] + half) return true;
  }
  return false;
}

export function isOnSidewalk(x, y) {
  if (isOnRoad(x, y)) return false;
  const outer = WORLD.roadWidth / 2 + WORLD.sidewalkWidth;
  if (x >= WORLD.boardwalkX && x <= WORLD.beachX) return true;
  if (x > WORLD.boardwalkX) return false;
  if (x < WORLD.harborX && y > WORLD.harborY) return false;
  for (const rx of WORLD.roadX) {
    if (Math.abs(x - rx) <= outer) return true;
  }
  for (const ry of WORLD.roadY) {
    if (Math.abs(y - ry) <= outer && x <= WORLD.roadX[WORLD.roadX.length - 1] + outer) return true;
  }
  return false;
}

export function isInWater(x, y) {
  // Mirador Lighthouse Pier stays dry!
  if (x >= WORLD.oceanX - 10 && x <= 3500 && Math.abs(y - 1440) <= 38) return false;
  if (x >= WORLD.oceanX) return true;
  // Puerto Dorado harbor slips
  if (x < WORLD.harborX && y > WORLD.harborY) {
    // Concrete piers remain walkable
    if (x >= 180 && x <= 290 && y <= 2590) return false;
    if (x >= 470 && x <= 580 && y <= 2590) return false;
    if (x >= 740 && x <= 860 && y <= 2590) return false;
    return true;
  }
  return false;
}

export function buildCity(seed = 20261123) {
  const rng = createRng(seed);
  const buildings = [];
  const parks = [];
  const pools = [];
  const palms = [];
  const umbrellas = [];
  const boats = [];
  const containers = [];
  const lamps = [];
  const parkingSpots = [];
  const shops = [];
  const stashes = [];

  const halfRoad = WORLD.roadWidth / 2;
  const sw = WORLD.sidewalkWidth;
  const margin = halfRoad + sw + 10;

  // Compute block interiors between roads.
  const xCols = [
    { x0: 64, x1: WORLD.roadX[0] - margin },
    { x0: WORLD.roadX[0] + margin, x1: WORLD.roadX[1] - margin },
    { x0: WORLD.roadX[1] + margin, x1: WORLD.roadX[2] - margin },
    { x0: WORLD.roadX[2] + margin, x1: WORLD.roadX[3] - margin },
    { x0: WORLD.roadX[3] + margin, x1: WORLD.roadX[4] - margin },
  ];
  const yRows = [
    { y0: 56, y1: WORLD.roadY[0] - margin },
    { y0: WORLD.roadY[0] + margin, y1: WORLD.roadY[1] - margin },
    { y0: WORLD.roadY[1] + margin, y1: WORLD.roadY[2] - margin },
    { y0: WORLD.roadY[2] + margin, y1: WORLD.roadY[3] - margin },
    { y0: WORLD.roadY[3] + margin, y1: WORLD.roadY[4] - margin },
  ];

  function addBuilding(b) {
    buildings.push({
      x: b.x,
      y: b.y,
      w: b.w,
      h: b.h,
      height: b.height || 26,
      body: b.body,
      roof: b.roof,
      trim: b.trim,
      accent: b.accent || '#ffd166',
      style: b.style || 'deco',
      label: b.label || '',
      neon: b.neon || '',
      hasHelipad: Boolean(b.hasHelipad),
      hasPool: Boolean(b.hasPool),
      hasAc: b.hasAc !== false,
    });
  }

  // Build each city block based on its district identity and landmark assignments.
  for (let row = 0; row < yRows.length; row++) {
    for (let col = 0; col < xCols.length; col++) {
      const bx = xCols[col].x0;
      const by = yRows[row].y0;
      const bw = xCols[col].x1 - bx;
      const bh = yRows[row].y1 - by;
      const cx = bx + bw / 2;
      const cy = by + bh / 2;
      const district = getDistrictAt(cx, cy).id;

      // Special landmark blocks:
      // 1. Hector's Villa Estate (Laguna Heights: col 1, row 1)
      if (col === 1 && row === 1) {
        parks.push({ x: bx, y: by, w: bw, h: bh, kind: 'estate' });
        addBuilding({
          x: bx + 34,
          y: by + 28,
          w: bw - 140,
          h: 120,
          height: 30,
          ...LAGUNA_PALETTES[0],
          style: 'villa',
          label: 'VILLA SALGADO',
          hasAc: false,
        });
        addBuilding({
          x: bx + bw - 92,
          y: by + 28,
          w: 62,
          h: 170,
          height: 22,
          ...LAGUNA_PALETTES[1],
          style: 'villa',
          hasAc: false,
        });
        pools.push({ x: bx + 48, y: by + 185, w: 155, h: 78, kind: 'pool' });
        parkingSpots.push({ x: bx + 250, y: by + 310, angle: 0, type: 'supercar', reserved: 'villa' });
        for (let i = 0; i < 6; i++) {
          palms.push({ x: bx + 26 + i * 68, y: by + bh - 20, r: 22 + (i % 2) * 4, phase: i * 1.1 });
        }
        continue;
      }

      // 2. Tito's Garage block (Barrio Verde: col 1, row 2)
      if (col === 1 && row === 2) {
        addBuilding({
          x: bx + 16,
          y: by + 16,
          w: 220,
          h: 150,
          height: 24,
          body: '#e6c79c',
          roof: '#3a4958',
          trim: '#2fd6c4',
          accent: '#ff6b7a',
          style: 'garage',
          label: "TITO'S GARAGE",
          neon: '#2fd6c4',
        });
        addBuilding({
          x: bx + 258,
          y: by + 16,
          w: bw - 274,
          h: 155,
          height: 26,
          ...BARRIO_PALETTES[0],
          style: 'barrio',
        });
        // Open courtyard/driveway for Tito's mission marker
        parkingSpots.push({ x: bx + 125, y: by + 255, angle: 0, type: 'coupe' });
        parkingSpots.push({ x: bx + 290, y: by + 295, angle: Math.PI, type: 'sedan' });
        palms.push({ x: bx + 24, y: by + bh - 28, r: 23, phase: 0.4 });
        palms.push({ x: bx + bw - 26, y: by + bh - 28, r: 24, phase: 2.1 });
        continue;
      }

      // 3. Suncoast Respray Garage (Barrio Verde: col 1, row 3)
      if (col === 1 && row === 3) {
        addBuilding({
          x: bx + 18,
          y: by + 18,
          w: 190,
          h: 130,
          height: 24,
          body: '#eef2f5',
          roof: '#2d7a5e',
          trim: '#3ee8a5',
          accent: '#ffd166',
          style: 'garage',
          label: 'PAY & RESPRAY',
          neon: '#3ee8a5',
        });
        addBuilding({
          x: bx + 230,
          y: by + 18,
          w: bw - 246,
          h: bh - 36,
          height: 28,
          ...BARRIO_PALETTES[2],
          style: 'barrio',
        });
        shops.push({
          id: 'respray_west',
          kind: 'respray',
          x: LANDMARKS.resprayWest.x,
          y: LANDMARKS.resprayWest.y,
          r: 44,
          label: 'PAY & RESPRAY ($300)',
          color: '#3ee8a5',
        });
        continue;
      }

      // 4. El Mercado Armory + Barrio Courtyard (col 2, row 2)
      if (col === 2 && row === 2) {
        addBuilding({
          x: bx + 16,
          y: by + 16,
          w: 170,
          h: 165,
          height: 28,
          ...BARRIO_PALETTES[1],
          style: 'barrio',
        });
        addBuilding({
          x: bx + 204,
          y: by + 16,
          w: bw - 220,
          h: 165,
          height: 24,
          body: '#323d4c',
          roof: '#232c38',
          trim: '#ff9f43',
          accent: '#ffd166',
          style: 'armory',
          label: 'ARMORY KIOSK',
          neon: '#ff9f43',
        });
        shops.push({
          id: 'armory_main',
          kind: 'armory',
          x: LANDMARKS.gearKiosk.x,
          y: LANDMARKS.gearKiosk.y,
          r: 40,
          label: 'GEAR KIOSK [E]',
          color: '#ff9f43',
        });
        palms.push({ x: bx + 46, y: by + 290, r: 22, phase: 1.5 });
        palms.push({ x: bx + 340, y: by + 290, r: 24, phase: 3.1 });
        continue;
      }

      // 5. Palma Rey Clinic (col 2, row 3)
      if (col === 2 && row === 3) {
        addBuilding({
          x: bx + 24,
          y: by + 20,
          w: bw - 48,
          h: 170,
          height: 36,
          body: '#f4f7fa',
          roof: '#dce6ee',
          trim: '#ff5263',
          accent: '#39c6d4',
          style: 'hospital',
          label: 'PALMA CLINIC',
          hasHelipad: true,
        });
        parks.push({ x: bx + 24, y: by + 206, w: bw - 48, h: bh - 224, kind: 'park' });
        palms.push({ x: bx + 65, y: by + 280, r: 23, phase: 0.8 });
        palms.push({ x: bx + bw - 65, y: by + 280, r: 23, phase: 2.4 });
        parkingSpots.push({ x: bx + bw / 2, y: by + 250, angle: 0, type: 'suv' });
        continue;
      }

      // 6. PRPD Precinct (Centro: col 3, row 3)
      if (col === 3 && row === 3) {
        addBuilding({
          x: bx + 22,
          y: by + 18,
          w: bw - 44,
          h: 175,
          height: 40,
          body: '#dce5f0',
          roof: '#2c4669',
          trim: '#2980ff',
          accent: '#ff4757',
          style: 'precinct',
          label: 'PRPD HQ',
          hasHelipad: true,
        });
        parkingSpots.push({ x: bx + 110, y: by + 280, angle: -Math.PI / 2, type: 'police' });
        parkingSpots.push({ x: bx + 210, y: by + 280, angle: -Math.PI / 2, type: 'police' });
        parkingSpots.push({ x: bx + 310, y: by + 280, angle: -Math.PI / 2, type: 'enforcer' });
        continue;
      }

      // 7. Centro Vault Garage / Downtown Drop (col 3, row 1)
      if (col === 3 && row === 1) {
        addBuilding({
          x: bx + 18,
          y: by + 18,
          w: 175,
          h: 160,
          height: 48,
          ...DOWNTOWN_PALETTES[0],
          style: 'tower',
          hasHelipad: true,
        });
        addBuilding({
          x: bx + 210,
          y: by + 18,
          w: bw - 228,
          h: 140,
          height: 32,
          body: '#d8dfe6',
          roof: '#52677a',
          trim: '#ffd166',
          accent: '#61b5ff',
          style: 'garage',
          label: 'VAULT DROP',
          neon: '#ffd166',
        });
        parkingSpots.push({ x: bx + 290, y: by + 270, angle: 0, type: 'coupe' });
        continue;
      }

      // 8. Coral Strip Showroom (col 4, row 2)
      if (col === 4 && row === 2) {
        addBuilding({
          x: bx + 18,
          y: by + 18,
          w: bw - 36,
          h: 136,
          height: 32,
          ...ART_DECO_PALETTES[0],
          style: 'deco',
          label: 'SOLERO MOTORS',
          neon: '#ff6ba9',
          hasPool: true,
        });
        // Open showroom lot with parked sports cars!
        parkingSpots.push({ x: bx + 100, y: by + 250, angle: 0, type: 'coupe', reserved: 'showroom' });
        parkingSpots.push({ x: bx + 210, y: by + 250, angle: 0, type: 'cabrio' });
        parkingSpots.push({ x: bx + 320, y: by + 250, angle: 0, type: 'supercar' });
        palms.push({ x: bx + 36, y: by + bh - 26, r: 24, phase: 1.0 });
        palms.push({ x: bx + bw - 36, y: by + bh - 26, r: 24, phase: 2.6 });
        continue;
      }

      // 9. Coral Neon Plaza (col 4, row 3) — Mission 2 shootout courtyard!
      if (col === 4 && row === 3) {
        addBuilding({
          x: bx + 16,
          y: by + 16,
          w: 135,
          h: bh - 32,
          height: 36,
          ...ART_DECO_PALETTES[1],
          style: 'deco',
          label: 'HOTEL BRISA',
          neon: '#2bd4df',
          hasPool: true,
        });
        addBuilding({
          x: bx + bw - 146,
          y: by + 16,
          w: 130,
          h: 130,
          height: 30,
          ...ART_DECO_PALETTES[2],
          style: 'deco',
          label: 'CLUB PALMA',
          neon: '#ff9f43',
        });
        parks.push({ x: bx + 164, y: by + 160, w: bw - 180, h: bh - 176, kind: 'plaza' });
        palms.push({ x: bx + 200, y: by + 195, r: 22, phase: 0.3 });
        palms.push({ x: bx + bw - 48, y: by + bh - 40, r: 22, phase: 1.9 });
        continue;
      }

      // 10. Coral Paint & Fix Respray (col 4, row 4)
      if (col === 4 && row === 4) {
        addBuilding({
          x: bx + 18,
          y: by + 16,
          w: 185,
          h: 118,
          height: 24,
          body: '#f7ece1',
          roof: '#2d7a5e',
          trim: '#3ee8a5',
          accent: '#ff6ba9',
          style: 'garage',
          label: 'CORAL RESPRAY',
          neon: '#3ee8a5',
        });
        addBuilding({
          x: bx + 225,
          y: by + 16,
          w: bw - 242,
          h: bh - 32,
          height: 30,
          ...ART_DECO_PALETTES[3],
          style: 'deco',
        });
        shops.push({
          id: 'respray_east',
          kind: 'respray',
          x: LANDMARKS.resprayEast.x,
          y: LANDMARKS.resprayEast.y,
          r: 44,
          label: 'CORAL RESPRAY ($300)',
          color: '#3ee8a5',
        });
        continue;
      }

      // 11. Puerto Dorado Docks & Marina (col 0 & 1, row 4)
      if ((col === 0 || col === 1) && row === 4) {
        if (col === 1) {
          addBuilding({
            x: bx + 16,
            y: by + 12,
            w: 190,
            h: 82,
            height: 22,
            body: '#d6cbb8',
            roof: '#6d7a87',
            trim: '#f2a444',
            accent: '#2fd6c4',
            style: 'warehouse',
            label: 'PIER 4 CARGO',
          });
          // Colorful shipping containers along the wharf
          const cColors = ['#d94e4e', '#268b96', '#e09f3e', '#345995', '#429b6e'];
          for (let i = 0; i < 4; i++) {
            containers.push({
              x: bx + 230 + (i % 2) * 90,
              y: by + 16 + Math.floor(i / 2) * 44,
              w: 76,
              h: 30,
              color: cColors[(i + row) % cColors.length],
            });
          }
          parkingSpots.push({ x: bx + 110, y: by + 145, angle: 0, type: 'van', reserved: 'marina' });
        }
        continue;
      }

      // Generic rich procedural blocks by district!
      if (district === 'laguna') {
        parks.push({ x: bx, y: by, w: bw, h: bh, kind: 'estate' });
        const pal = LAGUNA_PALETTES[Math.floor(rng() * LAGUNA_PALETTES.length)];
        const vw = Math.min(bw - 40, 140 + rng() * 60);
        const vh = Math.min(bh - 40, 95 + rng() * 50);
        addBuilding({
          x: bx + 20,
          y: by + 20,
          w: vw,
          h: vh,
          height: 22 + rng() * 10,
          ...pal,
          style: 'villa',
          hasAc: false,
        });
        if (bw > 240 && bh > 180) {
          pools.push({ x: bx + vw + 36, y: by + 34, w: Math.min(110, bw - vw - 56), h: 64, kind: 'pool' });
        }
        for (let i = 0; i < 4; i++) {
          palms.push({
            x: bx + 26 + rng() * (bw - 52),
            y: by + bh - 34 - rng() * Math.max(20, bh - vh - 60),
            r: 20 + rng() * 7,
            phase: rng() * 6.28,
          });
        }
        if (bw > 220) {
          parkingSpots.push({ x: bx + bw - 65, y: by + bh - 34, angle: 0, type: rng() > 0.5 ? 'cabrio' : 'suv' });
        }
      } else if (district === 'centro') {
        // Gleaming downtown towers with plaza setbacks
        const splitX = bw > 260 ? 2 : 1;
        const splitY = bh > 240 ? 2 : 1;
        const cellW = (bw - 24 - (splitX - 1) * 18) / splitX;
        const cellH = (bh - 24 - (splitY - 1) * 18) / splitY;
        for (let gy = 0; gy < splitY; gy++) {
          for (let gx = 0; gx < splitX; gx++) {
            const pal = DOWNTOWN_PALETTES[Math.floor(rng() * DOWNTOWN_PALETTES.length)];
            const pad = 6 + rng() * 8;
            addBuilding({
              x: bx + 12 + gx * (cellW + 18) + pad,
              y: by + 12 + gy * (cellH + 18) + pad,
              w: cellW - pad * 2,
              h: cellH - pad * 2,
              height: 36 + rng() * 34,
              ...pal,
              style: 'tower',
              hasHelipad: rng() > 0.72 && cellW > 130 && cellH > 110,
              neon: rng() > 0.55 ? pal.accent : '',
            });
          }
        }
      } else if (district === 'coral') {
        const pal1 = ART_DECO_PALETTES[Math.floor(rng() * ART_DECO_PALETTES.length)];
        const pal2 = ART_DECO_PALETTES[Math.floor(rng() * ART_DECO_PALETTES.length)];
        if (bh > 220) {
          addBuilding({
            x: bx + 16,
            y: by + 16,
            w: bw - 32,
            h: bh * 0.44,
            height: 30 + rng() * 14,
            ...pal1,
            style: 'deco',
            neon: pal1.trim,
            hasPool: rng() > 0.4,
          });
          addBuilding({
            x: bx + 16,
            y: by + bh * 0.52,
            w: (bw - 48) * 0.52,
            h: bh * 0.42,
            height: 24 + rng() * 12,
            ...pal2,
            style: 'deco',
            neon: pal2.accent,
          });
          pools.push({ x: bx + bw * 0.58, y: by + bh * 0.56, w: bw * 0.34, h: bh * 0.28, kind: 'pool' });
        } else {
          addBuilding({
            x: bx + 14,
            y: by + 14,
            w: bw - 28,
            h: bh - 28,
            height: 28,
            ...pal1,
            style: 'deco',
            neon: pal1.trim,
          });
        }
        palms.push({ x: bx + 20, y: by + bh - 18, r: 22, phase: rng() * 6.28 });
        palms.push({ x: bx + bw - 20, y: by + bh - 18, r: 22, phase: rng() * 6.28 });
      } else {
        // Barrio Verde & outer blocks
        if (row === 3 && col === 0) {
          // Neighborhood pocket park
          parks.push({ x: bx, y: by, w: bw, h: bh, kind: 'park' });
          for (let i = 0; i < 5; i++) {
            palms.push({ x: bx + 32 + rng() * (bw - 64), y: by + 32 + rng() * (bh - 64), r: 22, phase: rng() * 6.28 });
          }
        } else {
          const cols = bw > 260 ? 2 : 1;
          const rows = bh > 220 ? 2 : 1;
          const cw = (bw - 24 - (cols - 1) * 16) / cols;
          const ch = (bh - 24 - (rows - 1) * 16) / rows;
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const pal = BARRIO_PALETTES[Math.floor(rng() * BARRIO_PALETTES.length)];
              addBuilding({
                x: bx + 12 + c * (cw + 16),
                y: by + 12 + r * (ch + 16),
                w: cw,
                h: ch,
                height: 20 + rng() * 14,
                ...pal,
                style: 'barrio',
              });
            }
          }
        }
      }
    }
  }

  // Boardwalk palms & Mirador Beach umbrellas!
  for (let y = 140; y < WORLD.height - 120; y += 135) {
    palms.push({ x: WORLD.boardwalkX + 22, y, r: 26, phase: y * 0.02 });
    if (Math.abs(y - 1440) > 90) {
      palms.push({ x: WORLD.beachX + 18, y: y + 55, r: 23, phase: y * 0.03 + 1 });
    }
  }
  const umbrellaColors = ['#ff5e7e', '#2bd4df', '#ffbe3b', '#4be3a8', '#ff8c42', '#7a77ff'];
  for (let y = 180; y < WORLD.height - 180; y += 155) {
    if (Math.abs(y - 1440) < 110) continue;
    umbrellas.push({
      x: WORLD.beachX + 95 + (y % 3) * 28,
      y,
      r: 22,
      color: umbrellaColors[Math.floor((y / 155) % umbrellaColors.length)],
    });
    umbrellas.push({
      x: WORLD.beachX + 195 + ((y + 1) % 3) * 22,
      y: y + 60,
      r: 20,
      color: umbrellaColors[Math.floor(((y / 155) + 3) % umbrellaColors.length)],
    });
  }

  // Street palms along Coral Strip & Central Boulevard medians/sidewalks
  for (const ry of WORLD.roadY) {
    for (let x = 220; x < 2700; x += 260) {
      if (WORLD.roadX.some((rx) => Math.abs(rx - x) < 120)) continue;
      lamps.push({ x, y: ry - halfRoad - 12 });
      lamps.push({ x: x + 130, y: ry + halfRoad + 12 });
    }
  }
  for (let y = 200; y < 2450; y += 190) {
    if (WORLD.roadY.some((ry) => Math.abs(ry - y) < 110)) continue;
    palms.push({ x: 2760 + halfRoad + 14, y, r: 21, phase: y * 0.015 });
  }

  // Moored luxury yachts & boats in Puerto Dorado Harbor + offshore ocean sailboats
  boats.push(
    { x: 112, y: 2430, len: 92, wid: 30, angle: -Math.PI / 2, color: '#f7f9fc', trim: '#2a9fd6' },
    { x: 375, y: 2450, len: 108, wid: 34, angle: -Math.PI / 2, color: '#ffffff', trim: '#ff6b7a' },
    { x: 660, y: 2440, len: 96, wid: 30, angle: -Math.PI / 2, color: '#f4f6f9', trim: '#f2a444' },
    { x: 3420, y: 780, len: 78, wid: 24, angle: 0.4, color: '#ffffff', trim: '#2bd4df' },
    { x: 3460, y: 2080, len: 86, wid: 26, angle: -0.3, color: '#ffffff', trim: '#ff5e7e' },
  );

  // Curbside parking spots around Palma Rey so the player always finds cool cars nearby
  parkingSpots.push(
    { x: 2580, y: 1388, angle: Math.PI, type: 'coupe' },
    { x: 2678, y: 1320, angle: -Math.PI / 2, type: 'cabrio' },
    { x: 2678, y: 1560, angle: Math.PI / 2, type: 'coupe' },
    { x: 2678, y: 1120, angle: -Math.PI / 2, type: 'supercar' },
    { x: 1478, y: 1210, angle: -Math.PI / 2, type: 'sedan' },
    { x: 2078, y: 1160, angle: Math.PI / 2, type: 'suv' },
    { x: 878, y: 1120, angle: -Math.PI / 2, type: 'sedan' },
    { x: 1240, y: 1922, angle: 0, type: 'coupe' },
    { x: 1860, y: 1362, angle: 0, type: 'cabrio' },
    { x: 2380, y: 1520, angle: 0, type: 'coupe' },
  );

  // Hidden free-roam cash stashes around scenic spots
  stashes.push(
    { id: 'stash_pier', x: 3420, y: 1440, amount: 500, collected: false },
    { id: 'stash_beach', x: 3090, y: 620, amount: 400, collected: false },
    { id: 'stash_plaza', x: 1560, y: 1365, amount: 350, collected: false },
    { id: 'stash_docks', x: 525, y: 2540, amount: 600, collected: false },
    { id: 'stash_hills', x: 170, y: 460, amount: 550, collected: false },
  );

  // Collidable solid rectangles = buildings + containers
  const colliders = [
    ...buildings.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h })),
    ...containers.map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h })),
  ];

  return {
    buildings,
    parks,
    pools,
    palms,
    umbrellas,
    boats,
    containers,
    lamps,
    parkingSpots,
    shops,
    stashes,
    colliders,
  };
}

export function resolveCircleWorldCollision(city, entity, radius) {
  let hit = false;
  // Clamp to world edges
  if (entity.x < radius + 16) {
    entity.x = radius + 16;
    hit = true;
  }
  if (entity.x > WORLD.width - radius - 16) {
    entity.x = WORLD.width - radius - 16;
    hit = true;
  }
  if (entity.y < radius + 16) {
    entity.y = radius + 16;
    hit = true;
  }
  if (entity.y > WORLD.height - radius - 16) {
    entity.y = WORLD.height - radius - 16;
    hit = true;
  }

  // Keep out of deep ocean and harbor water
  if (isInWater(entity.x, entity.y)) {
    if (entity.x >= WORLD.oceanX - radius) {
      entity.x = WORLD.oceanX - radius - 2;
      hit = true;
    } else if (entity.x < WORLD.harborX && entity.y > WORLD.harborY - radius) {
      entity.y = WORLD.harborY - radius - 2;
      hit = true;
    }
  }

  // Central Plaza del Sol fountain collision
  const fountainDist = dist(entity.x, entity.y, WORLD.plazaX, WORLD.plazaY);
  const fountainRadius = 38 + radius;
  if (fountainDist < fountainRadius && fountainDist > 0.01) {
    const nx = (entity.x - WORLD.plazaX) / fountainDist;
    const ny = (entity.y - WORLD.plazaY) / fountainDist;
    entity.x = WORLD.plazaX + nx * fountainRadius;
    entity.y = WORLD.plazaY + ny * fountainRadius;
    hit = true;
  }

  // Solid buildings and containers
  for (const rect of city.colliders) {
    if (
      entity.x + radius < rect.x ||
      entity.x - radius > rect.x + rect.w ||
      entity.y + radius < rect.y ||
      entity.y - radius > rect.y + rect.h
    ) {
      continue;
    }
    const push = circleRectPush(entity.x, entity.y, radius, rect);
    if (push) {
      entity.x += push.nx * push.overlap;
      entity.y += push.ny * push.overlap;
      hit = true;
    }
  }
  return hit;
}

export function hasLineOfSight(city, x1, y1, x2, y2) {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  for (const r of city.colliders) {
    if (r.x + r.w < minX || r.x > maxX || r.y + r.h < minY || r.y > maxY) continue;
    if (segmentIntersectsRect(x1, y1, x2, y2, r)) return false;
  }
  return true;
}

export function pointBlockedByBuilding(city, x, y, pad = 12) {
  for (const r of city.colliders) {
    if (pointInRect(x, y, { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 })) {
      return true;
    }
  }
  return false;
}
