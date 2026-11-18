// AudioWorklet: sammelt Mikrofon-Samples und gibt 50-ms-Bloecke als PCM16 (mono) mit der Zielrate (Standard 16 kHz) an die Seite.
// Laeuft der Audio-Kontext mit der Zielrate (Normalfall), werden die Werte unveraendert uebernommen. Haelt ein Browser die gewuenschte
// Rate nicht ein, rechnet dieser Prozessor selbst herunter: Mittelwert aller Eingangswerte, die in einen Ausgabewert fallen (einfaches
// Verfahren; Qualitaet gegenueber dem Normalfall nicht gemessen). Ohne diese Umrechnung waere die Sprache zu tief und zu langsam gedehnt.
class PcmCapture extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.target = o.targetRate || 16000;
    this.ratio = sampleRate / this.target;            // sampleRate: Abtastrate des Audio-Kontexts (Globale im Worklet)
    this.size = Math.round(this.target * 0.05);       // 50 ms: bei 16 kHz 800 Werte
    this.buf = new Int16Array(this.size);
    this.n = 0;                                       // Werte im aktuellen Block
    this.acc = 0; this.cnt = 0; this.pos = 0;         // Umrechnung: Summe, Anzahl, Phase
  }
  out(v) {
    const s = Math.max(-1, Math.min(1, v));
    this.buf[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
    if (this.n === this.size) {
      this.port.postMessage(this.buf.buffer, [this.buf.buffer]);
      this.buf = new Int16Array(this.size);
      this.n = 0;
    }
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    if (Math.abs(this.ratio - 1) < 0.001) {           // Normalfall: Kontext laeuft mit der Zielrate
      for (let i = 0; i < ch.length; i++) this.out(ch[i]);
      return true;
    }
    for (let i = 0; i < ch.length; i++) {             // Ausnahme: auf die Zielrate herunterrechnen
      this.acc += ch[i]; this.cnt++; this.pos += 1;
      if (this.pos >= this.ratio) { this.pos -= this.ratio; this.out(this.acc / this.cnt); this.acc = 0; this.cnt = 0; }
    }
    return true;
  }
}
registerProcessor('pcm-capture', PcmCapture);
