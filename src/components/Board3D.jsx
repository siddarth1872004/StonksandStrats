import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Text } from "@react-three/drei";
import { TILES, GROUP_COLORS, TOKEN_COLORS } from "../boardData";
import { getTileGridCoords } from "../lib/animation";
import { TokenIcon } from "../lib/icons";

/* ── Krunker-style low-poly 3D Monopoly board ──────────────────────────────
   Flat-shaded, no shadow maps — built for speed. Reuses the 13×13 grid math
   from the 2D board so tile positions stay identical. Tokens are the REAL 2D
   token icons rendered as camera-facing 3D billboards on a low-poly base, so
   "the 2D object is the 3D object". Engine / sync untouched. */

const U = 1.5;
const GRID_CENTER = 7.5;
const TILE_H = 0.5;

function tileTransform(id) {
  const c = getTileGridCoords(id);
  const colC = c.colStart + c.colSpan / 2;
  const rowC = c.rowStart + c.rowSpan / 2;
  return {
    x: (colC - GRID_CENTER) * U,
    z: (rowC - GRID_CENTER) * U,
    w: c.colSpan * U * 0.92,
    d: c.rowSpan * U * 0.92,
  };
}

const SPECIAL_COLOR = {
  go: "#10B981", jail: "#F59E0B", go_to_jail: "#EF4444",
  free_parking: "#38bdf8", tax: "#64748b", chance: "#fbbf24", community_chest: "#38bdf8",
};

const tokenColor = (p) => p.token_color || TOKEN_COLORS[p.token_shape || p.token] || "#38bdf8";

// Short label + the flat in-plane rotation so each side reads outward.
function tileLabel(tile) {
  if (tile.type === "go") return "GO";
  if (tile.type === "go_to_jail") return "GO TO JAIL";
  if (tile.type === "jail") return "JAIL";
  if (tile.type === "free_parking") return "FREE PARKING";
  if (tile.type === "chance") return "CHANCE";
  if (tile.type === "community_chest") return "CHEST";
  return tile.name.replace(" Station", " Stn").replace(" Street", " St").replace(" Avenue", " Ave");
}
function sideAngle(id) {
  if (id > 0 && id < 10) return 0;          // bottom
  if (id > 10 && id < 20) return Math.PI / 2;   // left
  if (id > 20 && id < 30) return Math.PI;       // top
  if (id > 30 && id < 40) return -Math.PI / 2;  // right
  return 0;                                  // corners
}

function Tile({ tile, ownerColor, houseCount, mortgaged, onClick }) {
  const t = tileTransform(tile.id);
  const band = tile.group && GROUP_COLORS[tile.group]
    ? GROUP_COLORS[tile.group]
    : tile.type === "railroad" ? "#cbd5e1"
    : tile.type === "utility" ? "#94a3b8" : null;
  const base = mortgaged ? "#3b1111" : ownerColor ? ownerColor : (SPECIAL_COLOR[tile.type] ? "#0b0f1a" : "#141a26");

  return (
    <group position={[t.x, 0, t.z]}>
      <mesh onClick={(e) => { e.stopPropagation(); onClick(tile.id); }}>
        <boxGeometry args={[t.w, TILE_H, t.d]} />
        <meshStandardMaterial color={base} flatShading metalness={0.1} roughness={0.85} />
      </mesh>
      {band && (
        <mesh position={[0, TILE_H / 2 + 0.03, 0]}>
          <boxGeometry args={[t.w, 0.07, t.d]} />
          <meshBasicMaterial color={band} />
        </mesh>
      )}
      {SPECIAL_COLOR[tile.type] && !ownerColor && (
        <mesh position={[0, TILE_H / 2 + 0.04, 0]}>
          <boxGeometry args={[t.w * 0.5, 0.05, t.d * 0.5]} />
          <meshBasicMaterial color={SPECIAL_COLOR[tile.type]} />
        </mesh>
      )}

      {/* Tile name, lying flat on the surface, reading outward per side */}
      <Text
        position={[0, TILE_H / 2 + 0.06, 0]}
        rotation={[-Math.PI / 2, 0, sideAngle(tile.id)]}
        fontSize={0.26}
        maxWidth={t.w * 0.92}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
        color={mortgaged ? "#f87171" : "#e8eefc"}
        outlineWidth={0.012}
        outlineColor="#000000"
      >
        {tileLabel(tile)}
      </Text>

      {/* Houses (green blocks) / hotel (red block) standing on the tile */}
      {houseCount > 0 && !mortgaged && Array.from({ length: Math.min(houseCount, 5) }).map((_, i) => (
        <mesh key={i} position={[(i - (Math.min(houseCount, 5) - 1) / 2) * 0.32, TILE_H / 2 + 0.22, t.d * 0.3]}>
          <boxGeometry args={houseCount === 5 ? [0.5, 0.42, 0.34] : [0.22, 0.34, 0.22]} />
          <meshStandardMaterial color={houseCount === 5 ? "#EF4444" : "#10B981"} flatShading emissive={houseCount === 5 ? "#EF4444" : "#10B981"} emissiveIntensity={0.25} />
        </mesh>
      ))}

      {/* Mortgage marker — a red flag standing on the tile */}
      {mortgaged && (
        <group position={[0, TILE_H / 2, -t.d * 0.25]}>
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.7, 5]} />
            <meshStandardMaterial color="#7f1d1d" flatShading />
          </mesh>
          <mesh position={[0.16, 0.55, 0]}>
            <boxGeometry args={[0.3, 0.2, 0.02]} />
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.4} flatShading />
          </mesh>
        </group>
      )}
    </group>
  );
}

