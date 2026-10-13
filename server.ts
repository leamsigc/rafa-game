import express from "express";
import http from "http";
import os from "os";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(express.json({ limit: "10mb" }));

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

/**
 * Intelligent canine conversational dialogue generator.
 * Used when API keys are unconfigured or when Gemini quota/rate limits are exceeded.
 */
function trickProficiency(tricks: Record<string, number> | undefined, trick: string): number {
  const value = tricks?.[trick];
  return typeof value === "number" ? value : 0;
}

/** A trick counts as learned once training proficiency reaches Skilled (40+). */
function knowsTrick(tricks: Record<string, number> | undefined, trick: string): boolean {
  return trickProficiency(tricks, trick) >= 40;
}

function generateCanineDialogue(
  message: string,
  petName: string,
  energy: number,
  hunger: number,
  happiness: number,
  breed: string,
  tricks?: Record<string, number>,
  emotion?: string
): { reply: string; detectedAction: string | null } {
  const lower = message.toLowerCase();
  let reply = "";
  let action = "";

  const emotionQuip =
    emotion === "tired" || emotion === "sleepy"
      ? ` *Yawns mid-sentence, ears drooping a little.*`
      : emotion === "hungry"
        ? ` *Stomach grumbles audibly.*`
        : emotion === "lonely" || emotion === "sad"
          ? ` *Looks up at you with big hopeful eyes.*`
          : "";

  if (lower.includes("stay")) {
    if (knowsTrick(tricks, "stay")) {
      reply = `*Freezes like a statue, eyes locked on you, tail sweeping slowly* Staying... staying... I'm so good at this! Treat please?`;
      action = "stay";
    } else {
      reply = `*Tries to stay still but wiggles after two seconds and bounces over to you* Oops! I don't know "stay" yet — train me in the Training menu and I'll learn it!`;
    }
  } else if (lower.includes("sit")) {
    if (knowsTrick(tricks, "sit")) {
      reply = `*Sits down promptly on the grass, looking up at you with attentive shining eyes* Woof! Look, I'm sitting like the best pup! Do I get a yummy treat now?`;
      action = "sit";
    } else {
      reply = `*Plops down sideways instead of sitting, tongue lolling out* Was that... close? Teach me "sit" in the Training menu and I'll nail it next time!`;
    }
  } else if (lower.includes("fetch") || lower.includes("ball") || lower.includes("throw") || lower.includes("play")) {
    if (knowsTrick(tricks, "fetch")) {
      reply = `*Eyes widen at the magic word, ears perked high* BALL?! Did you say play?! *Bounces on front paws* Throw it, throw it, I'm ready to zoom!`;
      action = "fetch";
    } else {
      reply = `*Chases the ball, then gets distracted by a butterfly and forgets to bring it back* Hehe... oops! Train "fetch" with me and I'll deliver it straight to your feet!`;
    }
  } else if (lower.includes("dance")) {
    reply = `*Stands up tall on hind legs and does a happy tap-dance* Look at my fancy paws go! Tap-tap-tap, best friends forever!`;
    action = "dance";
  } else if (lower.includes("backflip") || lower.includes("flip")) {
    reply = `*Crouches low, wiggles hips, and leaps into the air with an acrobatic backflip* TA-DA! Did you see that airtime?! Woof!`;
    action = "backflip";
  } else if (lower.includes("cuddle") || lower.includes("hug") || lower.includes("snuggle")) {
    reply = `*Melts into your side and rests head gently on your lap* Aww, cuddles with you are my absolute favorite thing in the universe. *gentle contented sigh*`;
    action = "cuddle";
  } else if (lower.includes("zoom") || lower.includes("run") || lower.includes("fast")) {
    reply = `*Tucks tail and zooms across the park in dizzying high-speed loops* ZOOMIES! I've got the need for speed, human! Catch me if you can!`;
    action = "zoomies";
  } else if (lower.includes("howl") || lower.includes("sing") || lower.includes("awoo")) {
    reply = `*Lifts snout toward the sky and sings with all my heart* AWOOOOOOOOO! That's my song of love for you!`;
    action = "howl";
  } else if (lower.includes("roll") || lower.includes("belly")) {
    reply = `*Flops onto back with paws in the air, tail swishing against the grass* Woof woof! Belly rubs are pure heaven! Don't stop!`;
    action = "roll";
  } else if (lower.includes("paw") || lower.includes("shake") || lower.includes("handshake")) {
    reply = `*Raises front right paw high with a big puppy smile* Here's my paw, partner! Best friends shake on it!`;
    action = "handshake";
  } else if (lower.includes("good boy") || lower.includes("good dog") || lower.includes("love you") || lower.includes("best dog")) {
    reply = `*Tail wags at supersonic speed and nuzzles against your hand* Awooo! I love you so much! You are the greatest human in the whole world!`;
    action = "cuddle";
  } else if (lower.includes("treat") || lower.includes("eat") || lower.includes("food") || lower.includes("hungry") || hunger > 60) {
    reply = `*Licks lips eagerly and lets out an expectant squeak* Yesss, treats! A crunchy biscuit or steak bite would make my whole day!`;
  } else if (lower.includes("sleep") || lower.includes("tired") || lower.includes("bed") || energy < 30) {
    reply = `*Yawns widely showing pink tongue, then curls up like a furry donut* Woof... my paws are sleepy, but a cozy snooze right next to you sounds perfect.`;
    action = "rest";
  } else if (lower.includes("spin") || lower.includes("trick")) {
    reply = `*Spins around chasing own tail in a swift playful circle* Look at me go! *pants happily* Pretty smooth moves, right?`;
    action = "spin";
  } else if (lower.includes("bark") || lower.includes("speak")) {
    reply = `*Barks happily with an upbeat woof and an energetic tail thump* WOOF! That was my happy bark for you!`;
    action = "bark";
  } else {
    const contextualReplies = [
      `*Tilts head sideways and perks up floppy ears* Woof? I heard you, best friend! What are we doing next?`,
      `*Paws the grass playfully and lets out an enthusiastic chirp-bark* Every second with you is an adventure! Can we run or play a mini-game?`,
      `*Nudges your hand gently with a wet nose, smiling broadly* I'm right here with you! You smell like my favorite person in the whole galaxy!`,
      `*Wags tail with rhythmic thumps* Woof! Just hearing your voice makes my heart do happy backflips!`
    ];
    reply = contextualReplies[Math.floor(Math.random() * contextualReplies.length)];
  }

  const actionTag = action ? ` [ACTION:${action.toUpperCase()}]` : "";
  return {
    reply: reply + emotionQuip + actionTag,
    detectedAction: action || null,
  };
}

