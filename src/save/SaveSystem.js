import { Net } from '../net/Net.js';

const KEY = 'elite-save-v1';

export const SaveSystem = {
  save(playerData, market) {
    try {
      const blob = {
        version: 1,
        player: playerData.serialize(),
        marketDrift: market.serialize(),
        timestamp: Date.now(),
      };
      localStorage.setItem(KEY, JSON.stringify(blob));
      Net.cloudSave(blob); // async, fire-and-forget; no-op when signed out
      return true;
    } catch {
      return false;
    }
  },

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.version !== 1 || !data.player) return null;
      return data;
    } catch {
      return null;
    }
  },

  // Newer of local and cloud save. Cloud wins ties so a fresh device
  // (empty localStorage) picks up the commander's progress.
  async loadBest() {
    const local = this.load();
    const cloud = await Net.cloudLoad();
    if (!cloud || cloud.version !== 1 || !cloud.player) return local;
    if (!local) return cloud;
    return (cloud.timestamp ?? 0) >= (local.timestamp ?? 0) ? cloud : local;
  },

  exists() {
    return this.load() !== null;
  },

  clear() {
    localStorage.removeItem(KEY);
  },
};
