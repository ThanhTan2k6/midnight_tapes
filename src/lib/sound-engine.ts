"use client";

type SfxName = "rec" | "play" | "eject" | "toggle";

const SFX_PATHS: Record<SfxName, string> = {
  rec: "/audio/sfx-cassette-rec.mp3",
  play: "/audio/sfx-cassette-play.mp3",
  eject: "/audio/sfx-cassette-eject.mp3",
  toggle: "/audio/sfx-cassette-toggle.mp3",
};

/**
 * SoundEngine — Hệ thống âm thanh vật lý & môi trường
 * - Mưa đêm: Phát file MP3 thật (/audio/midnight-rain.mp3) có fade-in/out mượt mà.
 * - SFX Cassette: Giải mã trước (preload) 4 file MP3 cắt từ âm thanh cassette thật
 *   vào AudioBuffer để phát tức thì không độ trễ khi bấm nút.
 */
class MidnightSoundEngine {
  private ctx: AudioContext | null = null;
  private sfxBuffers = new Map<SfxName, AudioBuffer>();
  private loadingPromise: Promise<void> | null = null;
  private whiteNoiseBuffer: AudioBuffer | null = null;

  // Real Rain MP3 player
  private rainAudio: HTMLAudioElement | null = null;
  private rainFadeTimer: ReturnType<typeof setInterval> | null = null;
  private rainTargetVolume = 0.45;
  private rainActive = false;

