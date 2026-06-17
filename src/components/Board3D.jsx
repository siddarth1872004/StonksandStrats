import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls as ThreeOrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TILES, GROUP_COLORS, TOKEN_COLORS } from "../boardData";
import { getTileGridCoords, DICE_ROLL_MS, MOVE_DELAY_MS } from "../lib/animation";
import { liveNewsLine } from "../lib/liveNews";
import { LandingCard, CardNotif } from "./NotifCards";

/* ── Full 3D Monopoly board (low-poly, Krunker-style) ──────────────────────
   • Printed tile faces (group band + name + price) baked to a canvas texture,
     oriented to read outward on every side — like a real board.
   • Real low-poly 3D token models built from primitives (no billboards).
   • Fixed, framed camera by default (same view for every player).
   Engine / sync untouched — this is purely a renderer. */

const U = 1.6;
const GRID_CENTER = 7.5;
const TILE_H = 0.5;
const REST_Y = TILE_H / 2;          // tokens rest ON the tile, not buried in it
const DICE_TUMBLE = DICE_ROLL_MS / 1000;                    // how long the dice juggle before settling
const ROLL_VIEW = DICE_TUMBLE + MOVE_DELAY_MS / 1000 + 0.2; // auto-cams frame the roll until the token actually moves

function tileTransform(id) {
  const c = getTileGridCoords(id);
  const colC = c.colStart + c.colSpan / 2;
  const rowC = c.rowStart + c.rowSpan / 2;
  return {
    x: (colC - GRID_CENTER) * U,
    z: (rowC - GRID_CENTER) * U,
    w: c.colSpan * U,
    d: c.rowSpan * U,
  };
}

const tokenColor = (p) => p.token_color || TOKEN_COLORS[p.token_shape || p.token] || "#38bdf8";

const SPECIAL_LABEL = {
  go: "GO", jail: "JAIL", go_to_jail: "GO TO JAIL", free_parking: "FREE\nPARKING",
  chance: "CHANCE", community_chest: "COMMUNITY\nCHEST", tax: null,
};
function bandColor(tile) {
  if (tile.group && GROUP_COLORS[tile.group]) return GROUP_COLORS[tile.group];
  if (tile.type === "railroad") return "#cbd5e1";
  if (tile.type === "utility") return "#94a3b8";
  if (tile.type === "chance") return "#fbbf24";
  if (tile.type === "community_chest") return "#38bdf8";
  if (tile.type === "go") return "#10B981";
  if (tile.type === "go_to_jail") return "#EF4444";
  if (tile.type === "free_parking") return "#38bdf8";
  if (tile.type === "tax") return "#64748b";
  return null;
}

const ICON_TYPES = new Set(["railroad", "utility", "chance", "community_chest", "tax", "go", "jail", "go_to_jail", "free_parking"]);