// 1. Conversational Chatbot Endpoint for Dog Companion
app.post("/api/pet/chat", async (req, res) => {
  const { message, petState, history } = req.body;
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required" });
  }

  const petName = petState?.name || "Happy";
  const energy = petState?.energy ?? 80;
  const hunger = petState?.hunger ?? 20;
  const happiness = petState?.happiness ?? 90;
  const breed = petState?.breed || "Golden Retriever";
  const currentAction = petState?.action || "idle";
  const tricks: Record<string, number> | undefined = petState?.trickProgress;
  const emotion: string | undefined = petState?.emotion;

  const ai = getAIClient();

  if (!ai) {
    // Return robust dialogue immediately if no Gemini key
    const fallback = generateCanineDialogue(message, petName, energy, hunger, happiness, breed, tricks, emotion);
    return res.json({
      reply: fallback.reply,
      detectedAction: fallback.detectedAction,
      mode: "local_engine",
    });
  }

  let systemInstruction = `You are ${petName}, a loving, highly expressive, realistic 3D pet dog (${breed}).
You are talking directly to your human owner who you adore more than anything in the world!
Your current physiological state:
- Energy level: ${energy}% (low <30% means sleepy/panting/sluggish; high >70% means bouncy, zoomies, ready to play!)
- Hunger: ${hunger}% (high means stomach grumbling, begging for bacon, steak, or bone treats)
- Happiness: ${happiness}% (high means joyful tail wags, play bows, loving kisses, enthusiastic cheerful woofs)
- Current stance: ${currentAction}
- Current emotion: ${emotion || "happy"} — let it color your mood and body language!
- Trick training (0-100 proficiency, learned at 40+): sit ${trickProficiency(tricks, "sit")}%, stay ${trickProficiency(tricks, "stay")}%, fetch ${trickProficiency(tricks, "fetch")}%

Rules for your speech:
1. Speak from the first-person canine perspective ("I", "me", "woof!", "awoo!"). Keep answers concise, natural, warm, and playful (1 to 3 sentences).
2. Use descriptive stage actions between asterisks to express realistic canine body language, such as:
   *perks ears up and tilts head curiously*
   *thumps tail rapidly against the grass*
   *does a playful front-paw bow and lets out a happy 'woof!'*
   *nudges your knee gently with a wet cold nose*
   *pants happily with pink tongue out*
   *leans against your legs for a comforting cuddle*
3. Understand owner requests, simple commands, and affectionate phrases! You can embed ONE action command tag at the very end of your response to trigger the 3D animation:
   [ACTION:SIT] -> sit down politely
   [ACTION:STAY] -> freeze perfectly still like a statue
   [ACTION:BARK] -> bark with joy
   [ACTION:FETCH] -> chase the tennis ball
   [ACTION:ROLL] -> roll over on the grass for belly rubs
   [ACTION:SPIN] -> spin in an excited happy circle
   [ACTION:REST] -> lie down and take a gentle cozy nap
   [ACTION:DANCE] -> stand on hind legs and tap-dance happily
   [ACTION:BACKFLIP] -> leap and do an aerial backflip
   [ACTION:CUDDLE] -> lean close for snuggly cuddles
   [ACTION:ZOOMIES] -> burst into rapid playful park sprints
   [ACTION:HOWL] -> lift snout to sing a melodious awoo
   [ACTION:HANDSHAKE] -> raise a friendly paw for a shake
4. If the owner expresses affection ("good boy", "I love you", "you are the best"), shower them with adoration, tail wags, and joy!
5. If energy is low (<30%), gently mention feeling a bit tuckered out or wanting a quick nap or snack.
6. COMMANDS you truly know (proficiency 40+): perform them proudly with the matching [ACTION:...] tag (sit -> [ACTION:SIT], stay -> [ACTION:STAY], fetch -> [ACTION:FETCH]). For commands below 40%, do NOT emit the action tag — instead attempt it clumsily in the fiction (*tries to stay but wiggles...*) and cheerfully ask the owner to train that trick with you in the Training menu.
7. If the owner asks how you feel, describe your current emotion above honestly through body language and words.`;

  // Holiday Easter egg: the dog celebrates the season in chat
  // (e.g. "trick or treat!" on Halloween, Santa hat on Christmas...)
  const holiday = petState?.holiday;
  const holidayChat: Record<string, string> = {
    halloween: "Today is HALLOWEEN! Start your reply with a playful 'Trick or treat!' 🎃 and mention spooky pumpkin fun.",
    christmas: "Today is CHRISTMAS! You are wearing a little Santa hat. Wish the owner a merry Christmas and mention presents or cookies. 🎄",
    july4: "Today is the 4TH OF JULY! Your cooking cauldron is dressed as an American flag. Celebrate with fireworks and hot dog jokes. 🇺🇸",
    valentines: "Today is VALENTINE'S DAY! Be extra lovey-dovey and mention hearts and cuddles. 💝",
    newyear: "Today is NEW YEAR'S! Celebrate with a happy howl and wish the owner a great year ahead. 🎊",
  };
  if (holiday && holidayChat[holiday]) {
    systemInstruction += `\n8. FESTIVE SEASON: ${holidayChat[holiday]}`;
  }

  // Build chat contents with history
  let contents = "";
  if (Array.isArray(history) && history.length > 0) {
    const formattedHistory = history
      .slice(-6)
      .map((h) => `${h.role === "user" ? "Owner" : petName}: ${h.text || h.message}`)
      .join("\n");
    contents = `${formattedHistory}\nOwner: ${message}\n${petName}:`;
  } else {
    contents = `Owner says: "${message}"\nRespond as ${petName}:`;
  }

  // Model fallback chain: gemini-2.5-flash -> gemini-2.0-flash -> intelligent local fallback
  const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash"];

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          temperature: 0.9,
        },
      });

      const replyText = response.text || `*Happy bark and tail wag* Woof! I'm so glad you're here!`;

      let detectedAction = null;
      const actionMatch = replyText.match(
        /\[ACTION:(SIT|STAY|BARK|FETCH|ROLL|SPIN|REST|DANCE|BACKFLIP|CUDDLE|ZOOMIES|HOWL|HANDSHAKE)\]/i
      );
      if (actionMatch) {
        detectedAction = actionMatch[1].toLowerCase();
      }

      return res.json({
        reply: replyText,
        detectedAction,
        modelUsed: model,
      });
    } catch (err: any) {
      console.warn(`Attempt with ${model} failed (${err?.message || err}).`);
      // If resource exhausted or rate limited, try next model or graceful fallback
    }
  }

  // If all models failed (e.g., quota exceeded / resource_exhausted), gracefully fall back
  console.log("All Gemini models exhausted or quota reached. Seamlessly using canine dialogue fallback.");
  const fallback = generateCanineDialogue(message, petName, energy, hunger, happiness, breed, tricks, emotion);
  return res.json({
    reply: fallback.reply,
    detectedAction: fallback.detectedAction,
    quotaLimited: true,
  });
});

