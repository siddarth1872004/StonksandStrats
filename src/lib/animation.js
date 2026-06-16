// animation.js — Full §6.1 diff-based animation system + board grid utilities

// ─── Board grid coordinate mapping ──────────────────────────────────────────

export function getTileGridCoords(index) {
  // Returns { rowStart, rowSpan, colStart, colSpan } for CSS Grid (1-based).
  if (index === 0)  return { rowStart: 12, rowSpan: 2, colStart: 12, colSpan: 2 }; // GO
  if (index < 10)   return { rowStart: 12, rowSpan: 2, colStart: 12 - index, colSpan: 1 }; // bottom
  if (index === 10) return { rowStart: 12, rowSpan: 2, colStart: 1,  colSpan: 2 }; // Jail
  if (index < 20)   return { rowStart: 12 - (index - 10), rowSpan: 1, colStart: 1, colSpan: 2 }; // left
  if (index === 20) return { rowStart: 1,  rowSpan: 2, colStart: 1,  colSpan: 2 }; // Free Parking
  if (index < 30)   return { rowStart: 1,  rowSpan: 2, colStart: index - 20 + 2, colSpan: 1 }; // top
  if (index === 30) return { rowStart: 1,  rowSpan: 2, colStart: 12, colSpan: 2 }; // Go To Jail
  if (index < 40)   return { rowStart: index - 30 + 2, rowSpan: 1, colStart: 12, colSpan: 2 }; // right
  return { rowStart: 1, rowSpan: 1, colStart: 1, colSpan: 1 };
}

// ─── State diff engine ───────────────────────────────────────────────────────

export const ANIM = {
  DICE:        "DICE",
  MOVE_HOP:    "MOVE_HOP",    // small forward delta → sequential tile hops
  MOVE_WARP:   "MOVE_WARP",   // large / backwards jump → fade/scale warp
  MONEY_DELTA: "MONEY_DELTA", // +$X / -$X float near player row
  CARD_DRAW:   "CARD_DRAW",   // card overlay slide-in
  HOUSE_CHANGE:"HOUSE_CHANGE",// house/hotel pop-in or pop-out
  BANKRUPT:    "BANKRUPT",    // token shatter + grayscale
  TURN_CHANGE: "TURN_CHANGE", // glow-sweep on new current player
  AUCTION_UPDATE: "AUCTION_UPDATE",
  WINNER:      "WINNER",
};

function findPlayer(state, pid) {
  return state?.players?.find(p => p.id === pid);
}

export function diffStates(prev, next) {
  if (!prev || !next) return [];
  const events = [];

  // Dice rolled — keyed on roll id so identical consecutive values still animate
  const rolled = next.dice_roll_id !== undefined
    ? next.dice_roll_id !== prev.dice_roll_id
    : (prev.dice[0] !== next.dice[0] || prev.dice[1] !== next.dice[1]);
  if (rolled) {
    events.push({ type: ANIM.DICE, d1: next.dice[0], d2: next.dice[1] });
  }

  // Per-player changes
  for (const np of next.players) {
    const pp = findPlayer(prev, np.id);
    if (!pp) continue;

    // Position change
    if (pp.position !== np.position) {
      const delta = (np.position - pp.position + 40) % 40;
      if (delta <= 12 && !np.bankrupt) {
        events.push({ type: ANIM.MOVE_HOP, pid: np.id, from: pp.position, to: np.position, steps: delta });
      } else {
        events.push({ type: ANIM.MOVE_WARP, pid: np.id, from: pp.position, to: np.position });
      }
    }

    // Money changed
    if (pp.money !== np.money) {
      const delta = np.money - pp.money;
      events.push({ type: ANIM.MONEY_DELTA, pid: np.id, delta });
    }

    // Newly bankrupt
    if (!pp.bankrupt && np.bankrupt) {
      events.push({ type: ANIM.BANKRUPT, pid: np.id });
    }
  }

  // House / hotel changes
  for (const [tidStr, nextH] of Object.entries(next.houses || {})) {
    const prevH = (prev.houses || {})[tidStr];
    if (prevH !== undefined && prevH !== nextH) {
      events.push({ type: ANIM.HOUSE_CHANGE, tile: parseInt(tidStr), from: prevH, to: nextH });
    }
  }

  // Current player changed
  if (prev.current !== next.current || prev.order[prev.current] !== next.order[next.current]) {
    events.push({ type: ANIM.TURN_CHANGE, pid: next.order[next.current] });
  }

  // Card draw — detect from new log entries
  const prevLogLen = prev.log?.length || 0;
  const nextLogLen = next.log?.length || 0;
  for (let i = prevLogLen; i < nextLogLen; i++) {
    const entry = next.log[i] || "";
    if (entry.includes("drew Chance:") || entry.includes("drew Community Chest:")) {
      const textMatch = entry.match(/drew (?:Chance|Community Chest): '(.+)'/);
      const cardText = textMatch ? textMatch[1] : entry;
      const isChance = entry.includes("drew Chance:");
      events.push({ type: ANIM.CARD_DRAW, text: cardText, isChance });
    }
  }

  // Auction started or bid updated
  if (!prev.auction && next.auction) {
    events.push({ type: ANIM.AUCTION_UPDATE, auction: next.auction, fresh: true });
  } else if (prev.auction && next.auction && prev.auction.current_bid !== next.auction.current_bid) {
    events.push({ type: ANIM.AUCTION_UPDATE, auction: next.auction, fresh: false });
  }

  // Winner declared
  if (prev.winner === null && next.winner !== null) {
    events.push({ type: ANIM.WINNER, pid: next.winner });
  }

  return events;
}

