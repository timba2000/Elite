// Persistent graphics-quality setting. Three tiers:
//   low      — no post-processing at all (weakest machines)
//   standard — the classic look: bloom only
//   photo    — the photoreal pass: SSAO, god-rays, lens flare/grain,
//              soft shadows, atmosphere scattering, clouds, HDR nebula
// Stored outside the save file so it survives New Game / different pilots.
const KEY = 'elite-graphics-v1';

export const QUALITY_LEVELS = ['low', 'standard', 'photo'];
export const QUALITY_LABELS = { low: 'LOW', standard: 'STANDARD', photo: 'PHOTOREAL' };

function load() {
  try {
    const q = localStorage.getItem(KEY);
    return QUALITY_LEVELS.includes(q) ? q : 'photo';
  } catch {
    return 'photo';
  }
}

export const Graphics = {
  quality: load(),
  _listeners: [],

  // rank helper: Graphics.atLeast('standard') → bloom on, etc.
  rank(q = this.quality) { return QUALITY_LEVELS.indexOf(q); },
  atLeast(q) { return this.rank() >= this.rank(q); },
  get photo() { return this.quality === 'photo'; },

  set(q) {
    if (!QUALITY_LEVELS.includes(q) || q === this.quality) return;
    this.quality = q;
    try { localStorage.setItem(KEY, q); } catch { /* private mode etc. */ }
    for (const fn of this._listeners) fn(q);
  },

  cycle() {
    const i = (QUALITY_LEVELS.indexOf(this.quality) + 1) % QUALITY_LEVELS.length;
    this.set(QUALITY_LEVELS[i]);
  },

  label() { return QUALITY_LABELS[this.quality]; },

  onChange(fn) { this._listeners.push(fn); },
};
