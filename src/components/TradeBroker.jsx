import { useState } from "react";
import { TILES } from "../boardData";
import { playClick } from "../lib/audio";
import { TradeIcon, DollarIcon, PlayIcon, CloseIcon } from "../lib/icons";

export default function TradeBroker({ gameState, myPlayerId, onAction }) {
  const [targetPid, setTargetPid] = useState("");
  const [myCash, setMyCash] = useState(0);
  const [theirCash, setTheirCash] = useState(0);
  const [myCards, setMyCards] = useState(0);
  const [theirCards, setTheirCards] = useState(0);
  const [myProps, setMyProps] = useState([]);
  const [theirProps, setTheirProps] = useState([]);

  const pendingTrade = gameState?.pending_trade;

  // Render current pending trade decision if one exists
  if (pendingTrade) {
    const fromPlayer = gameState.players.find(p => p.id === pendingTrade.from);
    const toPlayer = gameState.players.find(p => p.id === pendingTrade.to);
    const offer = pendingTrade.offer;

    const isTarget = pendingTrade.to === myPlayerId;
    const isProposer = pendingTrade.from === myPlayerId;

    const handleRespond = (accept) => {
      playClick();
      if (!onAction) return;
      onAction("respond_trade", { accept });
    };

    const handleCancel = () => {
      playClick();
      if (!onAction) return;
      onAction("cancel_trade", {});
    };

    return (
      <div className="fixed inset-0 z-[7500] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-scale-up">
        <div className="glass-card w-full max-w-lg p-6 border-t-4 border-cyan-500">
          <h2 className="font-mono text-xs text-cyan-400 font-bold mb-4 tracking-widest text-center uppercase flex items-center justify-center gap-1.5">
            <TradeIcon size={12} /> PENDING TRADE PROPOSAL
          </h2>

          <div className="grid grid-cols-2 gap-4 font-mono text-[10px] text-slate-300 mb-6">
            {/* Proposer Offer */}
            <div className="bg-black/40 p-3 border border-slate-900 rounded">
              <div className="font-bold text-sky-400 mb-1">{fromPlayer?.name}'S OFFER:</div>
              <div className="text-emerald-400 font-bold mb-2">+ ${offer.from_money}</div>
              {offer.from_cards > 0 && <div className="text-amber-400 mb-2">+ {offer.from_cards} Jail Card(s)</div>}
              <div className="border-t border-slate-900 pt-2 flex flex-col gap-1 max-h-[100px] overflow-y-auto">
                {offer.from_properties.length > 0 ? (
                  offer.from_properties.map(tid => (
                    <div key={tid} className="truncate text-slate-400">- {TILES[tid].name}</div>
                  ))
                ) : (
                  <span className="italic text-slate-600">No properties</span>
                )}
              </div>
            </div>

            {/* Target Request */}
            <div className="bg-black/40 p-3 border border-slate-900 rounded">
              <div className="font-bold text-amber-400 mb-1">{toPlayer?.name}'S OFFER:</div>
              <div className="text-emerald-400 font-bold mb-2">+ ${offer.to_money}</div>
              {offer.to_cards > 0 && <div className="text-amber-400 mb-2">+ {offer.to_cards} Jail Card(s)</div>}
              <div className="border-t border-slate-900 pt-2 flex flex-col gap-1 max-h-[100px] overflow-y-auto">
                {offer.to_properties.length > 0 ? (
                  offer.to_properties.map(tid => (
                    <div key={tid} className="truncate text-slate-400">- {TILES[tid].name}</div>
                  ))
                ) : (
                  <span className="italic text-slate-600">No properties</span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons based on identity */}
          <div className="flex justify-center gap-4">
            {isTarget ? (
              <>
                <button 
                  onClick={() => handleRespond(true)}
                  className="btn-retro btn-retro-green flex-1"
                >
                  <PlayIcon size={10} className="mr-1" /> ACCEPT TRADE
                </button>
                <button 
                  onClick={() => handleRespond(false)}
                  className="btn-retro btn-retro-red flex-1"
                >
                  <CloseIcon size={10} className="mr-1" /> REJECT TRADE
                </button>
              </>
            ) : isProposer ? (
              <button 
                onClick={handleCancel}
                className="btn-retro btn-retro-red w-full"
              >
                <CloseIcon size={10} className="mr-1" /> WITHDRAW TRADE PROPOSAL
              </button>
            ) : (
              <div className="font-mono text-[9px] text-slate-500 italic text-center py-2 animate-pulse w-full">
                Waiting for {toPlayer?.name} to respond to {fromPlayer?.name}'s trade proposal...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Otherwise, render trade creation panel
  const myPlayer = gameState?.players?.find(p => p.id === myPlayerId);
  const otherActivePlayers = gameState?.players?.filter(p => !p.bankrupt && p.id !== myPlayerId) || [];

  if (otherActivePlayers.length === 0) return null;

  const targetPlayer = gameState?.players?.find(p => p.id === targetPid);

  const handleToggleMyProp = (tid) => {
    setMyProps(prev => prev.includes(tid) ? prev.filter(x => x !== tid) : [...prev, tid]);
  };

  const handleToggleTheirProp = (tid) => {
    setTheirProps(prev => prev.includes(tid) ? prev.filter(x => x !== tid) : [...prev, tid]);
  };

  const handlePropose = () => {
    playClick();
    if (!onAction || targetPid === "") return;

    onAction("propose_trade", {
      toId: targetPid,
      offer: {
        from_properties: myProps,
        to_properties: theirProps,
        from_money: myCash,
        to_money: theirCash,
        from_cards: myCards,
        to_cards: theirCards,
      },
    });

    // Reset local creator inputs
    setMyCash(0);
    setTheirCash(0);
    setMyCards(0);
    setTheirCards(0);
    setMyProps([]);
    setTheirProps([]);
  };

  return (
    <div id="trade-broker-panel" className="glass-card p-4 border border-slate-800 flex flex-col gap-4">
      <h3 className="font-mono text-[10px] text-sky-400 font-bold tracking-wider uppercase flex items-center gap-1.5">
        <TradeIcon size={11} /> TRADE BROKER TERMINAL
      </h3>

      {/* Select opponent */}
      <div className="flex flex-col gap-1 font-mono text-[9px] text-slate-400">
        <span>SELECT PARTNER PLAYER:</span>
        <select
          value={targetPid}
          onChange={e => { setTargetPid(e.target.value); setTheirProps([]); setTheirCash(0); setTheirCards(0); }}
          className="retro-input bg-slate-950 font-mono text-[10px] text-slate-300 w-full"
        >
          <option value="">Choose partner...</option>
          {otherActivePlayers.map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.token})</option>
          ))}
        </select>
      </div>

      {targetPlayer && myPlayer && (
        <div className="grid grid-cols-2 gap-4 font-mono text-[9px] text-slate-300">
          {/* My Side */}
          <div className="flex flex-col gap-3 p-2 border border-slate-900 rounded bg-slate-950/20">
            <div className="font-bold text-sky-400 truncate">YOU OFFER:</div>
            
            {/* Money input */}
            <div className="flex flex-col gap-1">
              <span>CASH ($0 - ${myPlayer.money}):</span>
              <div className="relative flex items-center">
                <span className="absolute left-2.5 text-slate-500 font-mono text-[9px] flex items-center"><DollarIcon size={10} /></span>
                <input
                  type="number"
                  value={myCash}
                  onChange={e => setMyCash(Math.max(0, Math.min(myPlayer.money, parseInt(e.target.value, 10) || 0)))}
                  className="retro-input bg-slate-950 p-1 pl-6 text-[9px] w-full"
                />
              </div>
            </div>

            {/* Jail card input */}
            {myPlayer.jail_cards > 0 && (
              <div className="flex flex-col gap-1">
                <span>JAIL CARDS (0 - {myPlayer.jail_cards}):</span>
                <input
                  type="number"
                  value={myCards}
                  onChange={e => setMyCards(Math.max(0, Math.min(myPlayer.jail_cards, parseInt(e.target.value, 10) || 0)))}
                  className="retro-input bg-slate-950 p-1 text-[9px] w-full"
                />
              </div>
            )}

            {/* Properties checklist */}
            <div className="flex flex-col gap-1">
              <span>PROPERTIES:</span>
              <div className="flex flex-col gap-1.5 max-h-[120px] overflow-y-auto pr-1">
                {myPlayer.properties.length > 0 ? (
                  myPlayer.properties.map(tid => {
                    // Check if improved (Monopoly properties with houses cannot be traded)
                    const isImproved = (gameState?.houses?.[tid.toString()] || 0) > 0;
                    return (
                      <label key={tid} className="flex items-center gap-1.5 cursor-pointer text-[8px] truncate">
                        <input
                          type="checkbox"
                          checked={myProps.includes(tid)}
                          disabled={isImproved}
                          onChange={() => handleToggleMyProp(tid)}
                        />
                        <span className={isImproved ? "text-slate-600 line-through" : ""}>
                          {TILES[tid].name} {isImproved && "(Improved)"}
                        </span>
                      </label>
                    );
                  })
                ) : (
                  <span className="italic text-slate-600">None owned</span>
                )}
              </div>
            </div>
          </div>

          {/* Their Side */}
          <div className="flex flex-col gap-3 p-2 border border-slate-900 rounded bg-slate-950/20">
            <div className="font-bold text-amber-400 truncate">{targetPlayer.name} OFFERS:</div>
            
            {/* Money input */}
            <div className="flex flex-col gap-1">
              <span>CASH ($0 - ${targetPlayer.money}):</span>
              <div className="relative flex items-center">
                <span className="absolute left-2.5 text-slate-500 font-mono text-[9px] flex items-center"><DollarIcon size={10} /></span>
                <input
                  type="number"
                  value={theirCash}
                  onChange={e => setTheirCash(Math.max(0, Math.min(targetPlayer.money, parseInt(e.target.value, 10) || 0)))}
                  className="retro-input bg-slate-950 p-1 pl-6 text-[9px] w-full"
                />
              </div>
            </div>

            {/* Jail card input */}
            {targetPlayer.jail_cards > 0 && (
              <div className="flex flex-col gap-1">
                <span>JAIL CARDS (0 - {targetPlayer.jail_cards}):</span>
                <input
                  type="number"
                  value={theirCards}
                  onChange={e => setTheirCards(Math.max(0, Math.min(targetPlayer.jail_cards, parseInt(e.target.value, 10) || 0)))}
                  className="retro-input bg-slate-950 p-1 text-[9px] w-full"
                />
              </div>
            )}

            {/* Properties checklist */}
            <div className="flex flex-col gap-1">
              <span>PROPERTIES:</span>
              <div className="flex flex-col gap-1.5 max-h-[120px] overflow-y-auto pr-1">
                {targetPlayer.properties.length > 0 ? (
                  targetPlayer.properties.map(tid => {
                    const isImproved = (gameState?.houses?.[tid.toString()] || 0) > 0;
                    return (
                      <label key={tid} className="flex items-center gap-1.5 cursor-pointer text-[8px] truncate">
                        <input
                          type="checkbox"
                          checked={theirProps.includes(tid)}
                          disabled={isImproved}
                          onChange={() => handleToggleTheirProp(tid)}
                        />
                        <span className={isImproved ? "text-slate-600 line-through" : ""}>
                          {TILES[tid].name} {isImproved && "(Improved)"}
                        </span>
                      </label>
                    );
                  })
                ) : (
                  <span className="italic text-slate-600">None owned</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {targetPlayer && (
        <button
          onClick={handlePropose}
          className="btn-retro btn-retro-green w-full font-bold text-center mt-2"
        >
          <PlayIcon size={10} className="mr-1" /> SEND TRADE PROPOSAL
        </button>
      )}
    </div>
  );
}