  // Tape Hiss nodes
  private hissSource: AudioBufferSourceNode | null = null;
  private hissGain: GainNode | null = null;
  private hissActive = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }

    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }

    if (!this.whiteNoiseBuffer) {
      this.whiteNoiseBuffer = this.createWhiteNoiseBuffer(this.ctx, 2);
    }

    if (!this.loadingPromise) {
      this.loadingPromise = this.preloadAllSfx(this.ctx);
    }

    return this.ctx;
  }

  private async preloadAllSfx(ctx: AudioContext): Promise<void> {
    const entries = Object.entries(SFX_PATHS) as [SfxName, string][];
    await Promise.all(
      entries.map(async ([name, url]) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return;
          const arrayBuffer = await res.arrayBuffer();
          const decoded = await ctx.decodeAudioData(arrayBuffer);
          this.sfxBuffers.set(name, decoded);
        } catch {
          // Ignore preload failure in offline/SSR edge cases
        }
      })
    );
  }

  public async unlock(): Promise<boolean> {
    const ctx = this.ensureContext();
    if (!ctx) return false;
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    return ctx.state === "running";
  }

  private createWhiteNoiseBuffer(
    ctx: AudioContext,
    durationSeconds: number
  ): AudioBuffer {
    const bufferSize = ctx.sampleRate * durationSeconds;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private playSfxBuffer(name: SfxName, volume = 0.85, playbackRate = 1): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const buffer = this.sfxBuffers.get(name);
    if (buffer) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = playbackRate;

      const gain = ctx.createGain();
      gain.gain.value = volume;

      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
      return;
    }

    // Fallback HTMLAudio if buffer is still decoding on very first click
    const audio = new Audio(SFX_PATHS[name]);
    audio.volume = volume;
    audio.playbackRate = playbackRate;
    void audio.play().catch(() => {});
  }

  // =========================================================================
  // LAYER 1: MƯA ĐÊM (FILE MP3 THẬT) & TAPE HISS NHẸ
  // =========================================================================

  public startRain(volume = 0.45, onAutoplayBlocked?: () => void): void {
    if (typeof window === "undefined" || this.rainActive) return;

    if (!this.rainAudio) {
      this.rainAudio = new Audio("/audio/midnight-rain.mp3");
      this.rainAudio.loop = true;
      this.rainAudio.preload = "auto";
    }

    if (this.rainFadeTimer) {
      clearInterval(this.rainFadeTimer);
      this.rainFadeTimer = null;
    }

    this.rainAudio.volume = 0;
    this.rainTargetVolume = Math.max(0.02, Math.min(1, volume));
    this.rainActive = true;

    void this.rainAudio.play().catch(() => {
      if (this.rainFadeTimer) {
        clearInterval(this.rainFadeTimer);
        this.rainFadeTimer = null;
      }
      this.rainActive = false;
      onAutoplayBlocked?.();
    });

    this.rainFadeTimer = setInterval(() => {
      if (!this.rainAudio || !this.rainActive) return;
      const next = Math.min(this.rainTargetVolume, this.rainAudio.volume + 0.05);
      this.rainAudio.volume = next;
      if (next >= this.rainTargetVolume && this.rainFadeTimer) {
        clearInterval(this.rainFadeTimer);
        this.rainFadeTimer = null;
      }
    }, 45);
  }

  public setRainVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.rainTargetVolume = clamped;
    if (!this.rainAudio || !this.rainActive) return;
    if (this.rainFadeTimer) {
      clearInterval(this.rainFadeTimer);
      this.rainFadeTimer = null;
    }
    this.rainAudio.volume = clamped;
  }

  public stopRain(): void {
    if (!this.rainAudio || !this.rainActive) return;
    this.rainActive = false;

    if (this.rainFadeTimer) {
      clearInterval(this.rainFadeTimer);
      this.rainFadeTimer = null;
    }

    const audio = this.rainAudio;
    this.rainFadeTimer = setInterval(() => {
      const next = Math.max(0, audio.volume - 0.06);
      audio.volume = next;
      if (next <= 0.01) {
        audio.pause();
        if (this.rainFadeTimer) {
          clearInterval(this.rainFadeTimer);
          this.rainFadeTimer = null;
        }
      }
    }, 35);
  }

  public startTapeHiss(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.whiteNoiseBuffer || this.hissActive) return;

    const source = ctx.createBufferSource();
    source.buffer = this.whiteNoiseBuffer;
    source.loop = true;

    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 3200;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 6500;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.006, ctx.currentTime + 0.2);

    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(ctx.destination);
    source.start();

    this.hissSource = source;
    this.hissGain = gain;
    this.hissActive = true;
  }

  public stopTapeHiss(): void {
    if (!this.ctx || !this.hissSource || !this.hissGain || !this.hissActive) {
      return;
    }
    const sourceToStop = this.hissSource;
    this.hissGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.04);
    setTimeout(() => {
      try {
        sourceToStop.stop();
        sourceToStop.disconnect();
      } catch {
        // Ignore already stopped
      }
    }, 120);

    this.hissSource = null;
    this.hissGain = null;
    this.hissActive = false;
  }

  // =========================================================================
  // LAYER 2: ÂM THANH CASSETTE THẬT (ĐÃ CẮT TỪ FILE MP3)
  // =========================================================================

  /** Tiếng bấm nút [REC] */
  public playRecClick(): void {
    this.playSfxBuffer("rec", 0.9, 1.0);
  }

  /** Tiếng bấm nút [PLAY] */
  public playPlayEngage(): void {
    this.playSfxBuffer("play", 0.9, 1.0);
  }

  /** Tiếng bấm [PAUSE] / [STOP] */
  public playPauseStop(): void {
    this.playSfxBuffer("eject", 0.72, 1.12);
  }

  /** Tiếng bật nắp lò xo [EJECT] */
  public playEjectSnap(): void {
    this.playSfxBuffer("eject", 0.95, 1.0);
  }

  /** Tiếng gạt công tắc / đổi chế độ / chọn nhãn */
  public playToggleSwitch(): void {
    this.playSfxBuffer("toggle", 0.65, 1.05);
  }

  /** Tiếng chuông cửa quán cà phê ("Kính coong") khi có khách bước vào */
  public playDoorBell(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const chimes = [
      { freq: 1046.5, delay: 0, dur: 1.1 }, // C6
      { freq: 1318.5, delay: 0.14, dur: 1.3 }, // E6
    ];

    chimes.forEach(({ freq, delay, dur }) => {
      const start = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.09, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0005, start + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    });
  }

  /** Tiếng sấm rền trầm ấm ngoài trời mưa */
  public playThunderSound(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const duration = 2.4;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] =
        (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.7));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(140, ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(55, ctx.currentTime + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  }

  /** Tiếng chuông gió dịu dàng khi gửi Tách trà ấm */
  public playTeaChime(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const start = ctx.currentTime + idx * 0.09;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.08, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0005, start + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 1.25);
    });
  }
}

export const soundEngine = new MidnightSoundEngine();
