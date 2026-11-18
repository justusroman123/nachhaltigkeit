// Gemeinsame Mikrofon-Aufnahme fuer Bedienplatz und Gast-Tablet: liefert 50-ms-Bloecke als PCM16/mono mit der Zielrate (16 kHz) an onBlock.
// Erst wird ein Audio-Kontext mit der Zielrate versucht. Haelt der Browser die Rate nicht ein oder kann er die Mikrofonquelle damit nicht
// anbinden (manche Browser, z. B. aeltere Safari-Versionen oder Firefox: in dieser Umgebung nicht geprueft), folgt ein Kontext mit der Rate des
// Geraets; js/pcm-worklet.js rechnet dann auf die Zielrate herunter. Liefert { ctx, node }; wirft, wenn beides scheitert (der Aufrufer meldet es).
async function openCapture(stream, rate, onBlock) {
  let lastErr = null;
  for (const opts of [{ sampleRate: rate }, {}]) {
    let ctx = null;
    try {
      ctx = new AudioContext(opts);
      if (ctx.sampleRate < rate - 1) throw new Error('Abtastrate des Audio-Kontexts zu klein');      // Hochrechnen gibt es nicht
      await ctx.audioWorklet.addModule('js/pcm-worklet.js');
      const node = new AudioWorkletNode(ctx, 'pcm-capture', { processorOptions: { targetRate: rate } });
      node.port.onmessage = (ev) => onBlock(ev.data);
      ctx.createMediaStreamSource(stream).connect(node);
      return { ctx, node };
    } catch (err) {
      lastErr = err;
      try { if (ctx) ctx.close().catch(() => {}); } catch (_) { /* schon zu */ }
    }
  }
  throw lastErr;
}
