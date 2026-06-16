import { useState } from "react";
import { TILES } from "../boardData";
import { playClick } from "../lib/audio";
import { GavelIcon, DollarIcon, CloseIcon, PlayIcon } from "../lib/icons";

export default function Auction({ gameState, myPlayerId, onAction }) {
  const [customBid, setCustomBid] = useState("");
  const auction = gameState?.auction;

  if (gameState?.phase !== "auction" || !auction) return null;

  const tile = TILES[auction.tile];
  const activeBidderId = auction.active[auction.turn_idx];
  const activeBidder = gameState.players.find(p => p.id === activeBidderId);
  const currentBidder = auction.current_bidder !== null
    ? gameState.players.find(p => p.id === auction.current_bidder)
    : null;

  const isMyBiddingTurn = activeBidderId === myPlayerId;
  const myPlayer = gameState.players.find(p => p.id === myPlayerId);

  const handleBid = (amount) => {
    playClick();
    if (!onAction) return;
    onAction("auction_bid", { amount });
  };

  const handlePass = () => {
    playClick();
    if (!onAction) return;
    onAction("auction_pass", {});
  };

  const handleCustomBidSubmit = (e) => {
    e.preventDefault();
    const val = parseInt(customBid, 10);
    if (!isNaN(val) && val > auction.current_bid) {
      handleBid(val);
      setCustomBid("");
    }
  };

  return (
    <div className="dialog-overlay">
      <div className="glass-card auction-overlay-content animate-scale-up" style={{ borderTop: "4px solid #F59E0B" }}>
        {/* Title */}
        <h2 style={{ fontFamily: "var(--font-retro)", fontSize: "14px", color: "#F59E0B", fontWeight: "bold", marginBottom: "16px", letterSpacing: "1px", textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
          <GavelIcon size={12} /> LIVE FORECLOSURE AUCTION
        </h2>

        {/* Property Info Card */}
        <div style={{ background: "rgba(0, 0, 0, 0.6)", padding: "16px", border: "1px solid rgba(245, 158, 11, 0.2)", borderRadius: "0px", marginBottom: "20px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontFamily: "var(--font-retro)", fontSize: "12px", color: "#F59E0B", marginBottom: "4px" }}>
            AUCTIONED PROPERTY:
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "14px", fontWeight: "bold", color: "#F1F5F9", letterSpacing: "0.5px" }}>
            {tile?.name || "Unknown Property"}
          </div>
          <div style={{ fontFamily: "var(--font-retro)", fontSize: "12px", color: "#94A3B8", marginTop: "4px", textTransform: "uppercase" }}>
            Value: ${tile?.price} | Group: {tile?.group}
          </div>
        </div>

        {/* Bid Tracker grid */}
        <div className="auction-grid-row" style={{ fontFamily: "var(--font-retro)", fontSize: "12px" }}>
          <div className="auction-stat-box">
            <div style={{ color: "#64748B", fontSize: "11px", marginBottom: "4px" }}>CURRENT HIGH BID:</div>
            <div style={{ fontSize: "16px", fontWeight: "bold", color: "#10B981" }}>${auction.current_bid}</div>
            <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              By: {currentBidder?.name || "No Bids Yet"}
            </div>
          </div>

          <div className="auction-stat-box">
            <div style={{ color: "#64748B", fontSize: "11px", marginBottom: "4px" }}>ACTIVE BIDDER TURN:</div>
            <div style={{ fontSize: "16px", fontWeight: "bold", color: "#F59E0B" }}>
              {activeBidder?.name || "Unknown"}
            </div>
            <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px", textTransform: "uppercase" }}>
              {isMyBiddingTurn ? "YOUR DECISION" : "Waiting..."}
            </div>
          </div>
        </div>

        {/* Action Panel */}
        {isMyBiddingTurn ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", fontFamily: "var(--font-retro)", fontSize: "12px" }}>
            {/* Quick bid increments */}
            <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
              <button 
                onClick={() => handleBid(auction.current_bid + 10)}
                disabled={myPlayer?.money < auction.current_bid + 10}
                className="btn-retro btn-retro-green"
                style={{ flex: 1 }}
              >
                <DollarIcon size={10} /> +10
              </button>
              <button 
                onClick={() => handleBid(auction.current_bid + 50)}
                disabled={myPlayer?.money < auction.current_bid + 50}
                className="btn-retro btn-retro-green"
                style={{ flex: 1 }}
              >
                <DollarIcon size={10} /> +50
              </button>
              <button 
                onClick={() => handleBid(auction.current_bid + 100)}
                disabled={myPlayer?.money < auction.current_bid + 100}
                className="btn-retro btn-retro-green"
                style={{ flex: 1 }}
              >
                <DollarIcon size={10} /> +100
              </button>
            </div>

            {/* Custom bid submission */}
            <form onSubmit={handleCustomBidSubmit} style={{ display: "flex", gap: "8px", justifyContent: "center", alignItems: "center" }}>
              <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
                <span style={{ position: "absolute", left: "8px", color: "#64748B", display: "flex", alignItems: "center" }}><DollarIcon size={10} /></span>
                <input
                  type="number"
                  value={customBid}
                  onChange={e => setCustomBid(e.target.value)}
                  min={auction.current_bid + 1}
                  max={myPlayer?.money || 0}
                  placeholder={`Custom Bid (> $${auction.current_bid})`}
                  className="retro-input"
                  style={{ flex: 1, fontSize: "12px", padding: "6px 6px 6px 20px", fontFamily: "var(--font-retro)", borderRadius: "0px" }}
                />
              </div>
              <button 
                type="submit"
                className="btn-retro btn-retro-green"
              >
                <PlayIcon size={10} /> SUBMIT
              </button>
            </form>

            {/* Pass */}
            <button 
              onClick={handlePass}
              className="btn-retro btn-retro-red"
              style={{ width: "100%", fontWeight: "bold" }}
            >
              <CloseIcon size={10} /> PASS & FORFEIT AUCTION
            </button>
          </div>
        ) : (
          <div style={{ fontFamily: "var(--font-retro)", fontSize: "12px", color: "#94A3B8", fontStyle: "italic", padding: "16px 0", animation: "pulse 2s infinite" }}>
            Waiting for {activeBidder?.name} to place a bid or pass...
          </div>
        )}
      </div>
    </div>
  );
}
