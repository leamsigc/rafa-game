import { DogBreed } from "../../types/pet";

/** What each player broadcasts about themselves in a group. */
export interface MpProfile {
  name: string;
  dogName: string;
  breed: DogBreed | string;
  collarColor: string;
  balance: number;
  health: number;
  level: number;
  mostPlayed: string;
  achievements: number;
  googleVerified: boolean;
}

export interface MpMemberState extends MpProfile {
  id: string;
  isHost: boolean;
  active: boolean;
}

export interface MpScore {
  id: string;
  name: string;
  dogName: string;
  xp: number;
}

export interface MpSnapshot {
  code: string;
  started: boolean;
  members: MpMemberState[];
  scores: MpScore[];
}

export type MpClientEvent =
  | { type: "joined"; snapshot: MpSnapshot; you: string }
  | { type: "member_joined"; member: MpMemberState; snapshot: MpSnapshot }
  | { type: "member_left"; id: string; snapshot: MpSnapshot }
  | { type: "member_updated"; id: string; profile: MpProfile; snapshot: MpSnapshot }
  | { type: "started"; snapshot: MpSnapshot }
  | { type: "xp"; scores: MpScore[] }
  | { type: "error"; message: string }
  | { type: "disconnected" };

/** Small promise-free WebSocket wrapper for the /api/mp group server. */
export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<(e: MpClientEvent) => void>();

  public connected = false;

  connect() {
    if (this.ws) return;
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    this.ws = new WebSocket(`${proto}//${location.host}/api/mp`);
    this.ws.onopen = () => {
      this.connected = true;
    };
    this.ws.onclose = () => {
      this.connected = false;
      this.emit({ type: "disconnected" });
    };
    this.ws.onmessage = (ev) => {
      try {
        this.emit(JSON.parse(ev.data) as MpClientEvent);
      } catch {
        // ignore malformed frames
      }
    };
  }

  private emit(e: MpClientEvent) {
    this.listeners.forEach((l) => l(e));
  }

  on(listener: (e: MpClientEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private send(payload: Record<string, unknown>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(payload));
  }

  createGroup(profile: MpProfile) {
    this.connect();
    // Wait for the socket to open, then ask the server for a fresh code.
    const trySend = () => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: "create", profile });
      } else {
        setTimeout(trySend, 60);
      }
    };
    trySend();
  }

  joinGroup(code: string, profile: MpProfile) {
    this.connect();
    const trySend = () => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: "join", code, profile });
      } else {
        setTimeout(trySend, 60);
      }
    };
    trySend();
  }

  leaveGroup() {
    this.send({ type: "leave" });
    this.listeners.clear();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  startExpedition() {
    this.send({ type: "start" });
  }

  awardXp(amount: number) {
    this.send({ type: "award_xp", amount });
  }

  updateProfile(profile: MpProfile) {
    this.send({ type: "profile_update", profile });
  }
}
