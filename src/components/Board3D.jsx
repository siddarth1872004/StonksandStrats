import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { TILES, GROUP_COLORS, TOKEN_COLORS } from "../boardData";
import { getTileGridCoords } from "../lib/animation";

/* ── Full 3D Monopoly board (low-poly, Krunker-style) ──────────────────────
   • Printed tile faces (group band + name + price) baked to a canvas texture,
     oriented to read outward on every side — like a real board.
   • Real low-poly 3D token models built from primitives (no billboards).
   • Fixed, framed camera by default (same view for every player).
   Engine / sync untouched — this is purely a renderer. */

const U = 1.6;
const GRID_CENTER = 7.5;
const TILE_H = 0.5;

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

// side → how many quarter-turns to rotate the printed text so it reads outward.
function sideRot(id) {
  if (id > 0 && id < 10) return 0;          // bottom → read from south
  if (id > 10 && id < 20) return 1;         // left  → read from west
  if (id > 20 && id < 30) return 2;         // top   → read from north
  if (id > 30 && id < 40) return 3;         // right → read from east
  return 0;                                  // corners
}

/* Draw a tile's printed face onto a canvas → CanvasTexture. Logical layout is
   always "band at inner edge, name, then price toward the outer edge"; we rotate
   the canvas per side so it reads correctly from outside the board. */
function makeTileTexture(tile) {
  const t = tileTransform(tile.id);
  const rot = sideRot(tile.id);
  const swap = rot === 1 || rot === 3;
  // canvas matches tile aspect (post-rotation) so text isn't stretched
  const cw = Math.round((swap ? t.d : t.w) * 80);
  const ch = Math.round((swap ? t.w : t.d) * 80);
  const canvas = document.createElement("canvas");
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext("2d");

  // base
  ctx.fillStyle = "#0d121d";
  ctx.fillRect(0, 0, cw, ch);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = Math.max(2, cw * 0.03);
  ctx.strokeRect(0, 0, cw, ch);

  // logical drawing space (band at top = inner edge)
  ctx.save();
  ctx.translate(cw / 2, ch / 2);
  ctx.rotate((rot * Math.PI) / 2);
  const lw = swap ? ch : cw;
  const lh = swap ? cw : ch;
  ctx.translate(-lw / 2, -lh / 2);

  const band = bandColor(tile);
  const isProp = tile.type === "property";
  const bandH = isProp ? lh * 0.22 : 0;
  if (band && isProp) { ctx.fillStyle = band; ctx.fillRect(0, 0, lw, bandH); }

  ctx.fillStyle = "#eef3ff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const special = SPECIAL_LABEL[tile.type];
  const name = special !== undefined && special !== null ? special
    : special === null ? tile.name.toUpperCase()
    : tile.name.toUpperCase();
  const lines = (name || tile.name.toUpperCase()).split("\n");
  let fs = Math.min(lw * 0.17, lh * 0.16);
  if (special) { fs = Math.min(lw * 0.2, lh * 0.18); ctx.fillStyle = band || "#eef3ff"; }
  ctx.font = `700 ${fs}px "Chakra Petch", system-ui, sans-serif`;
  const nameY = bandH + (lh - bandH) * (tile.price ? 0.4 : 0.5);
  lines.forEach((ln, i) => ctx.fillText(ln, lw / 2, nameY + (i - (lines.length - 1) / 2) * fs * 1.1));

  if (tile.price) {
    ctx.fillStyle = "#7dd3fc";
    ctx.font = `700 ${lw * 0.18}px "Chakra Petch", system-ui, sans-serif`;
    ctx.fillText(`$${tile.price}`, lw / 2, lh * 0.86);
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

function Tile({ tile, texture, ownerColor, houseCount, mortgaged, onClick }) {
  const t = tileTransform(tile.id);
  const bodyColor = mortgaged ? "#3a1414" : ownerColor ? ownerColor : "#10151f";
  return (
    <group position={[t.x, 0, t.z]}>
      {/* body */}
      <mesh onClick={(e) => { e.stopPropagation(); onClick(tile.id); }}>
        <boxGeometry args={[t.w * 0.96, TILE_H, t.d * 0.96]} />
        <meshStandardMaterial color={bodyColor} flatShading metalness={0.15} roughness={0.85} emissive={ownerColor || "#000"} emissiveIntensity={ownerColor ? 0.18 : 0} />
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

  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    g.position.x += (tx - g.position.x) * 0.2;
    g.position.z += (tz - g.position.z) * 0.2;
    const moving = Math.abs(tx - g.position.x) > 0.02 || Math.abs(tz - g.position.z) > 0.02;
    g.position.y = moving ? Math.abs(Math.sin(state.clock.elapsedTime * 12)) * 0.4 : 0;
    if (active) g.rotation.y += 0.012;
  });

  return (
    <group ref={ref} position={[tx, 0, tz]}>
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

/* Fixed, framed camera — same view for everyone, no orbit. */
function FixedCamera() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 21, 17);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  return null;
}

function Scene({ gameState, onTileClick, renderedPositions, textures }) {
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
      <FixedCamera />
      <ambientLight intensity={0.78} />
      <directionalLight position={[14, 26, 12]} intensity={1.1} />
      <directionalLight position={[-12, 10, -14]} intensity={0.4} color="#38bdf8" />

      {/* board frame */}
      <mesh position={[0, -0.35, 0]} onClick={() => onTileClick(null)}>
        <boxGeometry args={[U * 12.4, 0.6, U * 12.4]} />
        <meshStandardMaterial color="#05070d" flatShading metalness={0.25} roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.06, 0]}>
        <boxGeometry args={[U * 8.4, 0.3, U * 8.4]} />
        <meshStandardMaterial color="#0a1120" flatShading emissive="#0a1a33" emissiveIntensity={0.25} />
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
    </>
  );
}

