// Spieler-Inventar: Geld, Pfand, Ticket, HP
window.BUG = window.BUG || {};
BUG.Inventory = (function () {
  const state = {
    hp: 100,
    money: BUG.CONFIG.economy.startMoney,
    pfand: 0,
    hasTicket: false,
    ticketExpiresAt: 0,
    completedMissions: {},
  };

  function refresh() {
    BUG.HUD.setHealth(state.hp);
    BUG.HUD.setMoney(state.money);
    BUG.HUD.setPfand(state.pfand);
    BUG.HUD.setTicket(state.hasTicket && Date.now() < state.ticketExpiresAt);
  }

  return {
    state,
    refresh,
    hurt(n) { state.hp = Math.max(0, state.hp - n); refresh(); return state.hp <= 0; },
    heal(n) { state.hp = Math.min(100, state.hp + n); refresh(); },
    addMoney(n) { state.money = Math.max(0, state.money + n); refresh(); },
    addPfand(n) {
      state.pfand += n;
      state.money += n * BUG.CONFIG.economy.pfandPerBottle;
      refresh();
    },
    buyTicket() {
      const price = BUG.CONFIG.wanted.ticketPrice;
      if (state.money < price) return false;
      state.money -= price;
      state.hasTicket = true;
      state.ticketExpiresAt = Date.now() + 90 * 1000; // 90 s Ticketgültigkeit im Spiel
      refresh();
      return true;
    },
    hasValidTicket() { return state.hasTicket && Date.now() < state.ticketExpiresAt; },
    invalidateTicket() { state.hasTicket = false; refresh(); },
    completeMission(id) { state.completedMissions[id] = true; },
    isCompleted(id) { return !!state.completedMissions[id]; },
    toSaveObj() {
      return {
        money: state.money, pfand: state.pfand,
        completedMissions: state.completedMissions,
      };
    },
    loadSaveObj(d) {
      if (!d) return;
      state.money = d.money ?? state.money;
      state.pfand = d.pfand ?? state.pfand;
      state.completedMissions = d.completedMissions || {};
      refresh();
    },
  };
})();
