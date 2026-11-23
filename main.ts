// Palma Rey: Suncoast Syndicate — gta6-01 submission entrypoint (Node 22, standard library only).
// Copies game/ and screenshots/ into the output directory and writes dossier.json via vendor/makefun-game.ts.
//
// Play locally: `node serve.ts`, then open http://localhost:8080 in a desktop browser.
// Build output: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const GATE_LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function packageEntry(sourceRoot: string, outputDir: string): void {
  const gameDir = join(sourceRoot, 'game');
  const screenshotsDir = join(sourceRoot, 'screenshots');

  if (!existsSync(join(gameDir, 'index.html'))) {
    throw new Error('Missing game/index.html');
  }

  mkdirSync(outputDir, { recursive: true });
  cpSync(gameDir, join(outputDir, 'game'), { recursive: true });
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  if (existsSync(screenshotsDir)) {
    cpSync(screenshotsDir, join(outputDir, 'screenshots'), { recursive: true });
  }

  const dossierJson = buildDossier(outputDir, GATE_LIMITS);
  writeFileSync(join(outputDir, 'dossier.json'), dossierJson);
}

packageEntry(here, out);
