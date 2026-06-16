// audio.js - Dynamic Web Audio API synthesizer for retro chiptune effects

let audioCtx = null;
let isMuted = false;
let chiptuneInterval = null;

function getAudioContext() {
  if (isMuted) return null;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

export const setMuted = (muted) => {
  isMuted = muted;
  if (muted && chiptuneInterval) {
    stopChiptune();
  }
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

// ── Mechanical keyboard keystroke ("thock" + tactile click) ───────────────────
let lastKeyTime = 0;
let noiseBuffer = null;
function getNoiseBuffer(ctx) {
  if (noiseBuffer) return noiseBuffer;
  const len = Math.floor(ctx.sampleRate * 0.05);
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

// Satisfying ASMR mechanical-key sound. Throttled so a global click/keydown
// listener and an explicit playClick in the same event collapse to one hit.
export const playKey = () => {
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  if (t - lastKeyTime < 0.03) return;
  lastKeyTime = t;

  // 1) Tactile click — short bandpassed noise snap
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2100 + Math.random() * 700;
  bp.Q.value = 0.9;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.16, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.028);
  src.connect(bp); bp.connect(ng); ng.connect(ctx.destination);
  src.start(t); src.stop(t + 0.05);

  // 2) Low "thock" body — quick sine thump for the deep keyboard feel
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(175 + Math.random() * 45, t);
  osc.frequency.exponentialRampToValueAtTime(95, t + 0.04);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.linearRampToValueAtTime(0.15, t + 0.004);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  osc.connect(og); og.connect(ctx.destination);
  osc.start(t); osc.stop(t + 0.06);
};

export const playClick = () => playKey();

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

export const playAuction = () => {
  // Medium pitch alert ping
  playTone({ freq: 587.33, duration: 0.15, type: "sine", volume: 0.12 });
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

// Start a subtle background chiptune melody loop
export const startChiptune = () => {
  if (chiptuneInterval) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  // Simple bassline progression
  const scale = [130.81, 146.83, 164.81, 196.00]; // C3, D3, E3, G3
  let idx = 0;
  
  chiptuneInterval = setInterval(() => {
    if (isMuted) return;
    const baseFreq = scale[idx % scale.length];
    
    // Play dual oscillator harmony
    playTone({ freq: baseFreq, duration: 0.4, type: "triangle", volume: 0.03 });
    if (idx % 2 === 0) {
      playTone({ freq: baseFreq * 2, duration: 0.2, type: "sine", volume: 0.015 });
    }
    
    idx++;
  }, 800);
};

export const stopChiptune = () => {
  if (chiptuneInterval) {
    clearInterval(chiptuneInterval);
    chiptuneInterval = null;
  }
};
