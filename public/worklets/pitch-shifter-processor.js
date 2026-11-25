/**
 * PitchShifterProcessor — AudioWorklet đơn giản dùng ring-buffer 2 đầu đọc
 * (dual-tap delay line với cửa sổ Hann) để hạ tone giọng tự nhiên (~ -2.5 bán âm)
 * cho tính năng "Màn che giọng ấm" (Voice Mask).
 */
class PitchShifterProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "pitchFactor",
        defaultValue: 0.86, // ~ -2.6 semitones (giọng trầm ấm, tự nhiên)
        minValue: 0.5,
        maxValue: 1.5,
        automationRate: "k-rate",
      },
      {
        name: "bypass",
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
        automationRate: "k-rate",
      },
    ];
  }

  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
    this.phase = 0;
    this.grainSize = 2048;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0] || !output || !output[0]) {
      return true;
    }

    const inChannel = input[0];
    const outChannel = output[0];
    const bypass = parameters.bypass[0] >= 0.5;
    const pitchFactor = parameters.pitchFactor[0];

    // Rate at which delay time changes to achieve pitch shift
    const delayRate = (1 - pitchFactor) / this.grainSize;

    for (let i = 0; i < inChannel.length; i++) {
      const sample = inChannel[i];
      this.buffer[this.writeIndex] = sample;

      if (bypass) {
        outChannel[i] = sample;
      } else {
        // Two overlapping read heads 180 degrees out of phase
        const phaseA = this.phase;
        const phaseB = (this.phase + 0.5) % 1;

        const delayA = phaseA * this.grainSize;
        const delayB = phaseB * this.grainSize;

        const sampleA = this.readInterpolated(this.writeIndex - delayA);
        const sampleB = this.readInterpolated(this.writeIndex - delayB);

        // Hann-like triangular crossfade window
        const gainA = 1 - Math.abs(2 * phaseA - 1);
        const gainB = 1 - Math.abs(2 * phaseB - 1);

        outChannel[i] = sampleA * gainA + sampleB * gainB;

        this.phase = (this.phase + delayRate + 1) % 1;
      }

      this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
    }

    // Mirror mono output to any extra output channels
    for (let ch = 1; ch < output.length; ch++) {
      output[ch].set(outChannel);
    }

    return true;
  }

  readInterpolated(index) {
    let wrapped = index % this.bufferSize;
    if (wrapped < 0) wrapped += this.bufferSize;

    const i0 = Math.floor(wrapped);
    const i1 = (i0 + 1) % this.bufferSize;
    const frac = wrapped - i0;
    return this.buffer[i0] * (1 - frac) + this.buffer[i1] * frac;
  }
}

registerProcessor("pitch-shifter-processor", PitchShifterProcessor);