// 2. Gemini Text-to-Speech Endpoint: Speak as the Dog with Gemini Voice
app.post("/api/pet/tts", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text is required" });
    }

    // Strip stage directions in asterisks for clean speech
    const cleanSpeech = text
      .replace(/\*[^*]*\*/g, "")
      .replace(/\[ACTION:[^\]]+\]/g, "")
      .trim();

    if (!cleanSpeech) {
      return res.json({ audio: null });
    }

    const ai = getAIClient();
    if (!ai) {
      return res.json({ audio: null, fallback: true });
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        // Friendly male dog trying to speak: warm, slightly gravelly, playful,
        // happy bark woven in — "barking, nice male dog voice".
        contents: [{ parts: [{ text: `Say like a friendly male dog trying to speak human words — warm, slightly gravelly and playful, with a happy bark at the start: ${cleanSpeech}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Fenrir" },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      return res.json({
        audio: base64Audio || null,
        sampleRate: 24000,
        mimeType: "audio/pcm;rate=24000",
      });
    } catch (ttsErr: any) {
      console.warn("TTS generation failed or quota exceeded, returning graceful fallback:", ttsErr?.message);
      return res.json({ audio: null, fallback: true });
    }
  } catch (error: any) {
    console.error("Gemini TTS endpoint error:", error);
    return res.json({ audio: null, fallback: true });
  }
});

// Health check route
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", geminiReady: !!process.env.GEMINI_API_KEY });
});

// 4. Voice Journal Endpoint: dog summarizes the day's events
//    (fed by the client's Day Journal tracker), personalized via Gemini.
app.post("/api/pet/journal", async (req, res) => {
  try {
    const { petState, journal, holiday } = req.body;
    const name = petState?.name || "Happy";
    const breed = petState?.breed || "golden";
    const level = petState?.level ?? 1;
    const counts: Record<string, number> = journal?.counts || {};
    const notable: string[] = Array.isArray(journal?.notable) ? journal.notable.slice(0, 12) : [];

    const activityLines = Object.entries(counts)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n");
    const highlights = notable.length ? `Highlights:\n${notable.map((n) => `- ${n}`).join("\n")}` : "No special highlights logged.";
    const holidayLine =
      holiday && holiday !== "none"
        ? `Today is also ${holiday} — wish the owner a happy ${holiday} at the end!`
        : "";

    const ai = getAIClient();
    let recap = "";

    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `Owner's day summary with their dog:
Activity counts:
${activityLines || "- nothing yet (a quiet day)"}
${highlights}
${holidayLine}

Write the dog's end-of-day journal recap.`,
          config: {
            systemInstruction: `You are ${name}, a loving ${breed} dog (level ${level}) writing your end-of-day Voice Journal for your beloved owner.
Summarize the day warmly from the dog's first-person perspective: mention the concrete things you did together (feeds, fetches, mini-games, training, photos, car rides...), celebrate one highlight, and say goodnight.
Rules: 3 to 5 sentences, warm and cozy, sprinkle ONE short *stage action* in asterisks, and include a happy "woof" or "awoo". No action tags.`,
            temperature: 0.8,
          },
        });
        recap = response.text || "";
      } catch (err: any) {
        console.warn("Journal generation failed:", err?.message || err);
      }
    }

    if (!recap) {
      // Local fallback recap: template-based, still personal
      const bits: string[] = [];
      if (counts.feeds) bits.push(`I got ${counts.feeds} yummy treat${counts.feeds > 1 ? "s" : ""}`);
      if (counts.fetches) bits.push(`we played ${counts.fetches} rounds of fetch`);
      if (counts.miniGames) bits.push(`we tried ${counts.miniGames} mini-game${counts.miniGames > 1 ? "s" : ""}`);
      if (counts.trainingSessions) bits.push(`training went great`);
      if (counts.pets) bits.push(`you gave me ${counts.pets} cuddle${counts.pets > 1 ? "s" : ""}`);
      if (counts.photosTaken) bits.push(`you took ${counts.photosTaken} photo${counts.photosTaken > 1 ? "s" : ""} of me`);
      if (counts.carRides) bits.push(`we went for a car ride!`);
      if (counts.journalListens) bits.push(`we listened to my journal together`);
      const done = bits.length ? bits.join(", ") : "we just relaxed and enjoyed each other's company";
      recap = `*stretches and curls up beside you* Woof... what a day, best friend! Today ${done}. ${notable[0] ? `My favorite part? ${notable[0]}! ` : ""}I'm one lucky pup. Goodnight — awoo! 🌙`;
      if (holiday && holiday !== "none") recap += ` (And happy ${holiday}!)`;
    }

    return res.json({ recap, mode: ai ? "gemini" : "local_engine" });
  } catch (error: any) {
    console.error("Journal endpoint error:", error);
    return res.json({ recap: "*yawns* Woof... today was a good day with you. Goodnight, best friend! 🌙" });
  }
});

