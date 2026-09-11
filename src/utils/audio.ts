/**
 * Procedural Web Audio synthesizer for realistic dog sound effects & game feedback,
 * plus a soothing, looping park ambient soundscape (gentle breeze & singing birds).
 * Zero external audio files or network dependencies required.
 */
export interface AudioSettings {
  masterVolume: number; // 0 to 1
  ambientVolume: number; // 0 to 1
  sfxVolume: number; // 0 to 1
  ambientEnabled: boolean;
  sfxEnabled: boolean;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;

  // Ambient state
  private ambientRunning: boolean = false;
  private ambientTimer: number | null = null;
  private breezeNode: AudioBufferSourceNode | null = null;
  private breezeGain: GainNode | null = null;
  private isNightMode: boolean = false;

  // Settings
  private settings: AudioSettings = {
    masterVolume: 0.8,
    ambientVolume: 0.6,
    sfxVolume: 0.85,
    ambientEnabled: true,
    sfxEnabled: true,
  };

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("pet_audio_settings_v1");
        if (saved) {
          const parsed = JSON.parse(saved);
          this.settings = { ...this.settings, ...parsed };
        }
      } catch (e) {
        console.warn("Failed to load audio settings", e);
      }
    }
  }

  private initAudioNodes(): boolean {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }

    if (!this.ctx) return false;

    if (!this.masterGain) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.settings.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(
        this.settings.sfxEnabled ? this.settings.sfxVolume : 0,
        this.ctx.currentTime
      );
      this.sfxGain.connect(this.masterGain);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(
        this.settings.ambientEnabled ? this.settings.ambientVolume : 0,
        this.ctx.currentTime
      );
      this.ambientGain.connect(this.masterGain);
    }

    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    return true;
  }

  public getContext(): AudioContext | null {
    if (this.initAudioNodes()) {
      return this.ctx;
    }
    return null;
  }

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  private saveSettings() {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("pet_audio_settings_v1", JSON.stringify(this.settings));
      } catch (e) {
        console.warn("Failed to save audio settings", e);
      }
    }
  }

  // --- Volume & Master Controls ---

  public setMasterVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.settings.masterVolume = clamped;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.05);
    }
    this.saveSettings();
  }

  public setSfxVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.settings.sfxVolume = clamped;
    if (this.ctx && this.sfxGain) {
      const target = this.settings.sfxEnabled ? clamped : 0;
      this.sfxGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
    }
    this.saveSettings();
  }

  public setAmbientVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.settings.ambientVolume = clamped;
    if (this.ctx && this.ambientGain) {
      const target = this.settings.ambientEnabled ? clamped : 0;
      this.ambientGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
    }
    if (clamped > 0 && this.settings.ambientEnabled && !this.ambientRunning) {
      this.startAmbient();
    }
    this.saveSettings();
  }

  public setAmbientEnabled(enabled: boolean) {
    this.settings.ambientEnabled = enabled;
    if (this.ctx && this.ambientGain) {
      const target = enabled ? this.settings.ambientVolume : 0;
      this.ambientGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
    }
    if (enabled) {
      this.startAmbient();
    } else {
      this.stopAmbient();
    }
    this.saveSettings();
  }

  public setSfxEnabled(enabled: boolean) {
    this.settings.sfxEnabled = enabled;
    if (this.ctx && this.sfxGain) {
      const target = enabled ? this.settings.sfxVolume : 0;
      this.sfxGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
    }
    this.saveSettings();
  }

  // Backwards-compatible toggle for quick mute
  public setEnabled(enabled: boolean) {
    this.setSfxEnabled(enabled);
    this.setAmbientEnabled(enabled);
  }

  public isEnabled(): boolean {
    return this.settings.sfxEnabled || this.settings.ambientEnabled;
  }

  public setNightMode(night: boolean) {
    this.isNightMode = night;
  }

  // --- Background Looping Ambient Track (Park Breeze & Birds) ---

  public startAmbient() {
    if (this.ambientRunning) return;
    const ctx = this.getContext();
    if (!ctx || !this.ambientGain) return;

    this.ambientRunning = true;

    // 1. Looping soft breeze layer (gentle pink-filtered noise with slow oscillating breath)
    try {
      const bufferSize = ctx.sampleRate * 4; // 4 second seamless looping buffer
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);

      // Generate soft pinkish ambient noise
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        data[i] = (b0 + b1 + b2) * 0.06;
      }

      this.breezeNode = ctx.createBufferSource();
      this.breezeNode.buffer = noiseBuffer;
      this.breezeNode.loop = true;

      // Filter for warm, gentle breeze sound (lowpass / bandpass)
      const breezeFilter = ctx.createBiquadFilter();
      breezeFilter.type = "lowpass";
      breezeFilter.frequency.setValueAtTime(450, ctx.currentTime);

      // Subtle LFO modulation for wind gusts
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(0.12, ctx.currentTime); // ~8 sec wave
      lfoGain.gain.setValueAtTime(200, ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(breezeFilter.frequency);
      lfo.start();

      this.breezeGain = ctx.createGain();
      this.breezeGain.gain.setValueAtTime(0.15, ctx.currentTime);

      this.breezeNode.connect(breezeFilter);
      breezeFilter.connect(this.breezeGain);
      this.breezeGain.connect(this.ambientGain);

      this.breezeNode.start();
    } catch (e) {
      console.warn("Failed to start breeze loop", e);
    }

    // 2. Schedule natural randomized bird chirps / night sounds
    const scheduleNextChirp = () => {
      if (!this.ambientRunning) return;

      const delay = this.isNightMode
        ? 1500 + Math.random() * 2500 // Night crickets / distant call
        : 2200 + Math.random() * 4000; // Daytime lively songbirds

      this.ambientTimer = window.setTimeout(() => {
        if (!this.ambientRunning) return;
        if (this.isNightMode) {
          this.playCricketChirp();
        } else {
          this.playBirdChirp();
        }
        scheduleNextChirp();
      }, delay);
    };

    // Trigger first bird chirp shortly after starting
    this.ambientTimer = window.setTimeout(() => {
      this.playBirdChirp();
      scheduleNextChirp();
    }, 1200);
  }

  public stopAmbient() {
    this.ambientRunning = false;
    if (this.ambientTimer) {
      clearTimeout(this.ambientTimer);
      this.ambientTimer = null;
    }
    if (this.breezeNode) {
      try {
        this.breezeNode.stop();
        this.breezeNode.disconnect();
      } catch {
        // ignore
      }
      this.breezeNode = null;
    }
  }

  /** Realistic singing bird sound with randomized frequency modulation */
  public playBirdChirp() {
    const ctx = this.getContext();
    if (!ctx || !this.ambientGain || !this.settings.ambientEnabled) return;

    const now = ctx.currentTime;
    const style = Math.floor(Math.random() * 3);

    // Common audio nodes
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "sine";
    filter.type = "bandpass";
    filter.Q.setValueAtTime(4.0, now);

    if (style === 0) {
      // Style 0: Cheerful twin chirp (Robin / Finch)
      const baseFreq = 3400 + Math.random() * 400;
      filter.frequency.setValueAtTime(baseFreq, now);

      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, now + 0.05);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, now + 0.1);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.13);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.23);

      osc.start(now);
      osc.stop(now + 0.24);
    } else if (style === 1) {
      // Style 1: Sweet warble trill
      const baseFreq = 2800 + Math.random() * 500;
      filter.frequency.setValueAtTime(baseFreq + 600, now);

      for (let i = 0; i < 4; i++) {
        const t = now + i * 0.04;
        osc.frequency.setValueAtTime(baseFreq + (i % 2 === 0 ? 400 : 0), t);
      }

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.16, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

      osc.start(now);
      osc.stop(now + 0.2);
    } else {
      // Style 2: High sweet descending whistle (Sparrow)
      const baseFreq = 3800 + Math.random() * 400;
      filter.frequency.setValueAtTime(baseFreq, now);

      osc.frequency.setValueAtTime(baseFreq * 1.15, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.75, now + 0.16);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.start(now);
      osc.stop(now + 0.19);
    }

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);
  }

  /** Gentle soft night cricket chirp for nocturnal park ambiance */
  private playCricketChirp() {
    const ctx = this.getContext();
    if (!ctx || !this.ambientGain || !this.settings.ambientEnabled) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(4600 + Math.random() * 300, now);

    // Fast oscillating cricket rubs
    gain.gain.setValueAtTime(0, now);
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.035;
      gain.gain.linearRampToValueAtTime(0.08, t + 0.01);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.028);
    }
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.ambientGain);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  // --- Sound Effects (SFX) ---

  /** Playful canine bark with pitch drop, formant resonance and chest punch */
  public playBark(pitch: "normal" | "high" | "low" = "normal") {
    if (!this.settings.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx || !this.sfxGain) return;

    const baseFreq = pitch === "high" ? 420 : pitch === "low" ? 220 : 320;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(baseFreq * 1.5, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, now + 0.16);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(baseFreq * 2.2, now);
    filter.Q.setValueAtTime(3.5, now);

    const bufferSize = ctx.sampleRate * 0.16;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.05));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.6, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(filter);
    filter.connect(gain);
    noise.connect(noiseGain);
    noiseGain.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    noise.start(now);
    osc.stop(now + 0.19);
    noise.stop(now + 0.19);
  }

  /** Short happy puppy chirp or soft woof */
  public playSoftWoof() {
    if (!this.settings.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.12);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  /** Realistic treat crunching sound */
  public playCrunch() {
    if (!this.settings.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx || !this.sfxGain) return;

    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        if (!ctx || !this.sfxGain) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = "square";
        osc.frequency.setValueAtTime(200 + Math.random() * 150, now);
        filter.type = "highpass";
        filter.frequency.setValueAtTime(1200 + Math.random() * 600, now);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.04 + Math.random() * 0.03);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.08);
      }, i * 45);
    }
  }

  /** Tennis ball bounce thud */
  public playBallBounce() {
    if (!this.settings.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  /** Squeaky toy fun chirp */
  public playSqueak() {
    if (!this.settings.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.linearRampToValueAtTime(1600, now + 0.07);
    osc.frequency.linearRampToValueAtTime(1200, now + 0.14);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  /** Whistle trainer chirp */
  public playWhistle() {
    if (!this.settings.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(2400, now);
    osc.frequency.linearRampToValueAtTime(2800, now + 0.12);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  /** Victory / reward chime */
  public playRewardFanfare() {
    if (!this.settings.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx || !this.sfxGain) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        if (!ctx || !this.sfxGain) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.36);
      }, idx * 90);
    });
  }

  /** Gentle bedtime music box lullaby and yawn */
  public playGoodNightLullaby() {
    if (!this.settings.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx || !this.sfxGain) return;

    // Peaceful descending lullaby notes (E5, C#5, B4, G#4, E4)
    const lullabyNotes = [659.25, 554.37, 493.88, 415.3, 329.63];
    lullabyNotes.forEach((freq, idx) => {
      setTimeout(() => {
        if (!ctx || !this.sfxGain) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.7);
      }, idx * 260);
    });

    // Soft puppy sigh / yawn after lullaby notes
    setTimeout(() => {
      if (!ctx || !this.sfxGain) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.6);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.7);
    }, 1400);
  }

  /** Crisp sunrise chime for waking up on a fresh morning */
  public playGoodMorning() {
    if (!this.settings.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx || !this.sfxGain) return;

    const morningNotes = [392.0, 523.25, 659.25, 783.99, 1046.5]; // G4, C5, E5, G5, C6
    morningNotes.forEach((freq, idx) => {
      setTimeout(() => {
        if (!ctx || !this.sfxGain) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.22, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.46);
      }, idx * 100);
    });
  }

  /** Subtle tactile button tap sound */
  public playButtonTap() {
    if (!this.settings.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(380, now + 0.04);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /** Mechanical lamp switch / pull chain click */
  public playLightSwitch() {
    if (!this.settings.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /** Squeaky rubber duck / house toy bounce */
  public playToyBounce() {
    if (!this.settings.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.linearRampToValueAtTime(2200, now + 0.06);
    osc.frequency.linearRampToValueAtTime(1700, now + 0.12);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.17);
  }
}

export const sound = new SoundEngine();
