// Sprechblasen und Missionsdialoge im Bottom-Center
window.BUG = window.BUG || {};
BUG.Dialog = (function () {
  const el = document.getElementById('dialog');
  let timer = null;

  return {
    show(text, ms = 3500) {
      el.innerHTML = text;
      el.style.display = 'block';
      if (timer) clearTimeout(timer);
      if (ms > 0) timer = setTimeout(() => { el.style.display = 'none'; }, ms);
    },
    hide() { el.style.display = 'none'; if (timer) clearTimeout(timer); },
  };
})();
