// HUD-Elemente: Geld, Sterne, Missionsanzeige, Toasts, Minimap
window.BUG = window.BUG || {};
BUG.HUD = (function () {
  const el = id => document.getElementById(id);
  let toastTimer = null;

  return {
    setHealth(pct) { el('healthFill').style.width = Math.max(0, Math.min(100, pct)) + '%'; },
    setMoney(v) { el('money').textContent = v.toFixed(2).replace('.', ',') + ' €'; },
    setPfand(n) { el('pfand').textContent = n; },
    setTicket(has) {
      const t = el('ticket');
      t.textContent = has ? 'JA (gültig)' : 'nein';
      t.style.color = has ? '#7ff97a' : '#ff7a7a';
    },
    setStars(n) {
      el('stars').textContent = n === 0 ? '-' : '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
    },
    setLocation(name) { el('locationName').textContent = name; },
    setLineInfo(txt) { el('lineInfo').textContent = txt || ''; },
    setMission(title, text) {
      el('missionTitle').textContent = title || 'Freies Spiel';
      el('missionText').innerHTML = text || 'Erkunde Bärlin.';
    },
    toast(msg, ms = 2500) {
      const t = el('toast');
      t.textContent = msg;
      t.style.display = 'block';
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { t.style.display = 'none'; }, ms);
    },
    showInteract(text) {
      const p = el('interactPrompt');
      p.innerHTML = text; p.style.display = 'block';
    },
    hideInteract() { el('interactPrompt').style.display = 'none'; },
    showHUD() { el('hud').style.display = ''; },
    hideStart() { el('startScreen').style.display = 'none'; },

    // Minimap: top-down abstract, player centered
    minimapCtx: null,
    initMinimap() { this.minimapCtx = el('minimap').getContext('2d'); },
    drawMinimap(playerPos, playerAngle, world) {
      const ctx = this.minimapCtx; if (!ctx) return;
      const W = 380, H = 380, scale = 0.85; // 1m -> 0.85px, radius ~223m
      ctx.clearRect(0, 0, W, H);
      // background
      ctx.fillStyle = '#1a1f26'; ctx.fillRect(0, 0, W, H);
      // spree
      ctx.strokeStyle = '#2a4d70'; ctx.lineWidth = 10;
      ctx.beginPath();
      const sx = W/2 - playerPos.x * scale;
      const sy = H/2 + playerPos.z * scale;
      // river runs west-east through y=-40
      ctx.moveTo(-500 + sx, -(-40) * scale + sy);
      ctx.quadraticCurveTo(0 + sx, -(-25) * scale + sy, 500 + sx, -(-45) * scale + sy);
      ctx.stroke();
      // streets grid
      ctx.strokeStyle = '#3a3f4a'; ctx.lineWidth = 3;
      const step = 40;
      for (let x = -200; x <= 200; x += step) {
        ctx.beginPath();
        ctx.moveTo(x * scale + sx, 0); ctx.lineTo(x * scale + sx, H); ctx.stroke();
      }
      for (let z = -200; z <= 200; z += step) {
        ctx.beginPath();
        ctx.moveTo(0, -z * scale + sy); ctx.lineTo(W, -z * scale + sy); ctx.stroke();
      }
      // U-Bahn stations
      if (world && world.stations) {
        ctx.fillStyle = '#00d4b8';
        world.stations.forEach(s => {
          const x = s.pos.x * scale + sx;
          const y = -s.pos.z * scale + sy;
          ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
        });
        // U-Bahn line paths
        if (world.linePaths) {
          world.linePaths.forEach(line => {
            ctx.strokeStyle = line.color; ctx.lineWidth = 2;
            ctx.beginPath();
            line.points.forEach((p, i) => {
              const x = p.x * scale + sx, y = -p.z * scale + sy;
              if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();
          });
        }
      }
      // landmarks as icons
      if (world && world.landmarks) {
        ctx.fillStyle = '#ffb03a'; ctx.font = 'bold 14px sans-serif';
        world.landmarks.forEach(l => {
          const x = l.pos.x * scale + sx, y = -l.pos.z * scale + sy;
          ctx.fillText(l.icon || '★', x - 6, y + 4);
        });
      }
      // mission target
      if (world && world.missionTarget) {
        const x = world.missionTarget.x * scale + sx;
        const y = -world.missionTarget.z * scale + sy;
        ctx.strokeStyle = '#ffb03a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#ffb03a';
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      }
      // player arrow
      ctx.save();
      ctx.translate(W/2, H/2);
      ctx.rotate(playerAngle);
      ctx.fillStyle = '#ff3a3a';
      ctx.beginPath();
      ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(-6, 6); ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
  };
})();
