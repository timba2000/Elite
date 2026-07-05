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

  exists() {
    return this.load() !== null;
  },

  clear() {
    localStorage.removeItem(KEY);
  },
};
