// Procedural WebAudio API synthesizer — zero external audio assets.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.noiseBuffer = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.driftSource = null;
    this.driftGain = null;
    this.sirenPhase = 0;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.36;
      this.master.connect(this.ctx.destination);
      this._createNoiseBuffer();
      this._initContinuousLoops();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.36, this.ctx.currentTime, 0.04);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  _createNoiseBuffer() {
    const length = this.ctx.sampleRate * 1.5;
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  _initContinuousLoops() {
    // Vehicle engine hum
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 60;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 240;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start();
    this.engineOsc = osc;
    this.engineFilter = filter;
    this.engineGain = gain;

    // Police siren wail
    const sOsc = this.ctx.createOscillator();
    sOsc.type = 'triangle';
    sOsc.frequency.value = 650;
    const sGain = this.ctx.createGain();
    sGain.gain.value = 0;
    sOsc.connect(sGain);
    sGain.connect(this.master);
    sOsc.start();
    this.sirenOsc = sOsc;
    this.sirenGain = sGain;

    // Tire screech loop
    const nSrc = this.ctx.createBufferSource();
    nSrc.buffer = this.noiseBuffer;
    nSrc.loop = true;
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1450;
    band.Q.value = 6;
    const dGain = this.ctx.createGain();
    dGain.gain.value = 0;
    nSrc.connect(band);
    band.connect(dGain);
    dGain.connect(this.master);
    nSrc.start();
    this.driftSource = nSrc;
    this.driftGain = dGain;
  }

  updateContinuous(dt, { inVehicle, speedRatio, baseHz, drifting, policeNear }) {
    if (!this.ctx || !this.engineGain) return;
    const now = this.ctx.currentTime;

    // Engine modulation
    if (inVehicle) {
      const gearPitch = 1 + (speedRatio * 1.45) % 0.72 + speedRatio * 0.85;
      const targetFreq = (baseHz || 72) * gearPitch;
      this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.05);
      this.engineFilter.frequency.setTargetAtTime(220 + speedRatio * 520, now, 0.06);
      this.engineGain.gain.setTargetAtTime(0.08 + speedRatio * 0.1, now, 0.07);
    } else {
      this.engineGain.gain.setTargetAtTime(0, now, 0.08);
    }

    // Tire screech during drifts
    const targetDrift = inVehicle && drifting ? 0.09 : 0;
    this.driftGain.gain.setTargetAtTime(targetDrift, now, 0.05);

    // Police siren wail
    if (policeNear > 0.05) {
      this.sirenPhase += dt * 2.6;
      const sweep = Math.sin(this.sirenPhase) * 0.5 + 0.5;
      this.sirenOsc.frequency.setTargetAtTime(590 + sweep * 460, now, 0.03);
      this.sirenGain.gain.setTargetAtTime(0.065 * policeNear, now, 0.08);
    } else {
      this.sirenGain.gain.setTargetAtTime(0, now, 0.12);
    }
  }

  playGunshot(weaponId) {
    if (!this.ctx || this.muted || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    if (weaponId === 'baton') {
      this._playTone(190, 95, 0.09, 'triangle', 0.18);
      return;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    if (weaponId === 'shotgun') {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, now);
      filter.frequency.exponentialRampToValueAtTime(180, now + 0.24);
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      this._playTone(130, 38, 0.18, 'sine', 0.34);
    } else if (weaponId === 'smg') {
      filter.type = 'bandpass';
      filter.frequency.value = 1850;
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      this._playTone(290, 120, 0.06, 'square', 0.12);
    } else {
      filter.type = 'bandpass';
      filter.frequency.value = 1400;
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      this._playTone(230, 85, 0.09, 'triangle', 0.18);
    }

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(now);
    src.stop(now + 0.28);
  }

  playCrash(intensity = 0.6) {
    if (!this.ctx || this.muted || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const vol = Math.min(0.42, 0.14 + intensity * 0.28);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(750, now);
    filter.frequency.exponentialRampToValueAtTime(110, now + 0.22);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(now);
    src.stop(now + 0.25);
    this._playTone(125, 42, 0.16, 'sine', vol * 0.8);
  }

  playExplosion() {
    if (!this.ctx || this.muted || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(980, now);
    filter.frequency.exponentialRampToValueAtTime(65, now + 0.68);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(now);
    src.stop(now + 0.75);
    this._playTone(110, 26, 0.55, 'sawtooth', 0.36);
  }

  playHorn() {
    if (!this.ctx || this.muted) return;
    this._playTone(392, 392, 0.22, 'sawtooth', 0.11);
    this._playTone(494, 494, 0.22, 'sawtooth', 0.09);
  }

  playPickup() {
    if (!this.ctx || this.muted) return;
    this._playTone(660, 880, 0.09, 'sine', 0.18);
    setTimeout(() => this._playTone(880, 1180, 0.12, 'sine', 0.16), 70);
  }

  playWantedUp() {
    if (!this.ctx || this.muted) return;
    this._playTone(520, 740, 0.14, 'triangle', 0.18);
    setTimeout(() => this._playTone(740, 520, 0.16, 'triangle', 0.16), 130);
  }

  playMissionComplete() {
    if (!this.ctx || this.muted) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((hz, idx) => {
      setTimeout(() => this._playTone(hz, hz * 1.01, 0.26, 'triangle', 0.2), idx * 105);
    });
  }

  playDoor() {
    if (!this.ctx || this.muted) return;
    this._playTone(170, 92, 0.09, 'square', 0.12);
  }

  _playTone(startHz, endHz, duration, type, volume) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startHz, now);
    if (endHz !== startHz) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endHz), now + duration);
    }
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }
}