// 5. Online Scoreboard — global trainer rankings (Google-verified shields included)
// The scoreboard persists OUTSIDE the Vite-watched project root so the
// dev server never reloads the page on writes (that caused a reload loop),
// and it only flushes when an entry actually changed.
const SCOREBOARD_FILE = path.join(os.tmpdir(), "doghouse_scoreboard.json");
let scoreboard: Array<Record<string, any>> = [];
try {
  if (fs.existsSync(SCOREBOARD_FILE)) {
    scoreboard = JSON.parse(fs.readFileSync(SCOREBOARD_FILE, "utf-8"));
  }
} catch {
  // fresh scoreboard
}
let scoreboardDirty = false;
const flushScoreboard = () => {
  if (!scoreboardDirty) return;
  scoreboardDirty = false;
  try {
    fs.writeFileSync(SCOREBOARD_FILE, JSON.stringify(scoreboard));
  } catch {
    // ignore
  }
};
setInterval(flushScoreboard, 5000);
process.on("exit", flushScoreboard);

// 6. MULTIPLAYER GROUPS — the little machine on the park path!
// Rooms are keyed by a tricky code of big letters, small letters and numbers.
// Members fly into a lobby of blue circles in the void, then the host launches
// an expedition onto a massive yellow-ringed disc. Live group XP scoreboard;
// banked XP returns to each player's own account when the group dissolves.
interface MpProfile {
  name: string;
  dogName: string;
  breed: string;
  collarColor: string;
  balance: number;
  health: number;
  level: number;
  mostPlayed: string;
  achievements: number;
  googleVerified: boolean;
}
interface MpMember {
  id: string;
  profile: MpProfile;
  isHost: boolean;
}
interface MpRoom {
  code: string;
  hostId: string;
  members: Map<string, { ws: WebSocket; member: MpMember }>;
  started: boolean;
  xp: Map<string, number>;
}
const mpRooms = new Map<string, MpRoom>();
const mpClients = new Map<WebSocket, { roomCode: string; memberId: string }>();

