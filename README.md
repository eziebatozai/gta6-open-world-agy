# Palma Rey: Suncoast Syndicate

[![make.fun gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/eziebatozai/gta6-open-world-agy/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/eziebatozai/gta6-open-world-agy/reward.svg)](https://make.fun/bounty/gta6-01)

An original sun-soaked 2D top-down open-world crime sandbox built in pure static HTML5 Canvas, modular ES JavaScript, and procedural WebAudio synthesis — zero external dependencies and zero network requests.

## Overview

Play as **Camila Reyes**, a returning getaway driver taking back the sun-drenched coastal metropolis of **Palma Rey** from Hector "El Cobre" Salgado and the **Cinder Cartel**.

- **6 Original Coastal Districts**: Mirador Beach & Lighthouse Pier, Coral Strip Art Deco hotels, Centro Financiero towers & Plaza del Sol fountain, Barrio Verde, Puerto Dorado Marina & cargo docks, and Laguna Heights luxury estates.
- **Vehicles & Traffic**: 8 distinct vehicle classes (`Solero GT`, `Brisa Cabrio`, `Viento Sedan`, `Duna SUV`, `Carga Van`, `Rayo Super`, `PRPD Interceptor`, `PRPD Enforcer`) with lane-following NPC traffic, arcade-drift handling, skidmarks, damage, and explosions.
- **Wanted System (0–5 Stars)**: Escalating PRPD pursuit with foot officers who chase and arrest (`BUSTED`), patrolling Interceptors with flashing red/blue lightbars and synthesized sirens, heavy Enforcer tactical SUVs, evasion cooldown, and **Pay & Respray** garages.
- **5-Mission Story Campaign**: Multi-stage missions (*Welcome to Palma Rey*, *Neon Debt Collection*, *Harbor Hijack*, *Beachfront Blitz*, *Cinder's Last Sunset*) with GPS minimap routes, character dialogue, combat encounters, weapon unlocks, and cash rewards.
- **HUD, Persistence & Audio**: Live vector minimap, health/armor/cash/wanted/weapon HUD, vehicle speedometer, Start Screen, Pause Menu, El Mercado Armory kiosk, `localStorage` Save/Continue, 3 lighting modes (*Suncoast Day*, *Golden Sunset*, *Neon Night*), and 100% WebAudio procedural sound synthesis.

## Play Locally

```bash
node serve.ts
```

Open `http://localhost:8080` in a desktop browser.

### Controls
- **WASD / Arrow Keys**: Walk, sprint (`Shift`), and drive
- **F / E**: Steal, enter, or exit vehicles; interact with Armory & Pay & Respray garages
- **Space**: Handbrake drift (in car) / fire weapon (on foot)
- **Mouse + Left Click**: Aim and shoot
- **1–4 / Mouse Wheel**: Switch weapons (Street Baton, 9mm Palma, Viper SMG, Breacher 12G)
- **T / M / P (or Esc)**: Cycle lighting, toggle sound, open Pause & Save menu

## Build Competition Output

```bash
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```
