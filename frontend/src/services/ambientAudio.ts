/**
 * Renim AI — Procedural Ambient Audio Synthesizer (Web Audio API)
 * 100% offline, zero external audio asset files or network requests.
 */

class AmbientAudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sources: any[] = [];

  public stop(): void {
    try {
      this.sources.forEach(src => {
        try { src.stop(); } catch (e) {}
        try { src.disconnect(); } catch (e) {}
      });
      this.sources = [];
      if (this.ctx && this.ctx.state !== 'closed') {
        this.ctx.close().catch(() => {});
        this.ctx = null;
      }
    } catch (e) {}
  }

  public playChime(): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.35); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch (e) {}
  }

  public start(type: 'rain' | 'space' | 'hum'): void {
    this.stop();
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.18, ctx.currentTime);
      master.connect(ctx.destination);
      this.masterGain = master;

      if (type === 'rain') {
        // Procedural Pink Noise filtered for gentle rainfall
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = buffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.07;
          b6 = white * 0.115926;
        }
        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = buffer;
        whiteNoise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(880, ctx.currentTime);

        whiteNoise.connect(filter);
        filter.connect(master);
        whiteNoise.start();
        this.sources.push(whiteNoise);
      } else if (type === 'space') {
        // Detuned multi-oscillator space drone
        const freqs = [65.41, 98.00, 130.81, 196.00];
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const filter = ctx.createBiquadFilter();
          osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(freq + (Math.random() - 0.5) * 1.5, ctx.currentTime);
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(300, ctx.currentTime);
          osc.connect(filter);
          filter.connect(master);
          osc.start();
          this.sources.push(osc);
        });
      } else if (type === 'hum') {
        // Binaural beat: 216 Hz Left, 226 Hz Right (10 Hz Alpha frequency)
        const merger = ctx.createChannelMerger(2);
        const oscL = ctx.createOscillator();
        const oscR = ctx.createOscillator();
        oscL.type = 'sine';
        oscR.type = 'sine';
        oscL.frequency.setValueAtTime(216, ctx.currentTime);
        oscR.frequency.setValueAtTime(226, ctx.currentTime);
        oscL.connect(merger, 0, 0);
        oscR.connect(merger, 0, 1);
        merger.connect(master);
        oscL.start();
        oscR.start();
        this.sources.push(oscL, oscR);
      }
    } catch (e) {
      console.warn('Ambient audio generator error:', e);
    }
  }
}

export const ambientAudio = new AmbientAudioService();