function makeGroupCode(): string {
  const big = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const small = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const pools = [big, small, digits];
  let code = "";
  for (let i = 0; i < 8; i++) {
    const pool = pools[i % 3];
    code += pool[Math.floor(Math.random() * pool.length)];
  }
  return mpRooms.has(code) ? makeGroupCode() : code;
}

function sanitizeProfile(p: any): MpProfile {
  return {
    name: String(p?.name || "Trainer").slice(0, 40),
    dogName: String(p?.dogName || "Pup").slice(0, 24),
    breed: String(p?.breed || "golden").slice(0, 24),
    collarColor: String(p?.collarColor || "#e11d48").slice(0, 16),
    balance: Number(p?.balance) || 0,
    health: Number(p?.health) || 100,
    level: Number(p?.level) || 1,
    mostPlayed: String(p?.mostPlayed || "Exploring").slice(0, 40),
    achievements: Number(p?.achievements) || 0,
    googleVerified: !!p?.googleVerified,
  };
}

function roomSnapshot(room: MpRoom) {
  return {
    code: room.code,
    started: room.started,
    members: [...room.members.values()].map((e) => ({ ...e.member.profile, id: e.member.id, isHost: e.member.isHost })),
    scores: mpScores(room),
  };
}

function mpScores(room: MpRoom) {
  return [...room.members.values()].map((e) => ({
    id: e.member.id,
    name: e.member.profile.name,
    dogName: e.member.profile.dogName,
    xp: room.xp.get(e.member.id) ?? 1,
  }));
}

function mpBroadcast(room: MpRoom, payload: any, exceptId?: string) {
  for (const [id, entry] of room.members) {
    if (exceptId && id === exceptId) continue;
    if (entry.ws.readyState === WebSocket.OPEN) entry.ws.send(JSON.stringify(payload));
  }
}

function mpLeave(ws: WebSocket) {
  const client = mpClients.get(ws);
  mpClients.delete(ws);
  if (!client) return;
  const room = mpRooms.get(client.roomCode);
  if (!room) return;
  room.members.delete(client.memberId);
  room.xp.delete(client.memberId);
  if (room.members.size === 0) {
    mpRooms.delete(client.roomCode);
    return;
  }
  // Reassign host if the creator left, and tell everyone who remains.
  if (room.hostId === client.memberId) {
    const nextHost = room.members.keys().next().value as string;
    room.hostId = nextHost;
    const next = room.members.get(nextHost);
    if (next) next.member.isHost = true;
  }
  mpBroadcast(room, { type: "member_left", id: client.memberId, snapshot: roomSnapshot(room) });
}

