import express from "express";
import http from "http";
import path from "path";
import dotenv from "dotenv";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

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
function generateCanineDialogue(
  message: string,
  petName: string,
  energy: number,
  hunger: number,
  happiness: number,
  breed: string
): { reply: string; detectedAction: string | null } {
  const lower = message.toLowerCase();
  let reply = "";
  let action = "";

  if (lower.includes("sit") || lower.includes("stay")) {
    reply = `*Sits down promptly on the grass, looking up at you with attentive shining eyes* Woof! Look, I'm sitting like the best boy! Do I get a yummy treat now?`;
    action = "sit";
  } else if (lower.includes("fetch") || lower.includes("ball") || lower.includes("throw") || lower.includes("play")) {
    reply = `*Eyes widen at the magic word, ears perked high* BALL?! Did you say play?! *Bounces on front paws* Throw it, throw it, I'm ready to zoom!`;
    action = "fetch";
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
    reply: reply + actionTag,
    detectedAction: action || null,
  };
}

// 1. Conversational Chatbot Endpoint for Dog Companion
app.post("/api/pet/chat", async (req, res) => {
  const { message, petState, history } = req.body;
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required" });
  }

  const petName = petState?.name || "Buddy";
  const energy = petState?.energy ?? 80;
  const hunger = petState?.hunger ?? 20;
  const happiness = petState?.happiness ?? 90;
  const breed = petState?.breed || "Golden Retriever";
  const currentAction = petState?.action || "idle";

  const ai = getAIClient();

  if (!ai) {
    // Return robust dialogue immediately if no Gemini key
    const fallback = generateCanineDialogue(message, petName, energy, hunger, happiness, breed);
    return res.json({
      reply: fallback.reply,
      detectedAction: fallback.detectedAction,
      mode: "local_engine",
    });
  }

  const systemInstruction = `You are ${petName}, a loving, highly expressive, realistic 3D pet dog (${breed}).
You are talking directly to your human owner who you adore more than anything in the world!
Your current physiological state:
- Energy level: ${energy}% (low <30% means sleepy/panting/sluggish; high >70% means bouncy, zoomies, ready to play!)
- Hunger: ${hunger}% (high means stomach grumbling, begging for bacon, steak, or bone treats)
- Happiness: ${happiness}% (high means joyful tail wags, play bows, loving kisses, enthusiastic cheerful woofs)
- Current stance: ${currentAction}

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
5. If energy is low (<30%), gently mention feeling a bit tuckered out or wanting a quick nap or snack.`;

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
        /\[ACTION:(SIT|BARK|FETCH|ROLL|SPIN|REST|DANCE|BACKFLIP|CUDDLE|ZOOMIES|HOWL|HANDSHAKE)\]/i
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
  const fallback = generateCanineDialogue(message, petName, energy, hunger, happiness, breed);
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
        contents: [{ parts: [{ text: `Say with happy, playful, energetic puppy enthusiasm: ${cleanSpeech}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Puck" },
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
              voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
            },
            systemInstruction: `You are Buddy, an enthusiastic, loving 3D pet dog talking to your owner in real-time.
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
            const fallback = generateCanineDialogue(msg.text, "Buddy", 80, 20, 95, "Golden Retriever");
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
