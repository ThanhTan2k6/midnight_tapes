"use client";

import { useEffect, useRef } from "react";
import { soundEngine } from "@/lib/sound-engine";
import { useTapeStore } from "@/store/useTapeStore";

interface Building {
  x: number;
  w: number;
  h: number;
  layer: 0 | 1; // 0 = far skyline, 1 = mid buildings
  shade: number;
  neonColor: string;
  hasNeon: boolean;
  hasBeacon: boolean;
  neonY: number;
  neonH: number;
  neonW: number;
  winSeed: number;
}

interface Raindrop {
  x: number;
  y: number;
  len: number;
  speed: number;
  alpha: number;
  layer: 0 | 1;
}

interface RainRipple {
  x: number;
  y: number;
  r: number;
  maxR: number;
  alpha: number;
}

interface GlassDrop {
  x: number;
  y: number;
  r: number;
  speed: number;
  wobble: number;
  trail: number;
}

interface Car {
  x: number;
  y: number;
  speed: number;
  dir: 1 | -1;
  width: number;
  height: number;
  type: "car" | "moto";
}

interface Point {
  x: number;
  y: number;
}

interface Hitbox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function RainyStreetCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const {
    doorEventCount,
    lightningEventCount,
    setDeckOpen,
    setAudioUnlocked,
    triggerDoorEvent,
  } = useTapeStore();

  const doorTriggerQueueRef = useRef(0);
  const lightningTriggerQueueRef = useRef(0);

  useEffect(() => {
    if (doorEventCount > 0) {
      doorTriggerQueueRef.current += 1;
    }
  }, [doorEventCount]);

  useEffect(() => {
    if (lightningEventCount > 0) {
      lightningTriggerQueueRef.current += 1;
    }
  }, [lightningEventCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let W = 0;
    let H = 0;
    let isMobile = false;
    let animId = 0;
    let lastTimestamp = 0;

    let buildings: Building[] = [];
    let raindrops: Raindrop[] = [];
    let ripples: RainRipple[] = [];
    let glassDrops: GlassDrop[] = [];
    let cars: Car[] = [];

    let cassetteHitbox: Hitbox = { x: 0, y: 0, w: 0, h: 0 };
    let doorHitbox: Hitbox = { x: 0, y: 0, w: 0, h: 0 };

    const state = {
      time: 0,
      armProgress: 0,
      tapeAngle: 0,
      doorOpen: 0,
      doorTimer: 0,
      guestAlpha: 0,
      guestXOffset: 0,
      lightningAlpha: 0,
      lightningBolt: [] as Point[],
      nextAutoLightning: 6 + Math.random() * 6,
    };

    const buildSceneEntities = () => {
      buildings = [];
      const horizonY = H * 0.58;
      const neonColors = ["#fbbf24", "#f59e0b", "#38bdf8", "#f43f5e", "#c084fc"];

      // Far skyline layer (tall skyscrapers)
      const farCount = Math.max(10, Math.floor(W / 95));
      for (let i = 0; i < farCount; i++) {
        const bw = (W / farCount) * (0.9 + Math.random() * 0.45);
        const bx = (i / farCount) * W - 15;
        const bh = H * (0.28 + Math.random() * 0.24);
        buildings.push({
          x: bx,
          w: bw,
          h: bh,
          layer: 0,
          shade: 9 + Math.floor(Math.random() * 7),
          neonColor: neonColors[i % neonColors.length],
          hasNeon: false,
          hasBeacon: bh > H * 0.42,
          neonY: 0,
          neonH: 0,
          neonW: 0,
          winSeed: Math.random() * 100,
        });
      }

      // Midground buildings with neon signs & warm shopfronts
      const midCount = Math.max(11, Math.floor(W / 85));
      for (let i = 0; i < midCount; i++) {
        const bw = (W / midCount) * (0.85 + Math.random() * 0.4);
        const bx = (i / midCount) * W - 10;
        const bh = H * (0.16 + Math.random() * 0.22);
        buildings.push({
          x: bx,
          w: bw,
          h: bh,
          layer: 1,
          shade: 15 + Math.floor(Math.random() * 11),
          neonColor: neonColors[Math.floor(Math.random() * neonColors.length)],
          hasNeon: Math.random() > 0.3,
          hasBeacon: false,
          neonY: horizonY - bh * (0.35 + Math.random() * 0.4),
          neonH: 10 + Math.random() * 20,
          neonW: bw * (0.4 + Math.random() * 0.35),
          winSeed: Math.random() * 100,
        });
      }

      // Two-layer pouring rain (long, fast diagonal streaks — unmistakably rain)
      raindrops = Array.from({ length: isMobile ? 75 : 240 }, (_, i) => {
        const layer: 0 | 1 = i % 3 === 0 ? 1 : 0;
        return {
          x: Math.random() * W,
          y: Math.random() * H,
          len: layer === 1 ? 42 + Math.random() * 26 : 26 + Math.random() * 18,
          speed: layer === 1 ? 1400 + Math.random() * 450 : 1050 + Math.random() * 350,
          alpha: layer === 1 ? 0.24 + Math.random() * 0.18 : 0.1 + Math.random() * 0.12,
          layer,
        };
      });

      // Rain splash ripples on wet asphalt
      ripples = Array.from({ length: 24 }, () => ({
        x: Math.random() * W,
        y: H * (0.59 + Math.random() * 0.16),
        r: Math.random() * 4,
        maxR: 6 + Math.random() * 7,
        alpha: Math.random() * 0.4,
      }));

      // Glass window water trickles (vertical gravity streaks, no horizontal wobble)
      glassDrops = Array.from({ length: isMobile ? 14 : 32 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H * 0.78,
        r: 1.0 + Math.random() * 1.1,
        speed: 35 + Math.random() * 55,
        wobble: 0,
        trail: 18 + Math.random() * 28,
      }));

      // Moving cars & motorbikes in 2 lanes
      cars = Array.from({ length: 10 }, (_, i) => {
        const dir: 1 | -1 = i % 2 === 0 ? 1 : -1;
        const type = i % 3 === 0 ? "moto" : "car";
        return {
          x: Math.random() * W,
          y: H * (dir === 1 ? 0.635 : 0.705) + (Math.random() * 10 - 5),
          speed: (type === "car" ? 135 + Math.random() * 140 : 175 + Math.random() * 130) * dir,
          dir,
          width: type === "car" ? 58 + Math.random() * 18 : 26,
          height: type === "car" ? 20 : 14,
          type,
        };
      });
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      isMobile = W < 768;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildSceneEntities();
    };

    const startDoorAnimation = () => {
      if (state.doorTimer > 0.5) return;
      state.doorTimer = 5.2;
      state.guestXOffset = -36;
      soundEngine.playDoorBell();
    };

    const startLightningBolt = () => {
      state.lightningAlpha = 1.0;
      const startX = W * (0.35 + Math.random() * 0.45);
      let cx = startX;
      let cy = H * 0.04;
      const points: Point[] = [{ x: cx, y: cy }];
      while (cy < H * 0.44) {
        cy += 16 + Math.random() * 22;
        cx += (Math.random() - 0.48) * 34;
        points.push({ x: cx, y: cy });
      }
      state.lightningBolt = points;
      const store = useTapeStore.getState();
      if (store.audioUnlocked && store.rainEnabled) {
        soundEngine.playThunderSound();
      }
    };

    const drawMobileRainOnly = (dt: number) => {
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, "#070a12");
      bgGrad.addColorStop(0.55, "#111520");
      bgGrad.addColorStop(1, "#090b10");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      const mult = useTapeStore.getState().rainEnabled ? 1.35 : 0.7;
      ctx.strokeStyle = "rgba(186, 230, 253, 0.24)";
      ctx.lineWidth = 1;
      for (const r of raindrops) {
        r.x -= r.speed * 0.16 * dt;
        r.y += r.speed * dt;
        if (r.y > H) {
          r.y = -20;
          r.x = Math.random() * (W + 80);
        }
        ctx.globalAlpha = r.alpha * mult;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x - r.len * 0.16, r.y + r.len);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      for (const d of glassDrops) {
        d.y += d.speed * dt;
        if (d.y > H) {
          d.y = -d.trail;
          d.x = Math.random() * W;
        }
        ctx.strokeStyle = "rgba(224, 242, 254, 0.14)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x, Math.max(0, d.y - d.trail));
        ctx.stroke();

        ctx.fillStyle = "rgba(224, 242, 254, 0.24)";
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, d.r * 0.75, d.r * 1.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawDesktopScene = (dt: number) => {
      const horizonY = H * 0.58;
      const counterTopY = H * 0.77;

      // A. NIGHT SKY, CITY HORIZON HAZE & LIGHTNING
      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
      skyGrad.addColorStop(0, "#05070e");
      skyGrad.addColorStop(0.55, "#0f172a");
      skyGrad.addColorStop(1, "#231a18");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, horizonY);

      if (state.lightningAlpha > 0.01) {
        ctx.fillStyle = `rgba(219, 234, 254, ${state.lightningAlpha * 0.34})`;
        ctx.fillRect(0, 0, W, H);

        if (state.lightningBolt.length > 1) {
          ctx.save();
          ctx.strokeStyle = `rgba(255, 255, 255, ${state.lightningAlpha})`;
          ctx.lineWidth = 2.5;
          ctx.shadowColor = "#93c5fd";
          ctx.shadowBlur = 24;
          ctx.beginPath();
          ctx.moveTo(state.lightningBolt[0].x, state.lightningBolt[0].y);
          for (let i = 1; i < state.lightningBolt.length; i++) {
            ctx.lineTo(state.lightningBolt[i].x, state.lightningBolt[i].y);
          }
          ctx.stroke();
          ctx.restore();
        }
      }

      // B. TWO-LAYER CITY SKYLINE, BLINKING BEACONS & NEON SIGNS
      for (const b of buildings) {
        ctx.fillStyle = `rgb(${b.shade}, ${b.shade + 4}, ${b.shade + 12})`;
        ctx.fillRect(b.x, horizonY - b.h, b.w, b.h);

        // Rooftop blinking aviation beacon on tall far skyscrapers
        if (b.hasBeacon) {
          const blink = Math.sin(state.time * 2.2 + b.winSeed) > 0.55;
          if (blink) {
            ctx.save();
            ctx.fillStyle = "#ef4444";
            ctx.shadowColor = "#ef4444";
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(b.x + b.w * 0.5, horizonY - b.h - 3, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }

        // Lit apartment/office windows
        ctx.fillStyle = b.layer === 0 ? "rgba(253, 230, 138, 0.09)" : "rgba(253, 230, 138, 0.18)";
        for (let wy = horizonY - b.h + 14; wy < horizonY - 22; wy += 17) {
          for (let wx = b.x + 8; wx < b.x + b.w - 10; wx += 14) {
            if (Math.sin(wx * 0.3 + wy * 0.7 + b.winSeed) > 0.42) {
              ctx.fillRect(wx, wy, 6, 9);
            }
          }
        }

        // Ground-floor warm shopfronts on midground buildings
        if (b.layer === 1) {
          ctx.fillStyle = "rgba(245, 158, 11, 0.14)";
          ctx.fillRect(b.x + 6, horizonY - 16, b.w - 12, 16);
        }

        // Pulsing Neon Signs
        if (b.hasNeon) {
          ctx.save();
          ctx.fillStyle = b.neonColor;
          ctx.shadowColor = b.neonColor;
          ctx.shadowBlur = 18;
          ctx.globalAlpha = 0.75 + Math.sin(state.time * 4 + b.winSeed) * 0.14;
          ctx.fillRect(b.x + b.w * 0.2, b.neonY, b.neonW, b.neonH);
          ctx.restore();
        }
      }

      // C. WET STREET, SIDEWALK, AMBER STREETLIGHTS & MOVING VEHICLES
      const streetGrad = ctx.createLinearGradient(0, horizonY, 0, counterTopY);
      streetGrad.addColorStop(0, "#0b0f17");
      streetGrad.addColorStop(0.2, "#101521");
      streetGrad.addColorStop(1, "#171c29");
      ctx.fillStyle = streetGrad;
      ctx.fillRect(0, horizonY, W, counterTopY - horizonY);

      // Subtle dashed lane divider across wet street
      ctx.strokeStyle = "rgba(254, 243, 199, 0.12)";
      ctx.lineWidth = 2;
      ctx.setLineDash([18, 22]);
      ctx.beginPath();
      ctx.moveTo(0, (horizonY + counterTopY) * 0.5);
      ctx.lineTo(W, (horizonY + counterTopY) * 0.5);
      ctx.stroke();
      ctx.setLineDash([]);

      // Amber Streetlights & Shimmering Wet Road Reflections
      const lampSpacing = Math.max(190, W / 4);
      for (let lx = lampSpacing * 0.5; lx < W; lx += lampSpacing) {
        const refGrad = ctx.createRadialGradient(
          lx,
          horizonY + 42,
          4,
          lx,
          horizonY + 42,
          110
        );
        refGrad.addColorStop(0, "rgba(251, 191, 36, 0.28)");
        refGrad.addColorStop(1, "rgba(251, 191, 36, 0)");
        ctx.fillStyle = refGrad;
        ctx.fillRect(lx - 110, horizonY, 220, counterTopY - horizonY);

        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(lx, horizonY + 8);
        ctx.lineTo(lx, horizonY - 62);
        ctx.lineTo(lx + 18, horizonY - 66);
        ctx.stroke();

        ctx.save();
        ctx.fillStyle = "#fef3c7";
        ctx.shadowColor = "#f59e0b";
        ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.arc(lx + 18, horizonY - 64, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Stylized Moving Cars & Motorbikes with Headlight Cones & Wet Reflections
      for (const car of cars) {
        car.x += car.speed * dt;
        if (car.dir === 1 && car.x > W + 160) car.x = -160;
        if (car.dir === -1 && car.x < -160) car.x = W + 160;

        ctx.save();
        // Vehicle Silhouette
        ctx.fillStyle = "rgba(10, 12, 18, 0.92)";
        ctx.beginPath();
        ctx.roundRect(
          car.x - car.width * 0.5,
          car.y - car.height,
          car.width,
          car.height,
          car.type === "car" ? 6 : 4
        );
        ctx.fill();

        if (car.type === "car") {
          // Cabin roof
          ctx.beginPath();
          ctx.roundRect(
            car.x - car.width * 0.28,
            car.y - car.height - 9,
            car.width * 0.56,
            10,
            4
          );
          ctx.fill();
        }

        if (car.dir === 1) {
          // Headlight cone pointing right
          const hx = car.x + car.width * 0.5;
          const hy = car.y - 6;
          const coneGrad = ctx.createLinearGradient(hx, hy, hx + 110, hy);
          coneGrad.addColorStop(0, "rgba(254, 243, 199, 0.55)");
          coneGrad.addColorStop(1, "rgba(251, 191, 36, 0)");
          ctx.fillStyle = coneGrad;
          ctx.beginPath();
          ctx.moveTo(hx, hy - 3);
          ctx.lineTo(hx + 110, hy - 16);
          ctx.lineTo(hx + 110, hy + 14);
          ctx.lineTo(hx, hy + 3);
          ctx.closePath();
          ctx.fill();

          // Bright headlight bulb + wet reflection
          ctx.fillStyle = "#fef9c3";
          ctx.shadowColor = "#fbbf24";
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(hx, hy, 3.2, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "rgba(251, 191, 36, 0.16)";
          ctx.fillRect(hx - 10, car.y + 2, 48, 12);
        } else {
          // Headlight cone pointing left + red taillight on back (right)
          const fx = car.x - car.width * 0.5;
          const bx = car.x + car.width * 0.5;
          const ly = car.y - 6;

          const coneGrad = ctx.createLinearGradient(fx, ly, fx - 105, ly);
          coneGrad.addColorStop(0, "rgba(254, 243, 199, 0.45)");
          coneGrad.addColorStop(1, "rgba(251, 191, 36, 0)");
          ctx.fillStyle = coneGrad;
          ctx.beginPath();
          ctx.moveTo(fx, ly - 3);
          ctx.lineTo(fx - 105, ly - 14);
          ctx.lineTo(fx - 105, ly + 14);
          ctx.lineTo(fx, ly + 3);
          ctx.closePath();
          ctx.fill();

          // Crimson Taillight
          ctx.fillStyle = "#fca5a5";
          ctx.shadowColor = "#ef4444";
          ctx.shadowBlur = 16;
          ctx.beginPath();
          ctx.arc(bx, ly, 3.2, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "rgba(239, 68, 68, 0.18)";
          ctx.fillRect(bx - 16, car.y + 2, 34, 12);
        }

        ctx.restore();
      }

      // Rain splash ripples on wet road
      ctx.lineWidth = 1;
      for (const rp of ripples) {
        rp.r += dt * 14;
        if (rp.r >= rp.maxR) {
          rp.r = 0.5;
          rp.x = Math.random() * W;
          rp.y = horizonY + 8 + Math.random() * (counterTopY - horizonY - 14);
        }
        const progress = rp.r / rp.maxR;
        ctx.strokeStyle = `rgba(186, 230, 253, ${(1 - progress) * 0.25})`;
        ctx.beginPath();
        ctx.ellipse(rp.x, rp.y, rp.r * 1.6, rp.r * 0.55, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // D. EXTERIOR RAINFALL & WINDOW GLASS DROPLETS
      const rainMult = useTapeStore.getState().rainEnabled ? 1.4 : 0.78;
      ctx.strokeStyle = "rgba(186, 230, 253, 0.26)";
      for (const r of raindrops) {
        r.x -= r.speed * 0.17 * dt;
        r.y += r.speed * dt;
        if (r.y > counterTopY) {
          r.y = -20;
          r.x = Math.random() * (W + 120);
        }
        ctx.lineWidth = r.layer === 1 ? 1.3 : 0.9;
        ctx.globalAlpha = r.alpha * rainMult;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x - r.len * 0.17, r.y + r.len);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      const doorW = Math.min(185, W * 0.22);
      const doorX = Math.max(24, W * 0.04);
      doorHitbox = {
        x: doorX,
        y: H * 0.14,
        w: doorW,
        h: counterTopY - H * 0.14,
      };

      for (const d of glassDrops) {
        d.y += d.speed * dt;
        if (d.y > counterTopY - 6) {
          d.y = -d.trail;
          d.x = Math.random() * W;
        }
        // Vertical water trickle streak on glass pane
        ctx.strokeStyle = "rgba(224, 242, 254, 0.15)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x, Math.max(0, d.y - d.trail));
        ctx.stroke();

        ctx.fillStyle = "rgba(224, 242, 254, 0.26)";
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, d.r * 0.75, d.r * 1.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // E. LEFT ENTRANCE DOOR & GUEST ARRIVAL
      ctx.strokeStyle = "#18181b";
      ctx.lineWidth = 8;
      ctx.strokeRect(doorHitbox.x, doorHitbox.y, doorHitbox.w, doorHitbox.h);

      if (state.doorOpen > 0.01) {
        ctx.save();
        const spillGrad = ctx.createLinearGradient(
          doorHitbox.x,
          doorHitbox.y,
          doorHitbox.x + doorHitbox.w * 2.2,
          counterTopY
        );
        spillGrad.addColorStop(0, `rgba(251, 191, 36, ${state.doorOpen * 0.34})`);
        spillGrad.addColorStop(1, "rgba(251, 191, 36, 0)");
        ctx.fillStyle = spillGrad;
        ctx.fillRect(
          doorHitbox.x,
          doorHitbox.y,
          doorHitbox.w * 2.2,
          doorHitbox.h
        );

        if (state.guestAlpha > 0.01) {
          const gx = doorHitbox.x + doorHitbox.w * 0.55 + state.guestXOffset;
          const gy = counterTopY;
          ctx.fillStyle = `rgba(12, 14, 20, ${state.guestAlpha * 0.92})`;
          ctx.beginPath();
          ctx.arc(gx, gy - 175, 19, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.roundRect(gx - 30, gy - 152, 60, 152, [22, 22, 0, 0]);
          ctx.fill();
        }
        ctx.restore();
      }

      const openShift = state.doorOpen * (doorHitbox.w * 0.68);
      ctx.fillStyle = "rgba(24, 28, 38, 0.35)";
      ctx.fillRect(
        doorHitbox.x + 4,
        doorHitbox.y + 4,
        doorHitbox.w - 8 - openShift,
        doorHitbox.h - 8
      );
      ctx.strokeStyle = "#27272a";
      ctx.lineWidth = 4;
      ctx.strokeRect(
        doorHitbox.x + 4,
        doorHitbox.y + 4,
        doorHitbox.w - 8 - openShift,
        doorHitbox.h - 8
      );

      // Glowing "OPEN" Neon Sign on Left Door
      if (state.doorOpen < 0.5) {
        ctx.save();
        const signW = Math.min(76, doorHitbox.w * 0.55);
        const signH = 28;
        const signX =
          doorHitbox.x + (doorHitbox.w - openShift - signW) * 0.5;
        const signY = doorHitbox.y + doorHitbox.h * 0.24;
        ctx.strokeStyle = "#fbbf24";
        ctx.shadowColor = "#f59e0b";
        ctx.shadowBlur = 14;
        ctx.lineWidth = 2;
        ctx.strokeRect(signX, signY, signW, signH);

        ctx.fillStyle = "#fef3c7";
        ctx.font = '600 12px "VT323", monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("OPEN", signX + signW * 0.5, signY + signH * 0.5 + 1);
        ctx.restore();
      }

      // Main Window Vertical Dividers
      ctx.fillStyle = "#111318";
      ctx.fillRect(W * 0.56, 0, 10, counterTopY);
      ctx.fillRect(W * 0.86, 0, 10, counterTopY);

      // F. WARM OVERHEAD PENDANT LAMP GLOW
      const lampX = W * 0.44;
      const warmGlow = ctx.createRadialGradient(
        lampX,
        H * 0.18,
        10,
        lampX,
        counterTopY - 20,
        H * 0.55
      );
      warmGlow.addColorStop(0, "rgba(251, 191, 36, 0.22)");
      warmGlow.addColorStop(0.55, "rgba(217, 119, 6, 0.07)");
      warmGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = warmGlow;
      ctx.fillRect(0, 0, W, counterTopY);

      // G. STYLIZED MINIMALIST CHARACTER AT BAR COUNTER
      const charX = Math.max(doorHitbox.x + doorHitbox.w + 75, W * 0.34);
      const charBaseY = counterTopY + 55;
      const breathe = prefersReducedMotion ? 0 : Math.sin(state.time * 2.1) * 2.2;

      ctx.save();
      ctx.fillStyle = "#1c1917";
      ctx.beginPath();
      ctx.roundRect(
        charX - 36,
        charBaseY - 155 + breathe,
        74,
        165,
        [28, 34, 8, 8]
      );
      ctx.fill();

      ctx.strokeStyle = "rgba(253, 224, 71, 0.28)";
      ctx.lineWidth = 2;
      ctx.stroke();

      const headX = charX + 6;
      const headY = charBaseY - 184 + breathe;
      ctx.fillStyle = "#d6a887";
      ctx.beginPath();
      ctx.arc(headX, headY, 21, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#0c0a09";
      ctx.beginPath();
      ctx.arc(headX - 3, headY - 4, 22, Math.PI * 0.85, Math.PI * 2.15);
      ctx.fill();

      // H. WOODEN BAR COUNTER
      const counterGrad = ctx.createLinearGradient(0, counterTopY, 0, H);
      counterGrad.addColorStop(0, "#291d16");
      counterGrad.addColorStop(0.12, "#1c130e");
      counterGrad.addColorStop(1, "#0c0806");
      ctx.fillStyle = counterGrad;
      ctx.fillRect(0, counterTopY, W, H - counterTopY);

      ctx.fillStyle = "rgba(251, 191, 36, 0.25)";
      ctx.fillRect(0, counterTopY, W, 2);

      // I. CASSETTE DECK & GLASS OF WATER ON COUNTER
      const deckW = 112;
      const deckH = 58;
      const deckX = charX + 78;
      const deckY = counterTopY - deckH + 4;
      cassetteHitbox = {
        x: deckX - 16,
        y: deckY - 16,
        w: deckW + 32,
        h: deckH + 32,
      };

      const deckGlow = ctx.createRadialGradient(
        deckX + deckW / 2,
        deckY + deckH / 2,
        8,
        deckX + deckW / 2,
        deckY + deckH / 2,
        70
      );
      deckGlow.addColorStop(0, "rgba(245, 158, 11, 0.22)");
      deckGlow.addColorStop(1, "rgba(245, 158, 11, 0)");
      ctx.fillStyle = deckGlow;
      ctx.fillRect(deckX - 30, deckY - 30, deckW + 60, deckH + 60);

      ctx.fillStyle = "#27272a";
      ctx.beginPath();
      ctx.roundRect(deckX, deckY, deckW, deckH, 6);
      ctx.fill();
      ctx.strokeStyle = "#78716c";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#18181b";
      ctx.fillRect(deckX + 16, deckY + 12, 80, 28);

      [deckX + 38, deckX + 74].forEach((rx) => {
        const ry = deckY + 26;
        ctx.strokeStyle = "#e7e5e4";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(rx, ry, 8.5, 0, Math.PI * 2);
        ctx.stroke();

        for (let s = 0; s < 3; s++) {
          const a = state.tapeAngle + (s * Math.PI * 2) / 3;
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx + Math.cos(a) * 7.5, ry + Math.sin(a) * 7.5);
          ctx.stroke();
        }
      });

      const currentStatus = useTapeStore.getState().status;
      const isRec = currentStatus === "RECORDING";
      const isActive = isRec || currentStatus === "PLAYING";
      ctx.save();
      ctx.fillStyle = isRec ? "#ef4444" : isActive ? "#fbbf24" : "#71717a";
      if (isActive) {
        ctx.shadowColor = isRec ? "#ef4444" : "#f59e0b";
        ctx.shadowBlur = 12;
      }
      ctx.beginPath();
      ctx.arc(deckX + 99, deckY + 13, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Character Arm Reaching to Press Cassette Button
      const shoulderX = charX + 12;
      const shoulderY = charBaseY - 130 + breathe;
      const restHandX = charX + 46;
      const restHandY = counterTopY - 2;
      const pressHandX = deckX + 24;
      const pressHandY = deckY + 4;

      const handX = restHandX + (pressHandX - restHandX) * state.armProgress;
      const handY = restHandY + (pressHandY - restHandY) * state.armProgress;

      ctx.strokeStyle = "#292524";
      ctx.lineWidth = 16;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(shoulderX, shoulderY);
      ctx.quadraticCurveTo(shoulderX + 22, counterTopY - 26, handX, handY);
      ctx.stroke();

      ctx.fillStyle = "#d6a887";
      ctx.beginPath();
      ctx.arc(handX, handY, 6.5, 0, Math.PI * 2);
      ctx.fill();

      // Glass of Water with Ice on Counter
      const glassX = deckX + deckW + 34;
      const glassY = counterTopY - 34;
      ctx.fillStyle = "rgba(186, 230, 253, 0.22)";
      ctx.strokeStyle = "rgba(224, 242, 254, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(glassX, glassY);
      ctx.lineTo(glassX + 24, glassY);
      ctx.lineTo(glassX + 21, glassY + 34);
      ctx.lineTo(glassX + 3, glassY + 34);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "rgba(125, 211, 252, 0.32)";
      ctx.fillRect(glassX + 3, glassY + 12, 18, 21);
      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      ctx.fillRect(glassX + 6, glassY + 14, 7, 7);
      ctx.fillRect(glassX + 12, glassY + 18, 6, 6);

      ctx.restore();
    };

    const animate = (timestamp: number) => {
      if (!lastTimestamp) lastTimestamp = timestamp;
      const dt = Math.min(0.05, (timestamp - lastTimestamp) / 1000);
      lastTimestamp = timestamp;

      state.time += dt;

      if (doorTriggerQueueRef.current > 0) {
        doorTriggerQueueRef.current = 0;
        startDoorAnimation();
      }
      if (lightningTriggerQueueRef.current > 0) {
        lightningTriggerQueueRef.current = 0;
        startLightningBolt();
      }

      const storeState = useTapeStore.getState();
      const deckActive =
        storeState.status === "RECORDING" || storeState.status === "PLAYING";
      const targetArm = deckActive ? 1 : 0;
      state.armProgress += (targetArm - state.armProgress) * Math.min(1, dt * 6);

      if (deckActive) {
        state.tapeAngle += dt * 3.2;
      }

      if (state.doorTimer > 0) {
        state.doorTimer -= dt;
        state.doorOpen += (1 - state.doorOpen) * Math.min(1, dt * 5);
        if (state.doorTimer < 4.5 && state.doorTimer > 1.0) {
          state.guestAlpha = Math.min(1, state.guestAlpha + dt * 1.5);
          state.guestXOffset = Math.min(28, state.guestXOffset + dt * 22);
        } else if (state.doorTimer <= 1.0) {
          state.guestAlpha = Math.max(0, state.guestAlpha - dt * 1.8);
        }
        if (state.doorTimer <= 0) {
          state.doorTimer = 0;
        }
      } else {
        state.doorOpen += (0 - state.doorOpen) * Math.min(1, dt * 4);
      }

      if (state.lightningAlpha > 0) {
        state.lightningAlpha = Math.max(0, state.lightningAlpha - dt * 2.4);
      }

      if (!isMobile && !prefersReducedMotion) {
        state.nextAutoLightning -= dt;
        if (state.nextAutoLightning <= 0) {
          startLightningBolt();
          state.nextAutoLightning = 11 + Math.random() * 14;
        }
      }

      ctx.clearRect(0, 0, W, H);
      if (isMobile) {
        drawMobileRainOnly(dt);
      } else {
        drawDesktopScene(dt);
      }

      animId = requestAnimationFrame(animate);
    };

    const handleCanvasClick = async (e: MouseEvent) => {
      if (isMobile) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (
        x >= cassetteHitbox.x &&
        x <= cassetteHitbox.x + cassetteHitbox.w &&
        y >= cassetteHitbox.y &&
        y <= cassetteHitbox.y + cassetteHitbox.h
      ) {
        await soundEngine.unlock();
        setAudioUnlocked(true);
        soundEngine.playPlayEngage();
        setDeckOpen(true);
        return;
      }

      if (
        x >= doorHitbox.x &&
        x <= doorHitbox.x + doorHitbox.w &&
        y >= doorHitbox.y &&
        y <= doorHitbox.y + doorHitbox.h
      ) {
        await soundEngine.unlock();
        setAudioUnlocked(true);
        triggerDoorEvent();
      }
    };

    const handleCanvasMove = (e: MouseEvent) => {
      if (isMobile) {
        canvas.style.cursor = "default";
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const overCassette =
        x >= cassetteHitbox.x &&
        x <= cassetteHitbox.x + cassetteHitbox.w &&
        y >= cassetteHitbox.y &&
        y <= cassetteHitbox.y + cassetteHitbox.h;
      const overDoor =
        x >= doorHitbox.x &&
        x <= doorHitbox.x + doorHitbox.w &&
        y >= doorHitbox.y &&
        y <= doorHitbox.y + doorHitbox.h;

      canvas.style.cursor = overCassette || overDoor ? "pointer" : "default";
    };

    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("click", handleCanvasClick);
    canvas.addEventListener("mousemove", handleCanvasMove);
    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("click", handleCanvasClick);
      canvas.removeEventListener("mousemove", handleCanvasMove);
    };
  }, [setAudioUnlocked, setDeckOpen, triggerDoorEvent]);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-label="Khung cảnh quán cà phê đêm mưa và quầy bar"
        className="fixed inset-0 z-0 w-full h-full block"
      />
      <button
        type="button"
        onClick={async () => {
          await soundEngine.unlock();
          setAudioUnlocked(true);
          soundEngine.playPlayEngage();
          setDeckOpen(true);
        }}
        className="hidden md:block sr-only focus:not-sr-only focus:fixed focus:bottom-6 focus:left-1/2 focus:-translate-x-1/2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-full focus:bg-[#0e1118] focus:text-amber-200 focus:border focus:border-amber-400/60 focus:text-xs focus:shadow-lg"
      >
        Mở máy phát băng Cassette
      </button>
    </>
  );
}
