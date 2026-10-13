import React, { useState } from "react";
import { Users, X, Coins, Heart, Gamepad2, Trophy, ShieldCheck, Activity, Search } from "lucide-react";
import { MpMemberState } from "./mpClient";

interface MembersPanelProps {
  members: MpMemberState[];
  myId: string;
  onClose: () => void;
}

/**
 * Members — the left-hand online players panel.
 * Click any member to open their trainer card: active status, balance,
 * health, most-played game, achievements and account information.
 */
export const MembersPanel: React.FC<MembersPanelProps> = ({ members, myId, onClose }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [onlyActive, setOnlyActive] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = members.filter(
    (m) =>
      (!onlyActive || m.active) &&
      (!query || m.name.toLowerCase().includes(query.toLowerCase()) || m.dogName.toLowerCase().includes(query.toLowerCase()))
  );
  const selected = members.find((m) => m.id === selectedId) || null;

  return (
    <div className="absolute left-3 top-20 bottom-24 z-30 w-80 max-w-[85vw] flex flex-col rounded-2xl bg-slate-900/90 border border-white/15 shadow-2xl backdrop-blur-md text-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2 font-bold">
          <Users className="w-5 h-5 text-sky-400" />
          Members
          <span className="text-xs font-normal text-slate-400">
            {members.filter((m) => m.active).length}/{members.length} online
          </span>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors" aria-label="Close members">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Member list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelectedId(selectedId === m.id ? null : m.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors ${
              selectedId === m.id ? "bg-sky-500/25" : "hover:bg-white/10"
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${m.active ? "bg-green-400" : "bg-slate-500"}`} />
            <span className="text-lg">{m.id === myId ? "🦴" : "🐶"}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold truncate">
                {m.name} {m.isHost && <span className="text-[10px] text-amber-300">HOST</span>}
              </span>
              <span className="block text-xs text-slate-400 truncate">& {m.dogName}</span>
            </span>
            <span className="text-xs text-amber-300 font-bold">Lv {m.level}</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-6">No players match this filter.</p>
        )}
      </div>

      {/* Settings: who is shown */}
      <div className="px-4 py-2 border-t border-white/10 flex items-center gap-3 text-xs text-slate-300">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} className="accent-sky-400" />
          Active only
        </label>
        <div className="flex items-center gap-1 flex-1 rounded-lg bg-white/10 px-2 py-1">
          <Search className="w-3 h-3 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find player..."
            className="bg-transparent outline-none w-full placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Trainer card */}
      {selected && (
        <div className="border-t border-white/10 bg-slate-800/80 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold">{selected.name}</p>
              <p className="text-xs text-slate-400">
                Trainer of {selected.dogName} the {String(selected.breed)}
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <Activity className="w-3.5 h-3.5 text-green-400" />
              {selected.active ? "Active" : "Away"}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-white/10 px-2.5 py-2 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-300" />
              <span className="text-slate-300">Balance</span>
              <span className="ml-auto font-bold">{selected.balance}</span>
            </div>
            <div className="rounded-lg bg-white/10 px-2.5 py-2 flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-rose-400" />
              <span className="text-slate-300">Health</span>
              <span className="ml-auto font-bold">{Math.round(selected.health)}</span>
            </div>
            <div className="rounded-lg bg-white/10 px-2.5 py-2 flex items-center gap-1.5 col-span-2">
              <Gamepad2 className="w-4 h-4 text-violet-300" />
              <span className="text-slate-300">Plays the most</span>
              <span className="ml-auto font-bold">{selected.mostPlayed}</span>
            </div>
            <div className="rounded-lg bg-white/10 px-2.5 py-2 flex items-center gap-1.5 col-span-2">
              <Trophy className="w-4 h-4 text-amber-300" />
              <span className="text-slate-300">Achievements</span>
              <span className="ml-auto font-bold">{selected.achievements}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 border-t border-white/10 pt-2">
            <ShieldCheck className={`w-4 h-4 ${selected.googleVerified ? "text-sky-400" : "text-slate-600"}`} />
            Account: {selected.googleVerified ? "Google-verified" : "Guest profile"}
          </div>
        </div>
      )}
    </div>
  );
};