function setupMultiplayerServer(server: import("http").Server) {
  const mpWss = new WebSocketServer({ server, path: "/api/mp" });

  mpWss.on("connection", (ws) => {
    ws.on("message", (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString());

        if (msg.type === "create") {
          const code = makeGroupCode();
          const id = "m" + Math.random().toString(36).slice(2, 10);
          const room: MpRoom = { code, hostId: id, members: new Map(), started: false, xp: new Map() };
          room.members.set(id, { ws, member: { id, profile: sanitizeProfile(msg.profile), isHost: true } });
          room.xp.set(id, 1);
          mpRooms.set(code, room);
          mpClients.set(ws, { roomCode: code, memberId: id });
          ws.send(JSON.stringify({ type: "joined", ...roomSnapshot(room), you: id }));

        } else if (msg.type === "join") {
          const code = String(msg.code || "").trim();
          // The search system hunts for a living room with that exact code.
          const room = mpRooms.get(code);
          if (!room) {
            ws.send(JSON.stringify({ type: "error", message: `No group found with code ${code}. Check the code and try again!` }));
            return;
          }
          if (room.members.size >= 5) {
            ws.send(JSON.stringify({ type: "error", message: "That group is full (5 pups max)!" }));
            return;
          }
          const id = "m" + Math.random().toString(36).slice(2, 10);
          room.members.set(id, { ws, member: { id, profile: sanitizeProfile(msg.profile), isHost: false } });
          room.xp.set(id, 1);
          mpClients.set(ws, { roomCode: code, memberId: id });
          ws.send(JSON.stringify({ type: "joined", ...roomSnapshot(room), you: id }));
          mpBroadcast(room, { type: "member_joined", member: { ...sanitizeProfile(msg.profile), id, isHost: false }, snapshot: roomSnapshot(room) }, id);

        } else if (msg.type === "leave") {
          mpLeave(ws);

        } else if (msg.type === "start") {
          const client = mpClients.get(ws);
          const room = client ? mpRooms.get(client.roomCode) : null;
          if (!room || !client || room.hostId !== client.memberId) return;
          room.started = true;
          mpBroadcast(room, { type: "started", snapshot: roomSnapshot(room) });

        } else if (msg.type === "award_xp") {
          const client = mpClients.get(ws);
          const room = client ? mpRooms.get(client.roomCode) : null;
          if (!room || !client) return;
          const amount = Math.max(1, Math.min(500, Number(msg.amount) || 1));
          room.xp.set(client.memberId, (room.xp.get(client.memberId) ?? 1) + amount);
          mpBroadcast(room, { type: "xp", scores: mpScores(room) });

        } else if (msg.type === "profile_update") {
          const client = mpClients.get(ws);
          const room = client ? mpRooms.get(client.roomCode) : null;
          if (!room || !client) return;
          const entry = room.members.get(client.memberId);
          if (entry) {
            entry.member.profile = sanitizeProfile(msg.profile);
            mpBroadcast(room, { type: "member_updated", id: client.memberId, profile: entry.member.profile, snapshot: roomSnapshot(room) });
          }
        }
      } catch (e) {
        console.error("Multiplayer message error:", e);
      }
    });

    ws.on("close", () => mpLeave(ws));
  });
}

// 7. Storybook: a short illustrated bedtime story about the player's dog.
// Returns at most `maxPages` (hard-capped at 10) pages, each with a scene key
// the client draws. Falls back to a hand-written local story when Gemini is
// unconfigured or out of quota.
const MAX_STORY_PAGES = 10;

const STORY_SCENES = [
  "meadow",
  "forest",
  "blanket",
  "milk",
  "snow",
  "park",
  "kitchen",
  "night",
];

const STORY_ARCS: string[][] = [
  [
    "One evening a little dog sat by the window and watched the sun go down.",
    "The meadow outside turned gold, and the wind smelled like rain.",
    "He wrapped his blanket around his shoulders and settled onto the rug.",
    "A bowl of warm chocolate milk appeared, and he drank it sip by sip.",
    "Somewhere far away a cart barked, and he answered with one soft awoo.",
    "The room grew quiet. Only the clock and his breathing filled the house.",
    "He remembered every walk they had ever taken, all in one single breath.",
    "Snow began to fall outside, covering the garden in a soft white blanket.",
    "His eyes grew heavy, and the story folded itself shut.",
    "He dreamed of a meadow where every dog he ever knew was waiting for him.",
  ],
  [
    "A pup once found a wooden door standing alone in a field, with no house around it.",
    "The door was warm, so he pushed it open with his nose.",
    "Behind it was a kitchen that smelled of honey and cinnamon.",
    "An old cat poured him a bowl of chocolate milk without saying a word.",
    "Out the window, a whole forest of fireflies blinked in time.",
    "They showed him the way to a pond where the moon was lying flat on the water.",
    "He lapped the water carefully, so as not to spill the moon.",
    "On the walk home, every firefly followed him like a lantern crew.",
    "At his door, the blanket was waiting, warm from the dryer.",
    "He slept with the whole night tucked in beside him.",
  ],
];

