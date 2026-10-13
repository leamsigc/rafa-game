import React, { useEffect, useRef, useState } from "react";
import { Copy, Check, Users, LogOut, Radar, Sparkles, Play, Trophy } from "lucide-react";
import { MultiplayerClient, MpSnapshot } from "./mpClient";
import { LobbyScene } from "./LobbyScene";
import { MembersPanel } from "./MembersPanel";
import { GroupScoreboard } from "./GroupScoreboard";

export type MpStage = "menu" | "searching" | "lobby";

interface MultiplayerManagerProps {
  stage: MpStage;
  snapshot: MpSnapshot | null;
  youId: string | null;
  error: string | null;
  searchingCode: string | null;
  overlayVisible: boolean;
  showMembers: boolean;
  showScoreboard: boolean;
  onCreate: () => void;
  onJoin: (code: string) => void;
  onCancelSearch: () => void;
  onLeave: () => void;
  onStartExpedition: () => void;
  onEnterWorld: () => void;
  onCloseMenu: () => void;
  onToggleMembers: () => void;
  onToggleScoreboard: () => void;
}

/**
 * MultiplayerManager — everything the little path machine opens:
 *  - the Create / Join menu with the tricky group codes
 *  - the "search system" radar while a code is being hunted
 *  - the full-screen void lobby (dogs fly down onto blue circles)
 *  - the massive yellow-ringed expedition disc after START EXPEDITION
 *  - Members panel + live group XP scoreboard
 */