// Draw a simple vector icon (no emoji) centred at (cx,cy) with half-extent s.
function drawTileIcon(ctx, tile, cx, cy, s) {
  const t = tile.type;
  const ink = "#1f2430";
  ctx.save();
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(2, s * 0.14);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (t === "railroad") {
    ctx.fillRect(cx - s * 0.78, cy - s * 0.2, s * 1.3, s * 0.55);     // body
    ctx.fillRect(cx + s * 0.12, cy - s * 0.62, s * 0.55, s * 0.45);   // cabin
    ctx.fillRect(cx - s * 0.62, cy - s * 0.55, s * 0.16, s * 0.35);   // chimney
    ctx.beginPath();
    ctx.arc(cx - s * 0.38, cy + s * 0.5, s * 0.16, 0, 7);
    ctx.arc(cx + s * 0.34, cy + s * 0.5, s * 0.16, 0, 7);
    ctx.fill();
  } else if (t === "utility" && tile.id === 12) {            // lightning bolt
    ctx.fillStyle = "#eab308";
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.25, cy - s * 0.8);
    ctx.lineTo(cx - s * 0.42, cy + s * 0.12);
    ctx.lineTo(cx - s * 0.02, cy + s * 0.12);
    ctx.lineTo(cx - s * 0.22, cy + s * 0.82);
    ctx.lineTo(cx + s * 0.48, cy - s * 0.18);
    ctx.lineTo(cx + s * 0.08, cy - s * 0.18);
    ctx.closePath();
    ctx.fill();
  } else if (t === "utility") {                              // water droplet
    ctx.fillStyle = "#0ea5e9";
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.82);
    ctx.quadraticCurveTo(cx + s * 0.7, cy + s * 0.22, cx, cy + s * 0.72);
    ctx.quadraticCurveTo(cx - s * 0.7, cy + s * 0.22, cx, cy - s * 0.82);
    ctx.fill();
  } else if (t === "chance") {
    ctx.fillStyle = "#e08a00";
    ctx.font = `900 ${s * 1.9}px "Chakra Petch", system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("?", cx, cy + s * 0.05);
  } else if (t === "community_chest") {
    ctx.fillRect(cx - s * 0.7, cy - s * 0.15, s * 1.4, s * 0.7);      // body
    ctx.beginPath();                                                   // lid
    ctx.moveTo(cx - s * 0.7, cy - s * 0.15);
    ctx.lineTo(cx - s * 0.7, cy - s * 0.32);
    ctx.quadraticCurveTo(cx, cy - s * 0.85, cx + s * 0.7, cy - s * 0.32);
    ctx.lineTo(cx + s * 0.7, cy - s * 0.15);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#e6dcc2"; ctx.fillRect(cx - s * 0.1, cy - s * 0.02, s * 0.2, s * 0.28); // lock
  } else if (t === "tax" && tile.id === 4) {                 // income tax → $
    ctx.font = `900 ${s * 1.7}px "Chakra Petch", system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("$", cx, cy + s * 0.05);
  } else if (t === "tax") {                                  // luxury tax → diamond
    ctx.fillStyle = "#22d3ee";
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.7); ctx.lineTo(cx + s * 0.62, cy - s * 0.1);
    ctx.lineTo(cx, cy + s * 0.72); ctx.lineTo(cx - s * 0.62, cy - s * 0.1);
    ctx.closePath(); ctx.fill();
  } else if (t === "go") {                                   // arrow
    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.62, cy - s * 0.3); ctx.lineTo(cx + s * 0.15, cy - s * 0.3);
    ctx.lineTo(cx + s * 0.15, cy - s * 0.6); ctx.lineTo(cx + s * 0.72, cy);
    ctx.lineTo(cx + s * 0.15, cy + s * 0.6); ctx.lineTo(cx + s * 0.15, cy + s * 0.3);
    ctx.lineTo(cx - s * 0.62, cy + s * 0.3); ctx.closePath(); ctx.fill();
  } else if (t === "jail" || t === "go_to_jail") {           // prison bars
    const col = t === "go_to_jail" ? "#ef4444" : ink;
    ctx.strokeStyle = col;
    ctx.strokeRect(cx - s * 0.6, cy - s * 0.6, s * 1.2, s * 1.2);
    ctx.beginPath();
    for (let i = -1; i <= 1; i++) { ctx.moveTo(cx + i * s * 0.3, cy - s * 0.55); ctx.lineTo(cx + i * s * 0.3, cy + s * 0.55); }
    ctx.stroke();
  } else if (t === "free_parking") {                         // "P"
    ctx.font = `900 ${s * 1.7}px "Chakra Petch", system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("P", cx, cy + s * 0.05);
  }
  ctx.restore();
}

// side → how many quarter-turns to rotate the printed text so it reads outward.
function sideRot(id) {
  if (id > 0 && id < 10) return 0;          // bottom → read from south
  if (id > 10 && id < 20) return 1;         // left  → read from west
  if (id > 20 && id < 30) return 2;         // top   → read from north
  if (id > 30 && id < 40) return 3;         // right → read from east
  return 0;                                  // corners
}

// Wrap text to a max width (honouring explicit \n), return the lines.
function wrapWords(ctx, text, maxW) {
  const out = [];
  text.split("\n").forEach((seg) => {
    const words = seg.split(" ");
    let line = "";
    words.forEach((w) => {
      const test = line ? `${line} ${w}` : w;
      if (line && ctx.measureText(test).width > maxW) { out.push(line); line = w; }
      else line = test;
    });
    if (line) out.push(line);
  });
  return out;
}
// Draw text centred at (cx,cy), shrinking from startSize until it fits the box.
function drawFittedText(ctx, text, cx, cy, maxW, maxH, startSize) {
  for (let size = startSize; size >= 8; size--) {
    ctx.font = `700 ${size}px "Chakra Petch", system-ui, sans-serif`;
    const lines = wrapWords(ctx, text, maxW);
    const lineH = size * 1.14;
    if (lines.length * lineH <= maxH || size === 8) {
      const startY = cy - ((lines.length - 1) * lineH) / 2;
      lines.forEach((ln, i) => ctx.fillText(ln, cx, startY + i * lineH));
      return;
    }
  }
}

/* Draw a tile's printed face onto a canvas → CanvasTexture. Uses a FIXED pixel
   density so text is the same size on every tile (no per-tile goofy scaling),
   and the canvas keeps the tile's real aspect so nothing is stretched. The
   drawing is rotated per side so the name reads outward from the board. */
function makeTileTexture(tile) {
  const t = tileTransform(tile.id);
  const rot = sideRot(tile.id);
  const DENSITY = 120;                 // px per world unit — constant for all tiles
  const cw = Math.max(96, Math.round(t.w * DENSITY));
  const ch = Math.max(96, Math.round(t.d * DENSITY));
  const canvas = document.createElement("canvas");
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#e6dcc2";
  ctx.fillRect(0, 0, cw, ch);
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, cw - 3, ch - 3);

  // rotate the drawing so it reads outward; logical box matches that rotation
  ctx.save();
  ctx.translate(cw / 2, ch / 2);
  ctx.rotate((rot * Math.PI) / 2);
  const even = rot % 2 === 0;
  const lw = even ? cw : ch;   // reading width (left→right)
  const lh = even ? ch : cw;   // inner→outer
  ctx.translate(-lw / 2, -lh / 2);

  const band = bandColor(tile);
  const isProp = tile.type === "property";
  const bandH = isProp ? Math.min(lh * 0.2, 28) : 0;
  if (isProp && band) {
    ctx.fillStyle = band; ctx.fillRect(0, 0, lw, bandH);
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(0, bandH - 2, lw, 2);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Vector icon for stations, utilities, taxes, chance/chest and the corners.
  let top = bandH + 4;
  const bottom = tile.price ? lh - 24 : lh - 4;
  if (ICON_TYPES.has(tile.type)) {
    const isz = Math.min(lw * 0.34, (bottom - top) * 0.34, 26);
    drawTileIcon(ctx, tile, lw / 2, top + isz, isz);
    top += isz * 2 + 3;
  }

  const special = SPECIAL_LABEL[tile.type];
  const raw = special ? special : tile.name.toUpperCase();
  ctx.fillStyle = special ? (band || "#1f2430") : "#1f2430";
  drawFittedText(ctx, raw, lw / 2, (top + bottom) / 2, lw * 0.86, bottom - top, special ? 22 : 17);

  if (tile.price) {
    ctx.fillStyle = "#0f766e";
    ctx.font = `700 15px "Chakra Petch", system-ui, sans-serif`;
    ctx.fillText(`$${tile.price}`, lw / 2, lh - 12);
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/* ── Low-poly 3D token models (primitives) ─────────────────────────────── */
function M({ c, active, metal = 0.35, rough = 0.5 }) {
  return <meshStandardMaterial color={c} flatShading metalness={metal} roughness={rough} emissive={c} emissiveIntensity={active ? 0.4 : 0.12} />;
}
const DARK = "#0b0e16";

function TokenModel({ shape, color, active }) {
  const c = color;
  switch (shape) {
    case "car":
      return (
        <group>
          <mesh position={[0, 0.16, 0]}><boxGeometry args={[0.74, 0.2, 0.36]} /><M c={c} active={active} /></mesh>
          <mesh position={[0.04, 0.34, 0]}><boxGeometry args={[0.38, 0.2, 0.3]} /><M c={c} active={active} /></mesh>
          {[[0.24, 0.18], [-0.24, 0.18], [0.24, -0.18], [-0.24, -0.18]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.08, z]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.1, 0.1, 0.07, 10]} /><M c={DARK} active={false} /></mesh>
          ))}
        </group>
      );
    case "hat":
      return (
        <group>
          <mesh position={[0, 0.05, 0]}><cylinderGeometry args={[0.36, 0.36, 0.07, 18]} /><M c={c} active={active} /></mesh>
          <mesh position={[0, 0.32, 0]}><cylinderGeometry args={[0.22, 0.24, 0.52, 18]} /><M c={c} active={active} /></mesh>
        </group>
      );
    case "ship":
      return (
        <group>
          <mesh position={[0, 0.16, 0]} scale={[1, 1, 0.55]}><cylinderGeometry args={[0.34, 0.18, 0.28, 4]} /><M c={c} active={active} /></mesh>
          <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.025, 0.025, 0.6, 6]} /><M c={c} active={active} /></mesh>
          <mesh position={[0.02, 0.5, 0.14]}><boxGeometry args={[0.02, 0.42, 0.26]} /><M c="#e2e8f0" active={active} /></mesh>
        </group>
      );
    case "dog":
      return (
        <group>
          <mesh position={[0, 0.24, 0]}><boxGeometry args={[0.5, 0.22, 0.22]} /><M c={c} active={active} /></mesh>
          <mesh position={[0.3, 0.34, 0]}><boxGeometry args={[0.2, 0.2, 0.18]} /><M c={c} active={active} /></mesh>
          <mesh position={[0.36, 0.46, 0.07]}><boxGeometry args={[0.06, 0.12, 0.04]} /><M c={c} active={active} /></mesh>
          <mesh position={[0.36, 0.46, -0.07]}><boxGeometry args={[0.06, 0.12, 0.04]} /><M c={c} active={active} /></mesh>
          {[[0.18, 0.1], [-0.18, 0.1], [0.18, -0.1], [-0.18, -0.1]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.08, z]}><boxGeometry args={[0.08, 0.18, 0.08]} /><M c={c} active={active} /></mesh>
          ))}
          <mesh position={[-0.3, 0.34, 0]} rotation={[0, 0, 0.7]}><boxGeometry args={[0.18, 0.05, 0.05]} /><M c={c} active={active} /></mesh>
        </group>
      );
    case "cat":
      return (
        <group>
          <mesh position={[0, 0.22, 0]}><boxGeometry args={[0.42, 0.2, 0.2]} /><M c={c} active={active} /></mesh>
          <mesh position={[0.26, 0.36, 0]}><sphereGeometry args={[0.15, 8, 6]} /><M c={c} active={active} /></mesh>
          <mesh position={[0.3, 0.5, 0.08]}><coneGeometry args={[0.05, 0.12, 4]} /><M c={c} active={active} /></mesh>
          <mesh position={[0.3, 0.5, -0.08]}><coneGeometry args={[0.05, 0.12, 4]} /><M c={c} active={active} /></mesh>
          <mesh position={[-0.26, 0.36, 0]} rotation={[0, 0, 1]}><cylinderGeometry args={[0.03, 0.03, 0.34, 6]} /><M c={c} active={active} /></mesh>
        </group>
      );
    case "ring":
      return (
        <group>
          <mesh position={[0, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.24, 0.07, 8, 20]} /><M c={c} active={active} metal={0.8} rough={0.2} /></mesh>
          <mesh position={[0, 0.5, 0]}><octahedronGeometry args={[0.12, 0]} /><M c="#bae6fd" active={active} metal={0.6} rough={0.1} /></mesh>
        </group>
      );
    case "iron":
      return (
        <group>
          <mesh position={[0, 0.12, 0]} scale={[1, 1, 0.7]}><cylinderGeometry args={[0.36, 0.36, 0.18, 3]} /><M c={c} active={active} /></mesh>
          <mesh position={[0, 0.34, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.16, 0.04, 6, 12, Math.PI]} /><M c={c} active={active} /></mesh>
        </group>
      );
    case "shoe":
      return (
        <group>
          <mesh position={[0.05, 0.1, 0]}><boxGeometry args={[0.5, 0.2, 0.26]} /><M c={c} active={active} /></mesh>
          <mesh position={[-0.16, 0.32, 0]}><boxGeometry args={[0.2, 0.34, 0.24]} /><M c={c} active={active} /></mesh>
        </group>
      );
    case "wheelbarrow":
      return (
        <group>
          <mesh position={[0, 0.26, 0]} rotation={[0.2, 0, 0]}><boxGeometry args={[0.4, 0.24, 0.32]} /><M c={c} active={active} /></mesh>
          <mesh position={[0.3, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.13, 0.13, 0.08, 12]} /><M c={DARK} active={false} /></mesh>
          <mesh position={[-0.2, 0.1, 0.14]} rotation={[0, 0, -0.5]}><cylinderGeometry args={[0.02, 0.02, 0.4, 6]} /><M c={c} active={active} /></mesh>
          <mesh position={[-0.2, 0.1, -0.14]} rotation={[0, 0, -0.5]}><cylinderGeometry args={[0.02, 0.02, 0.4, 6]} /><M c={c} active={active} /></mesh>
        </group>
      );
    default: // thimble-ish fallback
      return (
        <group>
          <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.22, 0.28, 0.5, 12]} /><M c={c} active={active} /></mesh>
        </group>
      );
  }
}

/* ── 3D dice ───────────────────────────────────────────────────────────── */
// Pip layouts on a 3×3 grid (cols/rows at 0.25/0.5/0.75).
const PIPS = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  6: [[0.28, 0.26], [0.72, 0.26], [0.28, 0.5], [0.72, 0.5], [0.28, 0.74], [0.72, 0.74]],
};
let DIE_TEX = null;
function dieTextures() {
  if (DIE_TEX) return DIE_TEX;
  DIE_TEX = {};
  for (let v = 1; v <= 6; v++) {
    const s = 128;
    const c = document.createElement("canvas"); c.width = s; c.height = s;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#f4f3ee"; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = "rgba(0,0,0,0.18)"; ctx.lineWidth = 6; ctx.strokeRect(3, 3, s - 6, s - 6);
    ctx.fillStyle = "#15151a";
    PIPS[v].forEach(([px, py]) => { ctx.beginPath(); ctx.arc(px * s, py * s, s * 0.085, 0, Math.PI * 2); ctx.fill(); });
    const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4; DIE_TEX[v] = tex;
  }
  return DIE_TEX;
}
// Euler that puts a given value on the top (+y) face.
const FACE_EULER = {
  1: [0, 0, 0], 6: [Math.PI, 0, 0],
  2: [0, 0, -Math.PI / 2], 5: [0, 0, Math.PI / 2],
  3: [-Math.PI / 2, 0, 0], 4: [Math.PI / 2, 0, 0],
};
const DIE_BASE_Y = 2.3;

function Die({ value, x, rollId }) {
  const ref = useRef();
  const tex = dieTextures();
  // face material order [+x,-x,+y,-y,+z,-z] → values [2,5,1,6,3,4] (opposites = 7)
  const mats = useMemo(() => [2, 5, 1, 6, 3, 4].map((v) =>
    new THREE.MeshStandardMaterial({ map: tex[v], flatShading: true, metalness: 0.1, roughness: 0.55 })
  ), [tex]);

  const startRef = useRef(-999);
  const spinRef = useRef([0, 0, 0]);
  const targetRef = useRef(new THREE.Quaternion());

  useEffect(() => {
    startRef.current = -1; // capture start on next frame
    spinRef.current = [8 + Math.random() * 8, 8 + Math.random() * 8, 8 + Math.random() * 8].map((s) => s * (Math.random() < 0.5 ? -1 : 1));
    const e = FACE_EULER[value] || [0, 0, 0];
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0], e[1], e[2]));
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 0.5);
    targetRef.current = yaw.multiply(q);
  }, [rollId, value]);

  const TUMBLE = DICE_TUMBLE;
  useFrame((state, delta) => {
    const m = ref.current;
    if (!m) return;
    if (startRef.current === -1) startRef.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - startRef.current;
    if (t < TUMBLE) {
      m.rotation.x += spinRef.current[0] * delta;
      m.rotation.y += spinRef.current[1] * delta;
      m.rotation.z += spinRef.current[2] * delta;
      m.position.y = DIE_BASE_Y + Math.abs(Math.sin(t * 9)) * (1 - t / TUMBLE) * 1.6;
    } else {
      m.quaternion.slerp(targetRef.current, 0.18);
      m.position.y += (DIE_BASE_Y - m.position.y) * 0.18;
    }
  });

  return (
    <mesh ref={ref} position={[x, DIE_BASE_Y, 0]} material={mats}>
      <boxGeometry args={[0.95, 0.95, 0.95]} />
    </mesh>
  );
}

function Dice({ dice, rollId }) {
  if (!dice || dice.length < 2) return null;
  return (
    <group>
      <Die value={dice[0]} x={-0.65} rollId={rollId} />
      <Die value={dice[1]} x={0.65} rollId={rollId} />
    </group>
  );
}

function Tile({ tile, texture, ownerColor, houseCount, mortgaged, onClick }) {
  const t = tileTransform(tile.id);
  const bodyColor = mortgaged ? "#d9a3a3" : ownerColor ? ownerColor : "#ddd0b2";
  return (
    <group position={[t.x, 0, t.z]}>
      {/* body */}
      <mesh onClick={(e) => { e.stopPropagation(); onClick(tile.id); }}>
        <boxGeometry args={[t.w * 0.96, TILE_H, t.d * 0.96]} />
        <meshStandardMaterial color={bodyColor} flatShading metalness={0.05} roughness={0.9} emissive={ownerColor || "#000"} emissiveIntensity={ownerColor ? 0.12 : 0} />
      </mesh>
      {/* printed face */}
      <mesh position={[0, TILE_H / 2 + 0.011, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[t.w * 0.96, t.d * 0.96]} />
        <meshBasicMaterial map={texture} transparent toneMapped={false} />
      </mesh>

      {/* houses / hotel */}
      {houseCount > 0 && !mortgaged && Array.from({ length: Math.min(houseCount, 5) }).map((_, i) => (
        <mesh key={i} position={[(i - (Math.min(houseCount, 5) - 1) / 2) * 0.3, TILE_H / 2 + 0.2, -t.d * 0.3]}>
          <boxGeometry args={houseCount === 5 ? [0.5, 0.4, 0.3] : [0.2, 0.32, 0.2]} />
          <meshStandardMaterial color={houseCount === 5 ? "#EF4444" : "#22c55e"} flatShading emissive={houseCount === 5 ? "#EF4444" : "#22c55e"} emissiveIntensity={0.3} />
        </mesh>
      ))}

      {/* mortgage flag */}
      {mortgaged && (
        <group position={[0, TILE_H / 2, t.d * 0.28]}>
          <mesh position={[0, 0.32, 0]}><cylinderGeometry args={[0.03, 0.03, 0.64, 5]} /><meshStandardMaterial color="#7f1d1d" flatShading /></mesh>
          <mesh position={[0.16, 0.5, 0]}><boxGeometry args={[0.3, 0.18, 0.02]} /><meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.5} flatShading /></mesh>
        </group>
      )}
    </group>
  );
}

function Pawn({ player, targetId, offset, active }) {
  const ref = useRef();
  const t = tileTransform(targetId);
  const tx = t.x + offset[0];
  const tz = t.z + offset[1];
  const col = tokenColor(player);

  useFrame((state, delta) => {
    const g = ref.current;
    if (!g) return;
    // Constant-speed glide toward the current tile (renderedPositions steps one
    // tile at a time), so the piece walks the track smoothly instead of easing
    // in/out at every tile. Speed ≈ tile spacing / hop cadence.
    const dx = tx - g.position.x;
    const dz = tz - g.position.z;
    const dist = Math.hypot(dx, dz);
    const SPEED = 7.6;
    if (dist > 0.0006) {
      const step = Math.min(dist, SPEED * delta);
      g.position.x += (dx / dist) * step;
      g.position.z += (dz / dist) * step;
    }
    const moving = dist > 0.04;
    // Sit on the tile surface (REST_Y) so the piece never sinks into the board.
    g.position.y = moving
      ? REST_Y + Math.abs(Math.sin(state.clock.elapsedTime * 13)) * 0.32   // one hop arc per tile
      : active ? REST_Y + Math.sin(state.clock.elapsedTime * 2.5) * 0.06 + 0.04 : REST_Y;
    if (active && !moving) g.rotation.y += 0.01;
  });

  return (
    <group ref={ref} position={[tx, REST_Y, tz]}>
      {/* base disc */}
      <mesh position={[0, 0.04, 0]}><cylinderGeometry args={[0.34, 0.4, 0.08, 16]} /><meshStandardMaterial color={col} flatShading emissive={col} emissiveIntensity={active ? 0.6 : 0.2} metalness={0.4} roughness={0.4} /></mesh>
      {active && (
        <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.5, 0.04, 8, 24]} /><meshBasicMaterial color={col} /></mesh>
      )}
      <group position={[0, 0.08, 0]}>
        <TokenModel shape={player.token_shape || player.token} color={col} active={active} />
      </group>
    </group>
  );
}

/* Orbit camera with selectable modes. The two "auto" modes (follow / adaptive)
   first frame the dice in the centre while they tumble, then glide to track the
   relevant token once the roll has been shown. `top` and `cinematic` are scripted
   views (no user rotation). The board can never be seen from underneath. */
function Controls({ mode, followRef, currentRef, rollId }) {
  const { camera, gl } = useThree();
  const ref = useRef();
  const rollAt = useRef(-999);
  const cine = useRef(Math.PI * 0.25);
  useEffect(() => {
    const c = new ThreeOrbitControls(camera, gl.domElement);
    c.enablePan = false;
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.minDistance = 9;
    c.maxDistance = 52;
    c.maxPolarAngle = Math.PI / 2.6;   // stay well above the horizon — never see under the board
    c.minPolarAngle = Math.PI / 10;
    c.target.set(0, 0, 0);
    ref.current = c;
    return () => c.dispose();
  }, [camera, gl]);
  useEffect(() => { rollAt.current = performance.now(); }, [rollId]);

  useFrame((_, delta) => {
    const c = ref.current;
    if (!c) return;
    const tgt = c.target;
    const auto = mode === "follow" || mode === "adaptive";
    const watchRoll = auto && (performance.now() - rollAt.current) / 1000 < ROLL_VIEW;

    const easeTarget = (x, y, z, k = 0.1) => {
      tgt.x += (x - tgt.x) * k; tgt.y += (y - tgt.y) * k; tgt.z += (z - tgt.z) * k;
    };
    const easeDist = (d, k = 0.06) => {
      const off = camera.position.clone().sub(tgt);
      off.setLength(off.length() + (d - off.length()) * k);
      camera.position.copy(tgt).add(off);
    };

    c.enableRotate = mode === "free" || auto;

    if (mode === "top") {
      easeTarget(0, 0, 0, 0.1);
      camera.position.x += (0 - camera.position.x) * 0.08;
      camera.position.z += (0.01 - camera.position.z) * 0.08;
      camera.position.y += (34 - camera.position.y) * 0.08;
    } else if (mode === "cinematic") {
      cine.current += delta * 0.12;
      easeTarget(0, 0, 0, 0.1);
      camera.position.x += (Math.cos(cine.current) * 26 - camera.position.x) * 0.05;
      camera.position.z += (Math.sin(cine.current) * 26 - camera.position.z) * 0.05;
      camera.position.y += (18 - camera.position.y) * 0.05;
    } else if (watchRoll) {
      // Centre on the dice and frame them while they juggle.
      easeTarget(0, 1.2, 0, 0.12);
      easeDist(20, 0.07);
    } else if (mode === "adaptive" && currentRef.current) {
      easeTarget(currentRef.current.x, 0, currentRef.current.z, 0.1);
      easeDist(17, 0.06);
    } else if (mode === "follow" && followRef.current) {
      const dx = (followRef.current.x - tgt.x) * 0.12;
      const dz = (followRef.current.z - tgt.z) * 0.12;
      tgt.x += dx; tgt.z += dz; tgt.y += (0 - tgt.y) * 0.12;
      camera.position.x += dx; camera.position.z += dz; // pan camera with target → keep angle
    } else {
      easeTarget(0, 0, 0, 0.08); // free
    }
    c.update();
  });
  return null;
}

function Scene({ gameState, onTileClick, renderedPositions, textures, camMode, followRef, currentRef }) {
  const currentId = gameState?.order?.[gameState?.current];
  const allPlayers = gameState?.players;
  const players = allPlayers || [];

  const pawnLayout = useMemo(() => {
    const byTile = {};
    (allPlayers || []).forEach((p) => {
      if (p.bankrupt) return;
      const pos = renderedPositions[p.id] !== undefined ? renderedPositions[p.id] : p.position;
      (byTile[pos] ||= []).push(p);
    });
    const out = [];
    Object.entries(byTile).forEach(([, group]) => {
      group.forEach((p, i) => {
        const n = group.length;
        const ang = (i / n) * Math.PI * 2;
        const r = n > 1 ? 0.5 : 0;
        out.push({ player: p, offset: [Math.cos(ang) * r, Math.sin(ang) * r] });
      });
    });
    return out;
  }, [allPlayers, renderedPositions]);

  return (
    <>
      <Controls mode={camMode} followRef={followRef} currentRef={currentRef} rollId={gameState?.dice_roll_id ?? 0} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[14, 26, 12]} intensity={1.05} />
      <directionalLight position={[-12, 10, -14]} intensity={0.35} color="#ffffff" />

      {/* espresso-wood frame + green felt playfield (classic tabletop look) */}
      <mesh position={[0, -0.35, 0]} onClick={() => onTileClick(null)}>
        <boxGeometry args={[U * 12.4, 0.6, U * 12.4]} />
        <meshStandardMaterial color="#2a241d" flatShading metalness={0.15} roughness={0.85} />
      </mesh>
      <mesh position={[0, -0.06, 0]}>
        <boxGeometry args={[U * 8.4, 0.3, U * 8.4]} />
        <meshStandardMaterial color="#173d2c" flatShading roughness={0.95} />
      </mesh>


      {TILES.map((tile) => {
        const ownerId = gameState?.owner?.[tile.id.toString()];
        const ownerObj = ownerId !== undefined ? players.find((p) => p.id === ownerId) : null;
        return (
          <Tile
            key={tile.id}
            tile={tile}
            texture={textures[tile.id]}
            ownerColor={ownerObj ? tokenColor(ownerObj) : null}
            houseCount={gameState?.houses?.[tile.id.toString()] || 0}
            mortgaged={gameState?.mortgaged?.includes(tile.id)}
            onClick={onTileClick}
          />
        );
      })}

      {pawnLayout.map(({ player, offset }) => {
        const pos = renderedPositions[player.id] !== undefined ? renderedPositions[player.id] : player.position;
        return <Pawn key={player.id} player={player} targetId={pos} offset={offset} active={player.id === currentId && gameState?.winner === null} />;
      })}

      {gameState?.phase !== "lobby" && gameState?.phase !== "game_over" && (
        <Dice dice={gameState?.dice} rollId={gameState?.dice_roll_id ?? 0} />
      )}
    </>
  );
}

/* DOM die face (HUD) — reuses the PIPS layout so the result is always readable. */
function DiceFace({ v, size = 34 }) {
  return (
    <div style={{ position: "relative", width: size, height: size, background: "#f4f3ee", borderRadius: "7px", border: "1px solid rgba(0,0,0,0.35)", boxShadow: "0 2px 6px rgba(0,0,0,0.5)" }}>
      {(PIPS[v] || []).map(([px, py], i) => (
        <span key={i} style={{ position: "absolute", left: `${px * 100}%`, top: `${py * 100}%`, transform: "translate(-50%,-50%)", width: size * 0.17, height: size * 0.17, borderRadius: "50%", background: "#15151a" }} />
      ))}
    </div>
  );
}

export default function Board3D({ gameState, myPlayerId, onTileClick, renderedPositions = {}, animationsBusy = false, landing = null, card = null }) {
  const news = liveNewsLine(gameState, animationsBusy);
  const currentId = gameState?.order?.[gameState?.current];
  const currentName = gameState?.players?.find((p) => p.id === currentId)?.name;
  // Camera mode + a dropdown to pick it.
  const [camModeRaw, setCamMode] = useState("free"); // free | follow | adaptive | top | cinematic
  const [camMenu, setCamMenu] = useState(false);
  const me = gameState?.players?.find((p) => p.id === myPlayerId);
  // "Lock on me" only works if I'm a player; otherwise fall back to free orbit.
  const camMode = camModeRaw === "follow" && !me ? "free" : camModeRaw;

  // Show the landing detail card to the player who just landed (until they move on).
  const landTile = landing && landing.pid === myPlayerId ? TILES.find((t) => t.id === landing.tileId) : null;

  // Live world position of the local player's token (follow cam).
  const followRef = useRef({ x: 0, z: 0 });
  if (me) {
    const pos = renderedPositions[myPlayerId] !== undefined ? renderedPositions[myPlayerId] : me.position;
    const tt = tileTransform(pos);
    followRef.current = { x: tt.x, z: tt.z };
  }

  // Live world position of the CURRENT-turn player's token (adaptive cam).
  const currentRef = useRef({ x: 0, z: 0 });
  const curP = gameState?.players?.find((p) => p.id === currentId);
  if (curP) {
    const pos = renderedPositions[curP.id] !== undefined ? renderedPositions[curP.id] : curP.position;
    const tt = tileTransform(pos);
    currentRef.current = { x: tt.x, z: tt.z };
  }

  // Build the printed tile faces once; dispose on unmount.
  const textures = useMemo(() => {
    const map = {};
    TILES.forEach((t) => { map[t.id] = makeTileTexture(t); });
    return map;
  }, []);
  useEffect(() => () => { Object.values(textures).forEach((t) => t.dispose()); }, [textures]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 21, 17], fov: 46 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        style={{ width: "100%", height: "100%", background: "radial-gradient(circle at 50% 30%, #262229 0%, #0e0c10 60%, #050407 100%)" }}
      >
        <Scene gameState={gameState} onTileClick={onTileClick} renderedPositions={renderedPositions} textures={textures} camMode={camMode} followRef={followRef} currentRef={currentRef} />
      </Canvas>

      {/* Camera settings — icon button + dropdown */}
      <div style={{ position: "absolute", top: "12px", left: "12px", zIndex: 6 }}>
        <button
          onClick={() => setCamMenu((o) => !o)}
          title="Camera settings"
          style={{
            cursor: "pointer", display: "flex", alignItems: "center", gap: "5px",
            padding: "7px 9px", borderRadius: "8px", border: "1px solid",
            background: camMode !== "free" ? "rgba(56,189,248,0.16)" : "rgba(0,0,0,0.55)",
            borderColor: camMode !== "free" ? "#38bdf8" : "rgba(148,163,184,0.4)",
            color: camMode !== "free" ? "#38bdf8" : "#cbd5e1",
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8h3l2-2.5h8L18 8h3v11H3z" /><circle cx="12" cy="13" r="3.4" />
          </svg>
          <span style={{ fontFamily: "var(--font-retro)", fontSize: "11px", fontWeight: "bold" }}>▾</span>
        </button>
        {camMenu && (
          <div style={{ marginTop: "6px", minWidth: "180px", background: "rgba(8,10,16,0.96)", border: "1px solid rgba(148,163,184,0.3)", borderRadius: "8px", overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
            {[
              { id: "free", label: "Free orbit", desc: "Drag / zoom freely" },
              ...(me ? [{ id: "follow", label: "Lock on me", desc: "Follow your token" }] : []),
              { id: "adaptive", label: "Adaptive", desc: "Watch the roll, then the active player" },
              { id: "top", label: "Top-down", desc: "Overhead board view" },
              { id: "cinematic", label: "Cinematic", desc: "Slow auto-orbit" },
            ].map((o) => (
              <button
                key={o.id}
                onClick={() => { setCamMode(o.id); setCamMenu(false); }}
                style={{
                  display: "block", width: "100%", textAlign: "left", cursor: "pointer", border: "none",
                  padding: "9px 12px", background: camMode === o.id ? "rgba(56,189,248,0.15)" : "transparent",
                  borderLeft: `3px solid ${camMode === o.id ? "#38bdf8" : "transparent"}`,
                  color: camMode === o.id ? "#38bdf8" : "#e2e8f0", fontFamily: "var(--font-retro)",
                }}
              >
                <div style={{ fontSize: "13px", fontWeight: "bold" }}>{o.label}</div>
                <div style={{ fontSize: "11px", color: "#64748b" }}>{o.desc}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* LIVE NEWS — rich one-liner, top-pinned banner (tan board card) */}
      {news && (
        <div style={{ position: "absolute", top: "16px", left: "50%", transform: "translateX(-50%)", maxWidth: "70%", pointerEvents: "none", textAlign: "center",
          background: "#e6dcc2", padding: "10px 22px", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.25)", boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}>
          <div style={{ fontFamily: "var(--font-retro)", fontSize: "clamp(10px,1.4vw,13px)", color: "#b45309", letterSpacing: "0.22em", fontWeight: "bold", marginBottom: "4px" }}>● LIVE NEWS</div>
          <div key={news} className="feed-in" style={{
            fontFamily: "var(--font-retro)", fontSize: "clamp(15px,2.2vw,26px)", fontWeight: "bold",
            color: "#1f2430", lineHeight: 1.25,
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>{news}</div>
        </div>
      )}

      {/* Dice readout (the 3D dice can be off-screen when the camera follows a
          player). Held back until the roll settles so the corner HUD doesn't
          reveal the result while the 3D dice are still tumbling. */}
      {gameState?.dice && !animationsBusy && gameState?.phase !== "lobby" && gameState?.phase !== "game_over" && (
        <div style={{ position: "absolute", bottom: "12px", right: "12px", display: "flex", alignItems: "center", gap: "7px", pointerEvents: "none" }}>
          <DiceFace v={gameState.dice[0]} />
          <DiceFace v={gameState.dice[1]} />
          {gameState.speed_die && (
            <div style={{ width: "34px", height: "34px", borderRadius: "7px", display: "flex", alignItems: "center", justifyContent: "center",
              background: gameState.speed_die.type === "mr_monopoly" ? "#f59e0b" : gameState.speed_die.type === "bus" ? "#8b5cf6" : "#38bdf8",
              color: "#0a0a0a", fontFamily: "var(--font-retro)", fontWeight: "bold", fontSize: gameState.speed_die.type === "move" ? "18px" : "9px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.5)" }}>
              {gameState.speed_die.type === "move" ? gameState.speed_die.face : gameState.speed_die.type === "bus" ? "BUS" : "MR.M"}
            </div>
          )}
          <div style={{ fontFamily: "var(--font-retro)", fontWeight: "bold", fontSize: "16px", color: "#FFB300", marginLeft: "3px", textShadow: "0 2px 4px #000" }}>
            ={gameState.dice[0] + gameState.dice[1]}
          </div>
        </div>
      )}

      {/* Bottom-left notification slot: a drawn Chance/Chest card takes priority,
          otherwise the tan landing-detail card for the player who landed. */}
      {card ? <CardNotif card={card} /> : landTile && <LandingCard tile={landTile} gameState={gameState} />}

      {currentName && (
        <div style={{ position: "absolute", bottom: "10px", left: "50%", transform: "translateX(-50%)", pointerEvents: "none",
          fontFamily: "var(--font-retro)", fontSize: "clamp(11px,1.4vw,15px)", color: "#5c5232", letterSpacing: "0.1em",
          background: "#e6dcc2", padding: "4px 12px", borderRadius: "6px", border: "1px solid rgba(0,0,0,0.2)" }}>
          {currentName}'s turn · drag to orbit · scroll to zoom
        </div>
      )}
    </div>
  );
}
