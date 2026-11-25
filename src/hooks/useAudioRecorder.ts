"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AudioRecordingResult {
  blob: Blob;
  url: string;
  mimeType: string;
  sizeBytes: number;
}

function getSupportedMimeType(): string {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return "";
  }
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "";
}

export function useAudioRecorder(voiceMaskEnabled: boolean) {
  const [recording, setRecording] = useState<AudioRecordingResult | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const startupTokenRef = useRef(0);
  const voiceMaskRef = useRef(voiceMaskEnabled);
  const recordingUrlRef = useRef<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletLoadedRef = useRef(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Live DSP nodes for Voice Mask toggle during recording
  const lowpassRef = useRef<BiquadFilterNode | null>(null);
  const pitchNodeRef = useRef<AudioWorkletNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);

  // Playback preview refs
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const stopMeterLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (isMountedRef.current) {
      setAudioLevel(0);
    }
  }, []);

  const startMeterLoop = useCallback(
    (analyser: AnalyserNode) => {
      stopMeterLoop();
      const dataArray = new Uint8Array(analyser.fftSize);

      const update = () => {
        if (!isMountedRef.current) return;
        analyser.getByteTimeDomainData(dataArray);
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const normalized = (dataArray[i] - 128) / 128;
          sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);
        const level = Math.min(1, rms * 3.8);
        setAudioLevel(level);
        rafRef.current = requestAnimationFrame(update);
      };

      rafRef.current = requestAnimationFrame(update);
    },
    [stopMeterLoop]
  );

  const releaseMicResources = useCallback(() => {
    stopMeterLoop();
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    lowpassRef.current = null;
    pitchNodeRef.current = null;
    analyserRef.current = null;
  }, [stopMeterLoop]);

  // Keep latest voiceMaskEnabled in ref & sync live DSP nodes if toggled mid-recording
  useEffect(() => {
    voiceMaskRef.current = voiceMaskEnabled;

    if (lowpassRef.current && audioCtxRef.current) {
      lowpassRef.current.frequency.setTargetAtTime(
        voiceMaskEnabled ? 3600 : 18000,
        audioCtxRef.current.currentTime,
        0.04
      );
    }
    if (pitchNodeRef.current && audioCtxRef.current) {
      const bypassParam = pitchNodeRef.current.parameters.get("bypass");
      if (bypassParam) {
        bypassParam.setValueAtTime(
          voiceMaskEnabled ? 0 : 1,
          audioCtxRef.current.currentTime
        );
      }
    }
  }, [voiceMaskEnabled]);

  const getOrCreateAudioContext = useCallback(async (): Promise<AudioContext> => {
    if (!audioCtxRef.current) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === "suspended") {
      await audioCtxRef.current.resume();
    }
    if (!workletLoadedRef.current && audioCtxRef.current.audioWorklet) {
      try {
        await audioCtxRef.current.audioWorklet.addModule(
          "/worklets/pitch-shifter-processor.js"
        );
        workletLoadedRef.current = true;
      } catch {
        // Fallback smoothly to warm lowpass filter if worklet cannot load
      }
    }
    return audioCtxRef.current;
  }, []);

  const stopPlayback = useCallback(() => {
    stopMeterLoop();
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause();
      playbackAudioRef.current.currentTime = 0;
    }
  }, [stopMeterLoop]);

  const clearRecording = useCallback(() => {
    stopPlayback();
    if (playbackSourceRef.current) {
      try {
        playbackSourceRef.current.disconnect();
      } catch {
        // Ignore
      }
      playbackSourceRef.current = null;
    }
    playbackAudioRef.current = null;

    if (recordingUrlRef.current) {
      URL.revokeObjectURL(recordingUrlRef.current);
      recordingUrlRef.current = null;
    }
    setRecording(null);
  }, [stopPlayback]);

  const startRecording = useCallback(async (): Promise<boolean> => {
    setMicError(null);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setMicError(
        "Trình duyệt này chưa hỗ trợ thu âm trực tiếp. Hãy thử Chrome, Safari hoặc Firefox mới nhất."
      );
      return false;
    }

    const myToken = ++startupTokenRef.current;

    try {
      clearRecording();
      const ctx = await getOrCreateAudioContext();
      if (!isMountedRef.current || startupTokenRef.current !== myToken) {
        return false;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (!isMountedRef.current || startupTokenRef.current !== myToken) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }

      micStreamRef.current = stream;

      const source = ctx.createMediaStreamSource(stream);

      // Mic Preamp Gain (+9dB) + Soft Compressor để tiếng thu to, rõ, ấm mà không bị vỡ (clip)
      const micGain = ctx.createGain();
      micGain.gain.value = 2.8;

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 18;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.2;

      const currentMask = voiceMaskRef.current;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = currentMask ? 3600 : 18000;
      lowpass.Q.value = 1.0;
      lowpassRef.current = lowpass;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyserRef.current = analyser;

      const destination = ctx.createMediaStreamDestination();

      source.connect(micGain);
      micGain.connect(compressor);
      compressor.connect(lowpass);

      if (workletLoadedRef.current) {
        try {
          const pitchNode = new AudioWorkletNode(
            ctx,
            "pitch-shifter-processor",
            {
              parameterData: {
                pitchFactor: 0.86,
                bypass: currentMask ? 0 : 1,
              },
            }
          );
          pitchNodeRef.current = pitchNode;
          lowpass.connect(pitchNode);
          pitchNode.connect(analyser);
        } catch {
          lowpass.connect(analyser);
        }
      } else {
        lowpass.connect(analyser);
      }

      analyser.connect(destination);

      const mimeType = getSupportedMimeType();
      const options: MediaRecorderOptions = {
        audioBitsPerSecond: 32000,
        ...(mimeType ? { mimeType } : {}),
      };

      const recorder = new MediaRecorder(destination.stream, options);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        releaseMicResources();
        if (!isMountedRef.current) return;

        const finalMime = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: finalMime });
        const url = URL.createObjectURL(blob);
        if (recordingUrlRef.current) {
          URL.revokeObjectURL(recordingUrlRef.current);
        }
        recordingUrlRef.current = url;
        setRecording({
          blob,
          url,
          mimeType: finalMime,
          sizeBytes: blob.size,
        });
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      startMeterLoop(analyser);
      return true;
    } catch (err) {
      releaseMicResources();
      if (!isMountedRef.current) return false;
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setMicError(
          "Tiệm băng cần quyền micro để thu lại tiếng lòng của bạn. Mọi âm thanh đều được giữ kín."
        );
      } else if (name === "NotFoundError") {
        setMicError("Không tìm thấy micro trên thiết bị của bạn.");
      } else {
        setMicError("Không thể khởi động micro lúc này. Vui lòng thử lại.");
      }
      return false;
    }
  }, [
    clearRecording,
    getOrCreateAudioContext,
    releaseMicResources,
    startMeterLoop,
  ]);

  const pauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.pause();
      stopMeterLoop();
    }
  }, [stopMeterLoop]);

  const resumeRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "paused") {
      recorder.resume();
      if (analyserRef.current) {
        startMeterLoop(analyserRef.current);
      }
    }
  }, [startMeterLoop]);

  const stopRecording = useCallback(() => {
    startupTokenRef.current++;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      releaseMicResources();
    }
  }, [releaseMicResources]);

  const startPlayback = useCallback(
    async (onEnded?: () => void): Promise<boolean> => {
      if (!recording?.url) return false;

      try {
        const ctx = await getOrCreateAudioContext();
        if (!isMountedRef.current) return false;

        if (!playbackAudioRef.current) {
          const audio = new Audio(recording.url);
          playbackAudioRef.current = audio;

          const src = ctx.createMediaElementSource(audio);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 512;

          src.connect(analyser);
          analyser.connect(ctx.destination);

          playbackSourceRef.current = src;
          analyserRef.current = analyser;
        }

        const audio = playbackAudioRef.current;
        audio.onended = () => {
          stopMeterLoop();
          onEnded?.();
        };

        await audio.play();
        if (analyserRef.current) {
          startMeterLoop(analyserRef.current);
        }
        return true;
      } catch {
        return false;
      }
    },
    [getOrCreateAudioContext, recording, startMeterLoop, stopMeterLoop]
  );

  const pausePlayback = useCallback(() => {
    stopMeterLoop();
    playbackAudioRef.current?.pause();
  }, [stopMeterLoop]);

  // Full resource teardown on unmount
  useEffect(() => {
    isMountedRef.current = true;
    const startupRef = startupTokenRef;

    return () => {
      isMountedRef.current = false;
      startupRef.current += 1;

      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
      releaseMicResources();
      playbackAudioRef.current?.pause();

      if (recordingUrlRef.current) {
        URL.revokeObjectURL(recordingUrlRef.current);
        recordingUrlRef.current = null;
      }

      if (audioCtxRef.current) {
        void audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
        workletLoadedRef.current = false;
      }
    };
  }, [releaseMicResources]);

  return {
    recording,
    audioLevel,
    micError,
    clearMicError: () => setMicError(null),
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    startPlayback,
    pausePlayback,
    stopPlayback,
    clearRecording,
  };
}
