// localStorage save/load
window.BUG = window.BUG || {};
BUG.Storage = {
  KEY: 'baerlin_ubahn_save_v1',
  save(data) {
    try { localStorage.setItem(this.KEY, JSON.stringify(data)); }
    catch (e) { console.warn('Save failed', e); }
  },
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },
  reset() { localStorage.removeItem(this.KEY); },
};
