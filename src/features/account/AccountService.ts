import { LinkedAccount } from "../../types/pet";

/**
 * Account Service — Google Account Linking flow.
 *
 * How it works: clicking "Link Account" opens a popup window served by the
 * game server at /auth/google. If the server has a GOOGLE_CLIENT_ID
 * configured, the popup renders the real Google Identity Services sign-in
 * button (account selection included). Without a client ID the popup shows
 * a friendly fallback "trainer card" form so the flow still works locally.
 * The popup posts the result back to this window and closes.
 */

const ACCOUNT_KEY = "doghouse_account_v1";

export function getAccount(): LinkedAccount | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    if (raw) return JSON.parse(raw) as LinkedAccount;
  } catch {
    // ignore
  }
  return null;
}

export function saveAccount(acc: LinkedAccount | null) {
  try {
    if (acc) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(acc));
    else localStorage.removeItem(ACCOUNT_KEY);
  } catch {
    // ignore
  }
}

/**
 * Opens the Google sign-in popup. Resolves with the linked account
 * (googleVerified=true when signed in with a real Google account).
 */
export function linkAccount(): Promise<LinkedAccount | null> {
  return new Promise((resolve) => {
    const width = 480;
    const height = 580;
    const left = Math.max(0, (window.innerWidth - width) / 2 + (window.screenX || 0));
    const top = Math.max(0, (window.innerHeight - height) / 2 + (window.screenY || 0));
    const popup = window.open(
      "/auth/google",
      "google-link",
      `popup=yes,width=${width},height=${height},left=${left},top=${top}`
    );

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(watchdog);
    };

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string; account?: LinkedAccount };
      if (data?.type === "google-linked" && data.account) {
        saveAccount(data.account);
        resolve(data.account);
        cleanup();
        popup?.close();
      }
      if (data?.type === "google-link-cancel") {
        resolve(null);
        cleanup();
        popup?.close();
      }
    };
    window.addEventListener("message", onMessage);

    // Watchdog: if popup was blocked or closed without linking, give up.
    const watchdog = window.setInterval(() => {
      if (!popup || popup.closed) {
        // Give the message a brief moment to arrive before declaring failure
        window.setTimeout(() => {
          cleanup();
          resolve(getAccount());
        }, 400);
      }
    }, 600);
  });
}

export interface ScoreboardEntry {
  trainerName: string;
  pupName: string;
  level: number;
  xp: number;
  breeds: number;
  googleVerified: boolean;
  updatedAt: number;
}

/** Submit the trainer's entry to the online scoreboard. */
export async function submitScore(entry: Omit<ScoreboardEntry, "updatedAt">) {
  try {
    await fetch("/api/scoreboard/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...entry, updatedAt: Date.now() }),
    });
  } catch {
    // offline is fine — the modal still shows cached results
  }
}

/** Fetch the global scoreboard (best trainers first). */
export async function fetchScoreboard(): Promise<ScoreboardEntry[]> {
  try {
    const res = await fetch("/api/scoreboard");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.entries)) return data.entries as ScoreboardEntry[];
    }
  } catch {
    // ignore
  }
  return [];
}
