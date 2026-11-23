// Save and continue persistence using localStorage.

const SAVE_KEY = 'palma_rey_suncoast_save_v1';

export function hasSavedGame() {
  try {
    return Boolean(window.localStorage.getItem(SAVE_KEY));
  } catch {
    return false;
  }
}

export function saveGameState(state) {
  try {
    const payload = {
      version: 1,
      savedAt: Date.now(),
      timeMode: state.timeMode,
      muted: state.audio.muted,
      player: {
        x: Math.round(state.player.x),
        y: Math.round(state.player.y),
        angle: state.player.angle,
        hp: Math.round(state.player.hp),
        armor: Math.round(state.player.armor),
        cash: Math.round(state.player.cash),
        weaponIndex: state.player.weaponIndex,
        unlockedWeapons: [...state.player.unlockedWeapons],
        ammo: { ...state.player.ammo },
        stats: { ...state.player.stats },
      },
      missions: {
        completedCount: state.missions.completedCount,
        campaignComplete: state.missions.campaignComplete,
      },
      collectedStashes: state.city.stashes.filter((s) => s.collected).map((s) => s.id),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadSavedGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || !data.player) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSavedGame() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Ignore storage quota / privacy mode failures
  }
}