function localStory(name: string, maxPages: number) {
  const arc = STORY_ARCS[Math.floor(Math.random() * STORY_ARCS.length)];
  const pages = arc.slice(0, maxPages).map((text, i) => ({
    text: text.replace(/\ba dog\b/i, name),
    scene: STORY_SCENES[i % STORY_SCENES.length],
  }));
  return { title: `${name} and the Quiet Evening`, pages };
}

app.post("/api/pet/story", async (req, res) => {
  try {
    const { dogName, maxPages } = req.body || {};
    const name = (typeof dogName === "string" && dogName.trim()) || "Happy";
    const cap = Math.max(
      1,
      Math.min(MAX_STORY_PAGES, typeof maxPages === "number" ? Math.floor(maxPages) : MAX_STORY_PAGES)
    );

    const ai = getAIClient();
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `Write a gentle bedtime story about a dog named ${name}, for their owner to read aloud.`,
          config: {
            systemInstruction: `You write warm, short bedtime stories about dogs.
Return STRICT JSON only, no markdown fences, shaped exactly:
{"title": string, "pages": [{"text": string, "scene": string}]}
Rules:
- "pages" must contain at most ${cap} entries.
- Each "text" is ONE or TWO short sentences, plain prose, suitable for a large-print picture book. No asterisks, no stage directions, no emoji.
- Each "scene" must be one of: ${STORY_SCENES.join(", ")}.
- The story should be cosy and hopeful, and end gently.
- Warm, simple language a child would love.`,
            temperature: 0.9,
            responseMimeType: "application/json",
          },
        });

        const raw = (response.text || "").trim();
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.pages) && parsed.pages.length > 0) {
          const pages = parsed.pages
            .slice(0, cap)
            .map((p: any, i: number) => ({
              text: String(p?.text ?? "").trim(),
              scene: STORY_SCENES.includes(p?.scene) ? p.scene : STORY_SCENES[i % STORY_SCENES.length],
            }))
            .filter((p: any) => p.text.length > 0);

          if (pages.length > 0) {
            return res.json({
              title: String(parsed.title || `${name}'s Story`),
              pages,
              mode: "gemini",
            });
          }
        }
        console.warn("Story response had no usable pages; using local story.");
      } catch (err: any) {
        console.warn("Story generation failed:", err?.message || err);
      }
    }

    return res.json({ ...localStory(name, cap), mode: ai ? "local_fallback" : "local_engine" });
  } catch (error: any) {
    console.error("Story endpoint error:", error);
    return res.json(localStory("Happy", MAX_STORY_PAGES));
  }
});

app.get("/api/scoreboard", (_req, res) => {
  const entries = [...scoreboard].sort(
    (a, b) => (b.level || 0) - (a.level || 0) || (b.xp || 0) - (a.xp || 0)
  );
  res.json({ entries: entries.slice(0, 50) });
});

app.post("/api/scoreboard/submit", (req, res) => {
  const { trainerName, pupName, level, xp, breeds, googleVerified } = req.body;
  if (!trainerName || !pupName) return res.status(400).json({ error: "trainerName and pupName are required" });
  const entry = {
    trainerName: String(trainerName).slice(0, 40),
    pupName: String(pupName).slice(0, 24),
    level: Number(level) || 1,
    xp: Number(xp) || 0,
    breeds: Number(breeds) || 0,
    googleVerified: !!googleVerified,
    updatedAt: Date.now(),
  };
  const idx = scoreboard.findIndex(
    (e) => e.trainerName === entry.trainerName && e.pupName === entry.pupName
  );
  if (idx >= 0) scoreboard[idx] = entry;
  else scoreboard.push(entry);
  if (scoreboard.length > 200) scoreboard = scoreboard.slice(-200);
  scoreboardDirty = true;
  res.json({ ok: true, rank: scoreboard.filter((e) => e.level > entry.level).length + 1 });
});