/* A pawn: a low-poly colour base that lerps/bobs between tiles, topped with the
   real 2D TokenIcon as a camera-facing billboard. */
function Pawn({ player, targetId, offset, active }) {
  const ref = useRef();
  const t = tileTransform(targetId);
  const tx = t.x + offset[0];
  const tz = t.z + offset[1];

  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    g.position.x += (tx - g.position.x) * 0.2;
    g.position.z += (tz - g.position.z) * 0.2;
    const moving = Math.abs(tx - g.position.x) > 0.02 || Math.abs(tz - g.position.z) > 0.02;
    g.position.y = moving ? Math.abs(Math.sin(state.clock.elapsedTime * 12)) * 0.4
      : active ? Math.sin(state.clock.elapsedTime * 2.5) * 0.1 + 0.04 : 0;
  });

  const col = tokenColor(player);
  return (
    <group ref={ref} position={[tx, 0, tz]}>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.3, 0.42, 0.4, 8]} />
        <meshStandardMaterial color={col} flatShading emissive={col} emissiveIntensity={active ? 0.55 : 0.18} metalness={0.3} roughness={0.5} />
      </mesh>
      <Html position={[0, 1.05, 0]} center transform sprite distanceFactor={7} style={{ pointerEvents: "none" }}>
        <div style={{ width: 38, height: 38, filter: active ? `drop-shadow(0 0 8px ${col})` : `drop-shadow(0 1px 2px #000)` }}>
          <TokenIcon name={player.token_shape || player.token} color={col} size="100%" />
        </div>
      </Html>
    </group>
  );
}

function Scene({ gameState, onTileClick, renderedPositions }) {
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
        const r = n > 1 ? 0.45 : 0;
        out.push({ player: p, offset: [Math.cos(ang) * r, Math.sin(ang) * r] });
      });
    });
    return out;
  }, [allPlayers, renderedPositions]);

  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[12, 24, 10]} intensity={1.15} />
      <directionalLight position={[-10, 8, -12]} intensity={0.35} color="#38bdf8" />

      <mesh position={[0, -0.4, 0]} onClick={() => onTileClick(null)}>
        <boxGeometry args={[U * 13.4, 0.5, U * 13.4]} />
        <meshStandardMaterial color="#070a12" flatShading metalness={0.2} roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.12, 0]}>
        <boxGeometry args={[U * 9, 0.3, U * 9]} />
        <meshStandardMaterial color="#0a0f1c" flatShading />
      </mesh>

      {TILES.map((tile) => {
        const ownerId = gameState?.owner?.[tile.id.toString()];
        const ownerObj = ownerId !== undefined ? players.find((p) => p.id === ownerId) : null;
        return (
          <Tile
            key={tile.id}
            tile={tile}
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

export default function Board3D({ gameState, myPlayerId, onTileClick, renderedPositions = {} }) {
  const latest = (gameState?.log || []).slice(-1)[0];
  const currentId = gameState?.order?.[gameState?.current];
  const currentName = gameState?.players?.find((p) => p.id === currentId)?.name;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 20, 17], fov: 46 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        style={{ width: "100%", height: "100%", background: "radial-gradient(circle at 50% 30%, #0b1020 0%, #04060c 100%)" }}
      >
        <Scene gameState={gameState} onTileClick={onTileClick} renderedPositions={renderedPositions} myPlayerId={myPlayerId} />
        <OrbitControls
          enablePan={false}
          minDistance={14}
          maxDistance={40}
          maxPolarAngle={Math.PI / 2.3}
          minPolarAngle={Math.PI / 6}
          target={[0, 0, 0]}
        />
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
          {currentName}'s turn · drag to orbit · scroll to zoom
        </div>
      )}
    </div>
  );
}
