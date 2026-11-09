// AudioWorklet: sammelt Mikrofon-Samples und gibt 50-ms-Bloecke als PCM16 (mono) an die Seite.
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.size = 800;                       // 50 ms bei 16 kHz
    this.buf = new Int16Array(this.size);
    this.n = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      const s = Math.max(-1, Math.min(1, ch[i]));
      this.buf[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.n === this.size) {
        this.port.postMessage(this.buf.buffer, [this.buf.buffer]);
        this.buf = new Int16Array(this.size);
        this.n = 0;
      }
    }
    return true;
  }
}
registerProcessor('pcm-capture', PcmCapture);
