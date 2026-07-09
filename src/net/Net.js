// Client side of the shared universe. Every call fails soft: offline play
// always works, the game just stays local until the server answers again.
const SESSION_KEY = 'elite-session-v1';

export const Net = {
  session: loadSession(),
  online: true, // last request reached the server

  get loggedIn() { return !!this.session; },
  get name() { return this.session?.name ?? null; },

  async api(path, { method = 'GET', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.session) headers.Authorization = `Bearer ${this.session.token}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await fetch(`/api${path}`, {
        method, headers, signal: ctrl.signal,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      this.online = true;
      if (res.status === 401 && this.session) this.setSession(null); // stale token
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { error: data.error || `HTTP ${res.status}` };
      return data;
    } catch {
      this.online = false;
      return { error: 'Server unreachable' };
    } finally {
      clearTimeout(timer);
    }
  },

  setSession(session) {
    this.session = session;
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  },

  async register(name, pin) {
    const r = await this.api('/auth/register', { method: 'POST', body: { name, pin } });
    if (!r.error) this.setSession({ token: r.token, name: r.name });
    return r;
  },

  async login(name, pin) {
    const r = await this.api('/auth/login', { method: 'POST', body: { name, pin } });
    if (!r.error) this.setSession({ token: r.token, name: r.name });
    return r;
  },

  async logout() {
    if (this.session) this.api('/auth/logout', { method: 'POST' }); // best effort
    this.setSession(null);
  },

  async cloudSave(blob) {
    if (!this.loggedIn) return;
    await this.api('/save', { method: 'PUT', body: { blob } });
  },

  async cloudLoad() {
    if (!this.loggedIn) return null;
    const r = await this.api('/save');
    return r.error ? null : r.blob;
  },

  async leaderboard() {
    const r = await this.api('/leaderboard');
    return r.error ? null : r.entries;
  },

  async marketFetch(galaxy, system) {
    const r = await this.api(`/market/${galaxy}/${system}`);
    return r.error ? null : r.state;
  },

  // fire-and-forget: the local market already applied the trade
  marketTrade(galaxy, system, planetId, goodId, qty, isBuy) {
    if (!this.loggedIn) return;
    this.api(`/market/${galaxy}/${system}/trade`, {
      method: 'POST', body: { planetId, goodId, qty, isBuy },
    });
  },
};

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
  } catch {
    return null;
  }
}
