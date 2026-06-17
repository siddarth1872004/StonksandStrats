// audio.js - low-latency Web Audio synth for UI/game SFX

let audioCtx = null;
let isMuted = false;

function createCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    // latencyHint:"interactive" asks the browser for the smallest safe buffer so
    // clicks/sfx fire with minimal delay.
    audioCtx = new AC({ latencyHint: "interactive" });
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function getAudioContext() {
  if (isMuted) return null;
  return createCtx();
}

// Warm up + unlock the AudioContext on the very first user gesture so the first
// sound isn't swallowed by the browser's autoplay suspension (the classic
// "first click is silent / laggy" problem).
if (typeof window !== "undefined") {
  const unlock = () => {
    try { createCtx(); } catch { /* ignore */ }
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  window.addEventListener("touchstart", unlock);
}

export const setMuted = (muted) => {
  isMuted = muted;
};

export const getMuted = () => isMuted;

// Helper to play a quick note with envelope
function playTone({ freq, duration, type = "square", volume = 0.1, slides = [] }) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  
  // Apply pitch slides if any
  slides.forEach(([timeOffset, targetFreq]) => {
    osc.frequency.exponentialRampToValueAtTime(targetFreq, ctx.currentTime + timeOffset);
  });

  gainNode.gain.setValueAtTime(volume, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export const playClick = () => {
  playTone({ freq: 800, duration: 0.05, type: "sine", volume: 0.15 });
};

export const playRoll = () => {
  const ctx = getAudioContext();
  if (!ctx) return;
  // Make a series of quick low random drum-like roll noises
  let time = ctx.currentTime;
  for (let i = 0; i < 6; i++) {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(60 + Math.random() * 80, time);
    
    gainNode.gain.setValueAtTime(0.2, time);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start(time);
    osc.stop(time + 0.08);
    time += 0.08;
  }
};

export const playMove = () => {
  // Move step chirp
  playTone({ freq: 440, duration: 0.1, type: "square", volume: 0.1, slides: [[0.08, 660]] });
};

export const playBuy = () => {
  // Upward major arpeggio
  const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
  const ctx = getAudioContext();
  if (!ctx) return;
  let time = ctx.currentTime;
  notes.forEach((freq) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, time);
    gainNode.gain.setValueAtTime(0.12, time);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.2);
    time += 0.08;
  });
};

export const playRent = () => {
  // Downward slide (sad buzz)
  playTone({ freq: 220, duration: 0.4, type: "sawtooth", volume: 0.15, slides: [[0.35, 110]] });
};

export const playWin = () => {
  // Triumphant retro chiptune fanfare
  const ctx = getAudioContext();
  if (!ctx) return;
  const melody = [
    [523.25, 0.1], // C5
    [659.25, 0.1], // E5
    [783.99, 0.1], // G5
    [1046.50, 0.3] // C6
  ];
  let time = ctx.currentTime;
  melody.forEach(([freq, dur]) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, time);
    gainNode.gain.setValueAtTime(0.1, time);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + dur);
    time += dur;
  });
};

export const playJail = () => {
  // Low metallic clang
  playTone({ freq: 120, duration: 0.5, type: "sawtooth", volume: 0.15, slides: [[0.4, 60]] });
};