export default function Board3D({ gameState, onTileClick, renderedPositions = {} }) {
  const latest = (gameState?.log || []).slice(-1)[0];
  const currentId = gameState?.order?.[gameState?.current];
  const currentName = gameState?.players?.find((p) => p.id === currentId)?.name;

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
        style={{ width: "100%", height: "100%", background: "radial-gradient(circle at 50% 30%, #0b1020 0%, #03050a 100%)" }}
      >
        <Scene gameState={gameState} onTileClick={onTileClick} renderedPositions={renderedPositions} textures={textures} />
      </Canvas>

      {latest && (
        <div style={{ position: "absolute", top: "12px", left: "50%", transform: "translateX(-50%)", maxWidth: "86%", pointerEvents: "none", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-retro)", fontSize: "clamp(10px,1.4vw,13px)", color: "#FFB300", letterSpacing: "0.22em", fontWeight: "bold", marginBottom: "4px" }}>● LIVE NEWS</div>
          <div key={latest} className="feed-in" style={{
            fontFamily: "var(--font-retro)", fontSize: "clamp(15px,2.2vw,26px)", fontWeight: "bold",
            color: "#e2e8f0", textShadow: "0 0 14px rgba(56,189,248,0.5), 0 2px 6px #000", lineHeight: 1.3,
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>{latest}</div>
        </div>
      )}
      {currentName && (
        <div style={{ position: "absolute", bottom: "10px", left: "50%", transform: "translateX(-50%)", pointerEvents: "none",
          fontFamily: "var(--font-retro)", fontSize: "clamp(11px,1.4vw,15px)", color: "#94a3b8", letterSpacing: "0.1em",
          background: "rgba(0,0,0,0.45)", padding: "4px 12px", borderRadius: "6px", border: "1px solid rgba(255,179,0,0.18)" }}>
          {currentName}'s turn
        </div>
      )}
    </div>
  );
}
