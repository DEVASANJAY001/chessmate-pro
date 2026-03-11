import { useCallback, useRef, useState } from "react";

// Generate a notification beep using Web Audio API
function playBeep(frequency = 880, duration = 200, volume = 0.3) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration / 1000);

    // Play a second tone for pattern alert (double beep)
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(frequency * 1.25, ctx.currentTime);
      gain2.gain.setValueAtTime(volume, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);
      osc2.start(ctx.currentTime);
      osc2.stop(ctx.currentTime + duration / 1000);
    }, duration + 50);
  } catch (e) {
    console.warn("Audio playback failed:", e);
  }
}

// Play a success/bullish chime
function playBullishAlert() {
  playBeep(660, 150, 0.25);
  setTimeout(() => playBeep(880, 150, 0.25), 200);
  setTimeout(() => playBeep(1100, 200, 0.2), 400);
}

// Play a warning/bearish alert
function playBearishAlert() {
  playBeep(440, 200, 0.3);
  setTimeout(() => playBeep(330, 250, 0.25), 250);
}

export function useAlertSound() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const lastAlertRef = useRef<number>(0);

  const playPatternAlert = useCallback((bias: "BULLISH" | "BEARISH" | string, patternCount: number) => {
    if (!soundEnabled) return;
    
    // Throttle: at most once every 5 seconds
    const now = Date.now();
    if (now - lastAlertRef.current < 5000) return;
    lastAlertRef.current = now;

    if (bias === "BULLISH") {
      playBullishAlert();
    } else {
      playBearishAlert();
    }
  }, [soundEnabled]);

  const playGenericAlert = useCallback(() => {
    if (!soundEnabled) return;
    const now = Date.now();
    if (now - lastAlertRef.current < 5000) return;
    lastAlertRef.current = now;
    playBeep(880, 200, 0.25);
  }, [soundEnabled]);

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => !prev);
  }, []);

  return { soundEnabled, toggleSound, playPatternAlert, playGenericAlert };
}
