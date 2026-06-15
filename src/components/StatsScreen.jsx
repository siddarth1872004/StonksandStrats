import { TOKEN_COLORS } from "../boardData";

export default function StatsScreen({ gameState }) {
  if (!gameState || !gameState.players) return null;

  const history = gameState.net_worth_history || {};
  const players = gameState.players;

  // Compute graph properties
  let maxVal = 1500;
  let maxRounds = 1;

  Object.values(history).forEach(points => {
    if (points.length > maxRounds) maxRounds = points.length;
    points.forEach(v => {
      if (v > maxVal) maxVal = v;
    });
  });

  // Scale data points to a 400x160 SVG canvas coordinates
  const width = 400;
  const height = 160;
  const paddingLeft = 35;
  const paddingRight = 10;
  const paddingTop = 10;
  const paddingBottom = 20;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const getPointsString = (pid) => {
    const points = history[pid.toString()] || [];
    if (points.length === 0) return "";

    return points.map((val, idx) => {
      const x = paddingLeft + (maxRounds > 1 ? (idx / (maxRounds - 1)) * chartWidth : 0);
      // Invert Y axis for SVG rendering (0 is top)
      const y = paddingTop + chartHeight - (maxVal > 0 ? (val / maxVal) * chartHeight : 0);
      return `${x},${y}`;
    }).join(" ");
  };

  return (
    <div className="glass-card p-4 border border-slate-800 flex flex-col gap-4">
      {/* Title */}
      <h3 className="font-mono text-[10px] text-sky-400 font-bold tracking-wider uppercase">
        SCOREBOARD & HISTORY TRENDS
      </h3>

      {/* Leaderboard Table */}
      <div className="overflow-x-auto">
        <table className="w-full font-mono text-[9px] text-left text-slate-300">
          <thead>
            <tr className="border-b border-slate-800 text-slate-500 text-[8px] pb-1">
              <th className="pb-1.5">PLAYER NAME</th>
              <th className="pb-1.5 text-right">CASH</th>
              <th className="pb-1.5 text-right">PROPS</th>
              <th className="pb-1.5 text-right">NET WORTH</th>
              <th className="pb-1.5 text-right">PEAK</th>
              <th className="pb-1.5 text-center">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {players.map(p => {
              const hist = history[p.id.toString()] || [];
              const netWorth = hist.length > 0 ? hist[hist.length - 1] : p.money;
              const peak = hist.length > 0 ? Math.max(...hist) : p.money;
              const color = p.token_color || TOKEN_COLORS[p.token_shape || p.token] || "#fff";
              
              return (
                <tr key={p.id} className="border-b border-slate-900/50 hover:bg-slate-950/20">
                  <td className="py-2 flex items-center gap-1.5">
                    <span 
                      className="w-1.5 h-1.5 rounded-full inline-block" 
                      style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
                    />
                    <span className="font-bold text-slate-200">{p.name}</span>
                  </td>
                  <td className="py-2 text-right text-emerald-400 font-bold">${p.money}</td>
                  <td className="py-2 text-right text-slate-400">{p.properties.length}</td>
                  <td className="py-2 text-right text-sky-400 font-bold">${netWorth}</td>
                  <td className="py-2 text-right text-amber-400">${peak}</td>
                  <td className="py-2 text-center">
                    {p.bankrupt ? (
                      <span className="px-1 py-0.5 border border-red-500/30 rounded bg-red-950/20 text-red-500 text-[8px]">BANKRUPT</span>
                    ) : p.in_jail ? (
                      <span className="px-1 py-0.5 border border-amber-500/30 rounded bg-amber-950/20 text-amber-500 text-[8px]">IN JAIL</span>
                    ) : (
                      <span className="px-1 py-0.5 border border-green-500/30 rounded bg-green-950/20 text-green-500 text-[8px]">ACTIVE</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Custom SVG Line Chart */}
      <div className="border border-slate-900 bg-black/40 rounded p-2 flex flex-col gap-2">
        <div className="font-mono text-[8px] text-slate-500">NET WORTH HISTORICAL SAMPLING TREND:</div>
        
        <div className="relative w-full h-[160px]">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
            {/* Grid Horizontal Guidelines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = paddingTop + ratio * chartHeight;
              const val = Math.round(maxVal - ratio * maxVal);
              return (
                <g key={i}>
                  <line 
                    x1={paddingLeft} 
                    y1={y} 
                    x2={width - paddingRight} 
                    y2={y} 
                    stroke="rgba(30, 41, 59, 0.25)" 
                    strokeDasharray="2 2"
                  />
                  <text 
                    x={paddingLeft - 6} 
                    y={y + 3} 
                    fill="rgba(148, 163, 184, 0.4)" 
                    fontSize="7" 
                    textAnchor="end"
                    fontFamily="monospace"
                  >
                    ${val}
                  </text>
                </g>
              );
            })}

            {/* Vertical gridline indicators for rounds */}
            {Array.from({ length: Math.min(10, maxRounds) }).map((_, idx, arr) => {
              const roundIdx = Math.floor((idx / (arr.length - 1 || 1)) * (maxRounds - 1));
              const x = paddingLeft + (maxRounds > 1 ? (roundIdx / (maxRounds - 1)) * chartWidth : 0);
              return (
                <g key={idx}>
                  <line 
                    x1={x} 
                    y1={paddingTop} 
                    x2={x} 
                    y2={paddingTop + chartHeight} 
                    stroke="rgba(30, 41, 59, 0.15)"
                  />
                  <text 
                    x={x} 
                    y={paddingTop + chartHeight + 12} 
                    fill="rgba(148, 163, 184, 0.4)" 
                    fontSize="7" 
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    R{roundIdx + 1}
                  </text>
                </g>
              );
            })}

            {/* Player lines */}
            {players.map(p => {
              const color = p.token_color || TOKEN_COLORS[p.token_shape || p.token] || "#fff";
              const pointsStr = getPointsString(p.id);
              if (!pointsStr) return null;
              
              return (
                <polyline
                  key={p.id}
                  fill="none"
                  stroke={color}
                  strokeWidth="1.5"
                  points={pointsStr}
                  style={{ filter: `drop-shadow(0px 0px 2px ${color}80)` }}
                />
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