// ─── Dice cycling animation ──────────────────────────────────────────────────

// Returns a Promise that resolves after rapidly cycling dice faces.
// Caller supplies a setState setter that accepts [d1, d2].
export function animateDice(finalD1, finalD2, setDiceDisplay, queueInstance) {
  return new Promise(resolve => {
    const FRAME_MS = 80;
    const TOTAL_MS = 500;
    const frames = Math.floor(TOTAL_MS / FRAME_MS);
    let count = 0;

    const tick = setInterval(() => {
      count++;
      if (count >= frames) {
        clearInterval(tick);
        setDiceDisplay([finalD1, finalD2]);
        resolve();
      } else {
        setDiceDisplay([
          Math.ceil(Math.random() * 6),
          Math.ceil(Math.random() * 6),
        ]);
      }
    }, FRAME_MS);

    if (queueInstance) {
      queueInstance.registerInterval(tick, () => {
        setDiceDisplay([finalD1, finalD2]);
        resolve();
      });
    }
  });
}

// ─── Token hop animation ─────────────────────────────────────────────────────

// Animates position one tile at a time.
// setPositions: setter that accepts (pid, tileId)
export function animateHop(pid, from, steps, setPositions, queueInstance) {
  return new Promise(resolve => {
    const HOP_MS = 230;
    let current = from;
    let count = 0;

    const tick = setInterval(() => {
      count++;
      current = (current + 1) % 40;
      setPositions(pid, current);
      if (count >= steps) {
        clearInterval(tick);
        resolve();
      }
    }, HOP_MS);

    if (queueInstance) {
      queueInstance.registerInterval(tick, () => {
        const finalPos = (from + steps) % 40;
        setPositions(pid, finalPos);
        resolve();
      });
    }
  });
}

// ─── Animation queue ─────────────────────────────────────────────────────────

// A simple serial queue. Blocking events (dice, warp, hop) run one at a time.
// Non-blocking events (money delta, card draw, house change) fire immediately.
export class AnimationQueue {
  constructor() {
    this._busy = false;
    this._queue = [];
    this._onBusyChange = null; // callback(busy: boolean)
    this.activeIntervals = [];
    this.activeResolves = [];
  }

  onBusyChange(cb) {
    this._onBusyChange = cb;
  }

  _setBusy(b) {
    this._busy = b;
    if (this._onBusyChange) this._onBusyChange(b);
  }

  enqueue(fn) {
    this._queue.push(fn);
    if (!this._busy) this._drain();
  }

  async _drain() {
    if (this._queue.length === 0) { this._setBusy(false); return; }
    this._setBusy(true);
    const fn = this._queue.shift();
    try { await fn(this); } catch { /* ignore */ }
    this._drain();
  }

  registerInterval(intervalId, resolveFn) {
    this.activeIntervals.push(intervalId);
    this.activeResolves.push(resolveFn);
  }

  skip() {
    // Clear all intervals
    this.activeIntervals.forEach(id => clearInterval(id));
    this.activeIntervals = [];
    // Resolve all pending promises immediately
    this.activeResolves.forEach(resolve => resolve());
    this.activeResolves = [];
    // Clear the queue
    this._queue = [];
    this._setBusy(false);
  }
}

// ─── Confetti canvas ─────────────────────────────────────────────────────────

export class ConfettiCanvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.particles = [];
    this.animationFrame = null;
    this.active = false;
  }

  start() {
    this.active = true;
    this.resize();
    this._resizeBound = this.resize.bind(this);
    window.addEventListener("resize", this._resizeBound);

    const colors = ["#EF4444","#10B981","#3B82F6","#F59E0B","#EC4899","#8B5CF6","#f4d35e","#7ec8e3"];
    this.particles = Array.from({ length: 180 }, () => ({
      x: Math.random() * this.canvas.width,
      y: Math.random() * this.canvas.height - this.canvas.height,
      r: Math.random() * 4 + 2,
      d: Math.random() * this.canvas.height,
      color: colors[Math.random() * colors.length | 0],
      tilt: Math.random() * 10 - 5,
      tiltAngleInc: Math.random() * 0.07 + 0.02,
      tiltAngle: 0,
    }));
    this.loop();
  }

  stop() {
    this.active = false;
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    if (this._resizeBound) window.removeEventListener("resize", this._resizeBound);
  }

  resize() {
    this.canvas.width  = this.canvas.parentElement?.clientWidth  || 400;
    this.canvas.height = this.canvas.parentElement?.clientHeight || 300;
  }

  loop() {
    if (!this.active) return;
    const { ctx, canvas, particles } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach((p, i) => {
      p.tiltAngle += p.tiltAngleInc;
      p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
      p.x += Math.sin(p.tiltAngle);
      p.tilt = Math.sin(p.tiltAngle - i / 3) * 15;

      ctx.beginPath();
      ctx.lineWidth = p.r;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
      ctx.stroke();

      if (p.y > canvas.height) {
        particles[i] = { ...p, x: Math.random() * canvas.width, y: -20, tilt: Math.random() * 10 - 5 };
      }
    });

    this.animationFrame = requestAnimationFrame(this.loop.bind(this));
  }
}