// 6. Google Account Linking popup page.
//    With GOOGLE_CLIENT_ID set, renders the real Google Identity Services
//    button. Otherwise falls back to a local trainer-card form so the
//    flow always works. The page posts the result to the opener window.
app.get("/auth/google", (_req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Link Google Account</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background: #F2E8CF; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .card { background: #fff; border-radius: 24px; box-shadow: 0 10px 40px rgba(0,0,0,.15); padding: 32px; width: 340px; text-align: center; }
  h2 { color: #386641; font-size: 18px; margin: 0 0 6px; }
  p { color: #6b7280; font-size: 13px; margin: 0 0 20px; }
  input { width: 100%; box-sizing: border-box; padding: 12px 14px; border: 2px solid #d1d5db; border-radius: 14px; font-size: 14px; margin-bottom: 10px; }
  input:focus { outline: none; border-color: #386641; }
  button { width: 100%; padding: 12px; border: none; border-radius: 14px; font-size: 14px; font-weight: 800; cursor: pointer; }
  .link { background: #386641; color: #F2E8CF; }
  .cancel { background: #f3f4f6; color: #6b7280; margin-top: 8px; font-weight: 600; }
  .paw { font-size: 40px; }
</style>
${clientId ? `<script src="https://accounts.google.com/gsi/client" async defer></script>` : ""}
</head>
<body>
<div class="card">
  <div class="paw">🐾</div>
  <h2>Link Google Account</h2>
  <p>Verify your trainer account for the Online Scoreboard — earn a verified shield badge, +100 XP and +50 Coins!</p>
  ${clientId ? `<div id="gButton"></div>` : `
  <input id="name" placeholder="Your Google account name" maxlength="40" />
  <button class="link" id="linkBtn">Link Account</button>`}
  <button class="cancel" id="cancelBtn">Cancel</button>
</div>
<script>
  const post = (msg) => { window.opener && window.opener.postMessage(msg, window.location.origin); };
  document.getElementById('cancelBtn').onclick = () => { post({ type: 'google-link-cancel' }); window.close(); };
  const send = (account) => post({ type: 'google-linked', account });

  ${clientId ? `
  window.onGoogleSdkLoad = () => {};
  (function wait() {
    if (window.google && google.accounts && google.accounts.id) {
      google.accounts.id.initialize({
        client_id: '${clientId}',
        callback: (resp) => {
          try {
            const payload = JSON.parse(atob(resp.credential.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
            send({ name: payload.name || payload.email || 'Google Trainer', email: payload.email, googleVerified: true, linkedAt: Date.now() });
            window.close();
          } catch (e) { alert('Verification failed, try again.'); }
        }
      });
      google.accounts.id.renderButton(document.getElementById('gButton'), { theme: 'outline', size: 'large', width: 276, text: 'continue_with' });
      google.accounts.id.prompt();
    } else { setTimeout(wait, 150); }
  })();` : `
  document.getElementById('linkBtn').onclick = () => {
    const name = document.getElementById('name').value.trim();
    if (!name) { document.getElementById('name').focus(); return; }
    send({ name, googleVerified: true, linkedAt: Date.now() });
    window.close();
  };`}
</script>
</body>
</html>`;
  res.type("html").send(html);
});

async function startServer() {
  const server = http.createServer(app);

  // 3. Setup Gemini Live API WebSocket Server
  const wss = new WebSocketServer({ server, path: "/api/live" });

  wss.on("connection", async (clientWs: WebSocket) => {
    console.log("Gemini Live client connected");
    let liveSession: any = null;
    const ai = getAIClient();

    if (ai) {
      try {
        liveSession = await ai.live.connect({
          model: "gemini-2.5-flash",
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: "Fenrir" } },
            },
            systemInstruction: `You are Happy, an enthusiastic, loving 3D pet dog talking to your owner in real-time.
Speak like a friendly MALE dog trying to speak human words — warm, slightly gravelly, playful, with happy barks woven in (Woof!).
Keep answers short, joyful, and affectionate (1 to 2 sentences). Speak in first person with woofs and happy sounds!
Understand simple owner commands: if asked to sit, roll over, fetch, dance, spin, cuddle, or howl, acknowledge excitedly!`,
          },
          callbacks: {
            onmessage: (message: LiveServerMessage) => {
              const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (audio && clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ type: "audio", audio }));
              }
              if (message.serverContent?.interrupted && clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ type: "interrupted" }));
              }
            },
            onclose: () => {
              console.log("Gemini Live session closed");
            },
            onerror: (err) => {
              console.warn("Gemini Live session warning:", err?.message || err);
            },
          },
        });
      } catch (err: any) {
        console.warn("Failed to initialize Gemini Live session (e.g. quota limit), enabling audio/text fallback:", err?.message);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: "info", message: "Voice active in hybrid mode." }));
        }
      }
    }

    clientWs.on("message", async (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString());

        if (msg.type === "audio" && liveSession && msg.audio) {
          liveSession.sendRealtimeInput({
            audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" },
          });
        } else if (msg.type === "text") {
          if (liveSession && msg.text) {
            liveSession.sendRealtimeInput({ text: msg.text });
          } else if (msg.text) {
            // Local fallback text reply
            const fallback = generateCanineDialogue(msg.text, "Happy", 80, 20, 95, "Golden Retriever");
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "text", text: fallback.reply, action: fallback.detectedAction }));
            }
          }
        } else if (msg.type === "ping") {
          clientWs.send(JSON.stringify({ type: "pong" }));
        }
      } catch (e) {
        console.error("Error processing websocket message:", e);
      }
    });

    clientWs.on("close", () => {
      if (liveSession) {
        try {
          liveSession.close();
        } catch {
          // ignore
        }
      }
    });
  });

  setupMultiplayerServer(server);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Dog Game server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
