import React from "react";
import { DEFAULT_HOUSE_RULES } from "../lib/gameEngine";

const RULE_DEFS = [
  { key: "free_parking_jackpot",  label: "Free Parking Jackpot",    type: "bool",   desc: "Fines & taxes go to a pot; landing on Free Parking collects it." },
  { key: "no_rent_in_jail",       label: "No Rent in Jail",         type: "bool",   desc: "Landlords in jail cannot collect rent." },
  { key: "skip_auction",          label: "Skip Auction",            type: "bool",   desc: "Declined properties return to the bank (no auction)." },
  { key: "double_go_salary",      label: "Double GO Salary",        type: "bool",   desc: "Landing exactly on GO earns double salary." },
  { key: "income_tax_choice",     label: "Income Tax Choice",       type: "bool",   desc: "Player may pay $200 or 10% of net worth (whichever is less)." },
  { key: "unlimited_buildings",   label: "Unlimited Buildings",     type: "bool",   desc: "Ignore house/hotel supply limits." },
  { key: "bank_errors_favored",   label: "Bank Errors Favored",     type: "bool",   desc: "Community Chest bank error card pays $400." },
  { key: "go_salary",             label: "GO Salary ($)",           type: "number", desc: "Amount collected when passing GO.", min: 50, max: 500, step: 50 },
  { key: "starting_cash",         label: "Starting Cash ($)",       type: "number", desc: "Money each player begins with.", min: 500, max: 3000, step: 100 },
  { key: "luxury_tax",            label: "Luxury Tax ($)",          type: "number", desc: "Amount paid when landing on Luxury Tax.", min: 25, max: 300, step: 25 },
  { key: "auction_minimum",       label: "Auction Minimum ($)",     type: "number", desc: "Minimum opening bid at auction.", min: 1, max: 50, step: 1 },
  { key: "jail_fine",             label: "Jail Fine ($)",           type: "number", desc: "Cost to pay out of jail.", min: 25, max: 200, step: 25 },
];

export default function HouseRulesPanel({ rules = {}, onChange, isHost }) {
  const merged = { ...DEFAULT_HOUSE_RULES, ...rules };

  const set = (key, val) => {
    if (!isHost) return;
    onChange({ ...merged, [key]: val });
  };

  return (
    <div className="flex flex-col gap-3 font-mono">
      <div className="text-[8px] text-slate-500 tracking-widest uppercase">HOUSE RULES</div>
      <div className="grid grid-cols-1 gap-2">
        {RULE_DEFS.map(def => (
          <div
            key={def.key}
            className="flex items-center justify-between gap-3 px-2 py-1.5 rounded"
            style={{ background: "rgba(15,23,42,0.35)", border: "1px solid rgba(56,189,248,0.08)" }}
            title={def.desc}
          >
            <span className="text-[9px] text-slate-300 truncate flex-1">{def.label}</span>
            {def.type === 'bool' ? (
              <button
                onClick={() => set(def.key, !merged[def.key])}
                disabled={!isHost}
                className={`text-[8px] px-2 py-0.5 rounded border transition-colors ${
                  merged[def.key]
                    ? "border-green-500/50 bg-green-950/30 text-green-400"
                    : "border-slate-700 bg-slate-900/30 text-slate-500"
                } ${isHost ? "cursor-pointer" : "cursor-default opacity-70"}`}
              >
                {merged[def.key] ? "ON" : "OFF"}
              </button>
            ) : (
              <input
                type="number"
                min={def.min}
                max={def.max}
                step={def.step}
                value={merged[def.key]}
                onChange={e => set(def.key, Number(e.target.value))}
                disabled={!isHost}
                className="retro-input w-16 text-right text-[9px] py-0.5 px-1"
                style={{ opacity: isHost ? 1 : 0.7 }}
              />
            )}
          </div>
        ))}
      </div>
      {!isHost && (
        <p className="text-[8px] text-slate-600 text-center italic">
          Only the host can change house rules before the game starts.
        </p>
      )}
    </div>
  );
}