export const MultiplayerManager: React.FC<MultiplayerManagerProps> = ({
  stage,
  snapshot,
  youId,
  error,
  searchingCode,
  overlayVisible,
  showMembers,
  showScoreboard,
  onCreate,
  onJoin,
  onCancelSearch,
  onLeave,
  onStartExpedition,
  onEnterWorld,
  onCloseMenu,
  onToggleMembers,
  onToggleScoreboard,
}) => {
  const lobbyRef = useRef<HTMLDivElement | null>(null);
  const lobbySceneRef = useRef<LobbyScene | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);

  // Spin up the 3D void lobby once a group is live
  useEffect(() => {
    if (stage !== "lobby" || !snapshot) return;
    if (!lobbySceneRef.current && lobbyRef.current) {
      lobbySceneRef.current = new LobbyScene(lobbyRef.current);
    }
    const scene = lobbySceneRef.current;
    if (!scene) return;
    // Sync every current member's dog into the scene
    snapshot.members.forEach((m) => scene.addMember(m));
    if (snapshot.started) scene.startExpedition();
    return () => {
      scene?.destroy();
      lobbySceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage === "lobby" && !!snapshot]);

  // New members fly in, leaving members vanish, expedition transform
  const memberKey = snapshot ? snapshot.members.map((m) => m.id).join(",") : "";
  const prevMemberKey = useRef(memberKey);
  useEffect(() => {
    const scene = lobbySceneRef.current;
    if (!scene || !snapshot) return;
    if (memberKey !== prevMemberKey.current) {
      const ids = new Set(snapshot.members.map((m) => m.id));
      scene.dogsSnapshot().forEach((id) => {
        if (!ids.has(id)) scene.removeMember(id);
      });
      snapshot.members.forEach((m) => scene.addMember(m));
      prevMemberKey.current = memberKey;
    }
  }, [memberKey, snapshot]);

  useEffect(() => {
    if (snapshot?.started) lobbySceneRef.current?.startExpedition();
  }, [snapshot?.started]);

  // Tear the scene down when the group ends
  useEffect(() => {
    if (stage === "lobby") return;
    lobbySceneRef.current?.destroy();
    lobbySceneRef.current = null;
  }, [stage]);

  const copyCode = () => {
    if (!snapshot) return;
    navigator.clipboard?.writeText(snapshot.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  // ============ MENU / SEARCHING modal ============
  if (stage === "menu" || stage === "searching") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="w-full max-w-md rounded-3xl bg-gradient-to-b from-slate-800 to-slate-900 border border-sky-400/30 shadow-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-11 h-11 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-xl">
              🛰️
            </div>
            <div>
              <h2 className="text-xl font-black tracking-wide">MULTIPLAYER</h2>
              <p className="text-xs text-slate-400">from the little machine on the path</p>
            </div>
          </div>

          {stage === "searching" ? (
            <div className="mt-6 flex flex-col items-center gap-3 py-4">
              <div className="relative w-24 h-24">
                <Radar className="w-24 h-24 text-sky-400 animate-spin" style={{ animationDuration: "2.5s" }} />
                <span className="absolute inset-0 flex items-center justify-center text-2xl">🔍</span>
              </div>
              <p className="font-bold">Search system active...</p>
              <p className="text-sm text-slate-400">
                Hunting for group <span className="font-mono font-bold text-sky-300">{searchingCode}</span>
              </p>
              <button
                onClick={onCancelSearch}
                className="mt-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold transition-colors"
              >
                Cancel search
              </button>
            </div>
          ) : (
            <>
              {error && (
                <p className="mt-4 text-sm text-rose-300 bg-rose-500/15 border border-rose-400/30 rounded-xl px-3 py-2">{error}</p>
              )}
              <button
                onClick={() => {
                  setCreating(true);
                  onCreate();
                }}
                className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-sky-500 hover:bg-sky-400 disabled:opacity-60 font-bold transition-colors"
              >
                <Sparkles className="w-5 h-5" />
                {creating ? "Generating group code..." : "Create a Group"}
              </button>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                <span className="flex-1 h-px bg-white/10" /> or join with a code <span className="flex-1 h-px bg-white/10" />
              </div>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (joinCode.trim()) onJoin(joinCode.trim());
                }}
              >
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="aB3xY9cD"
                  maxLength={8}
                  className="flex-1 min-w-0 rounded-2xl bg-white/10 border border-white/15 px-4 py-3 font-mono uppercase tracking-widest outline-none focus:border-sky-400 placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  disabled={!joinCode.trim()}
                  className="px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 font-bold transition-colors"
                >
                  Join
                </button>
              </form>
              <button onClick={onCloseMenu} className="mt-4 w-full text-sm text-slate-400 hover:text-white transition-colors">
                Close
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ============ LOBBY (only renders once a snapshot exists) ============
  if (stage !== "lobby" || !snapshot) return null;
  const me = snapshot.members.find((m) => m.id === youId);
  const amHost = !!me?.isHost;

  return (
    <>
      {/* The 3D void (hidden while playing in the park, kept alive) */}
      <div className={`fixed inset-0 z-40 bg-[#040617] ${overlayVisible ? "" : "hidden"}`}>
        <div ref={lobbyRef} className="absolute inset-0" />

        {/* Top bar: group code + leave */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-2xl bg-slate-900/85 border border-white/15 px-4 py-2.5 text-white shadow-xl backdrop-blur-md">
          <span className="text-[10px] uppercase tracking-widest text-slate-400">Group code</span>
          <span className="font-mono font-black text-lg tracking-widest text-sky-300">{snapshot.code}</span>
          <button onClick={copyCode} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" aria-label="Copy code">
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <span className="w-px h-5 bg-white/15" />
          <button
            onClick={onLeave}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-200 text-xs font-bold transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Leave
          </button>
        </div>

        {/* Panel toggles */}
        <div className="absolute top-3 right-3 z-10 flex gap-2">
          <button
            onClick={onToggleMembers}
            className={`p-2.5 rounded-xl border transition-colors ${
              showMembers ? "bg-sky-500/30 border-sky-400/50" : "bg-slate-900/80 border-white/15 hover:bg-white/10"
            } text-white`}
            aria-label="Toggle members"
          >
            <Users className="w-5 h-5" />
          </button>
          <button
            onClick={onToggleScoreboard}
            className={`p-2.5 rounded-xl border transition-colors ${
              showScoreboard ? "bg-amber-500/30 border-amber-400/50" : "bg-slate-900/80 border-white/15 hover:bg-white/10"
            } text-white`}
            aria-label="Toggle scoreboard"
          >
            <Trophy className="w-5 h-5" />
          </button>
        </div>

        {/* START EXPEDITION (host only) / continue after launch */}
        <div className="absolute bottom-6 right-6 z-10">
          {!snapshot.started ? (
            amHost ? (
              <button
                onClick={onStartExpedition}
                className="flex items-center gap-2 px-6 py-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-black text-lg shadow-[0_0_30px_rgba(251,191,36,0.5)] animate-pulse transition-colors"
              >
                <Play className="w-6 h-6" />
                START EXPEDITION
              </button>
            ) : (
              <p className="text-slate-400 text-sm bg-slate-900/70 rounded-xl px-3 py-2 border border-white/10">
                Waiting for the host to launch...
              </p>
            )
          ) : (
            <button
              onClick={onEnterWorld}
              className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black text-base shadow-xl transition-colors"
            >
              <Sparkles className="w-5 h-5" />
              Expedition live — play together!
            </button>
          )}
        </div>

        {/* Panels render even after returning to the park */}
        <div className="fixed inset-0 z-40 pointer-events-none">
          {showMembers && (
            <div className="pointer-events-auto">
              <MembersPanel members={snapshot.members} myId={youId || ""} onClose={onToggleMembers} />
            </div>
          )}
          {showScoreboard && (
            <div className="pointer-events-auto">
              <GroupScoreboard scores={snapshot.scores} myId={youId || ""} onClose={onToggleScoreboard} />
            </div>
          )}
        </div>
      </div>
    </>
  );
};
