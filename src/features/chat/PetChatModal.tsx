import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Sparkles,
  X,
  Volume2,
  VolumeX,
  MessageSquare,
  Heart,
  Mic,
  MicOff,
  Radio,
  Play,
} from "lucide-react";
import { ChatMessage, DogAction, PetStats } from "../../types/pet";
import { sound } from "../../utils/audio";
import dogAvatar from "../../assets/images/dog_avatar_1788547305164.jpg";
import {
  GeminiLiveSession,
  playPcmAudioChunk,
  resetAudioSchedule,
} from "../../utils/geminiLiveVoice";

interface PetChatModalProps {
  petStats: PetStats;
  onClose: () => void;
  onTriggerDogAction: (action: DogAction) => void;
}

const QUICK_PROMPTS = [
  "I love you so much! ❤️",
  "Who's the best boy? 🏆",
  "Sit and stay! 🐾",
  "Can you do a backflip? 🤸",
  "Let's cuddle up! 🧸",
  "Sing a happy howl! 🎶",
  "Roll over for belly rubs! 🔄",
  "Do a tap dance! 🕺",
  "Do you want a steak treat? 🥩",
  "Let's play fetch! 🎾",
  "How are you feeling right now? 🐶",
];

export const PetChatModal: React.FC<PetChatModalProps> = ({
  petStats,
  onClose,
  onTriggerDogAction,
}) => {
  const [activeTab, setActiveTab] = useState<"chat" | "live">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial",
      sender: "dog",
      text: `*Perks up floppy ears eagerly, smiling with a happy tail wag* Woof! Hey best friend! I'm ${petStats.name}! What are we going to do together today?`,
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [speechEnabled, setSpeechEnabled] = useState<boolean>(true);

  // Gemini Live Voice State
  const [isLiveActive, setIsLiveActive] = useState<boolean>(false);
  const [liveStatusText, setLiveStatusText] = useState<string>("Ready to talk");
  const [isDogSpeaking, setIsDogSpeaking] = useState<boolean>(false);

  const liveSessionRef = useRef<GeminiLiveSession | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Clean up Live Session on unmount
  useEffect(() => {
    return () => {
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
        liveSessionRef.current = null;
      }
      resetAudioSchedule();
    };
  }, []);

  const speakWithGeminiVoice = async (text: string) => {
    if (!speechEnabled) {
      sound.playSoftWoof();
      return;
    }

    try {
      // Call Gemini TTS endpoint
      const res = await fetch("/api/pet/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audio) {
          playPcmAudioChunk(data.audio);
          return;
        }
      }
    } catch (e) {
      console.warn("Gemini TTS fetch error, fallback to browser synthesis:", e);
    }

    // Fallback: Web SpeechSynthesis
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        const cleanSpeech = text
          .replace(/\*[^*]*\*/g, "")
          .replace(/\[ACTION:[^\]]+\]/g, "")
          .trim();
        if (cleanSpeech) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(cleanSpeech);
          utterance.pitch = 1.35;
          utterance.rate = 1.05;
          window.speechSynthesis.speak(utterance);
          return;
        }
      } catch {
        // ignore
      }
    }

    sound.playSoftWoof();
  };

  const handleSendMessage = async (userPrompt?: string) => {
    const textToSend = (userPrompt || inputText).trim();
    if (!textToSend || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sender: "user",
      text: textToSend,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/pet/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          petState: {
            name: petStats.name,
            energy: petStats.energy,
            happiness: petStats.happiness,
            hunger: petStats.hunger,
            breed: petStats.breed,
          },
          history: messages.slice(-6).map((m) => ({
            role: m.sender,
            text: m.text,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Chat request failed");
      }

      const data = await response.json();
      const reply = data.reply || "*Happy bark and tail wag* Woof!";
      const detectedAction = data.detectedAction as DogAction | null;

      const dogMsg: ChatMessage = {
        id: `dog-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        sender: "dog",
        text: reply,
        timestamp: Date.now(),
        actionTriggered: detectedAction || undefined,
      };

      setMessages((prev) => [...prev, dogMsg]);
      speakWithGeminiVoice(reply);

      // Trigger 3D dog action in real-time
      if (detectedAction) {
        onTriggerDogAction(detectedAction);
      } else {
        sound.playSoftWoof();
      }
    } catch (err) {
      console.error("Dog chat error:", err);
      const fallbackMsg: ChatMessage = {
        id: `dog-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        sender: "dog",
        text: `*Tilts head and lets out a soft joyful woof* Woof! I always love hearing your voice, best friend!`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
      sound.playSoftWoof();
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle Gemini Live Voice Session
  const toggleGeminiLive = async () => {
    if (isLiveActive) {
      liveSessionRef.current?.stop();
      liveSessionRef.current = null;
      setIsLiveActive(false);
      setLiveStatusText("Live conversation paused");
      setIsDogSpeaking(false);
    } else {
      setLiveStatusText("Connecting to Gemini Live API...");
      const session = new GeminiLiveSession();

      session.onStatusChange = (active) => {
        setIsLiveActive(active);
        if (active) {
          setLiveStatusText(`Listening... Say "Buddy sit", "Who's a good boy", or "Dance!"`);
        }
      };

      session.onAudioReceived = () => {
        setIsDogSpeaking(true);
        setLiveStatusText(`${petStats.name} is speaking!`);
        setTimeout(() => setIsDogSpeaking(false), 2000);
      };

      session.onTextReceived = (text) => {
        // Detect action in live speech
        const lower = text.toLowerCase();
        if (lower.includes("sit")) onTriggerDogAction("sit");
        else if (lower.includes("roll")) onTriggerDogAction("roll");
        else if (lower.includes("dance")) onTriggerDogAction("dance");
        else if (lower.includes("backflip")) onTriggerDogAction("backflip");
        else if (lower.includes("cuddle")) onTriggerDogAction("cuddle");
        else if (lower.includes("spin")) onTriggerDogAction("spin");
        else if (lower.includes("zoom")) onTriggerDogAction("zoomies");
        else if (lower.includes("howl") || lower.includes("awoo")) onTriggerDogAction("howl");
        else if (lower.includes("paw") || lower.includes("shake")) onTriggerDogAction("handshake");
      };

      session.onError = () => {
        setLiveStatusText("Live voice ready via audio fallback.");
      };

      const success = await session.start();
      if (success) {
        liveSessionRef.current = session;
        setIsLiveActive(true);
      } else {
        setLiveStatusText("Microphone access needed for live streaming.");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#F2E8CF] border border-[#386641]/20 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden text-[#386641] flex flex-col h-[88vh] max-h-[660px]">
        {/* Chat Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#386641]/20 bg-[#386641] text-[#F2E8CF]">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={dogAvatar}
                alt={petStats.name}
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-full object-cover border-2 border-[#A7C957] shadow-sm"
              />
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#A7C957] border-2 border-[#386641] rounded-full" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white leading-none">{petStats.name}</h3>
                <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full bg-[#A7C957] text-[#386641]">
                  Gemini Live
                </span>
              </div>
              <p className="text-xs text-[#F2E8CF]/80 mt-0.5">
                Energy {petStats.energy}% • {petStats.happiness}% Joy • {petStats.hunger}% Hunger
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSpeechEnabled(!speechEnabled)}
              title={speechEnabled ? "Mute Voice" : "Enable Voice"}
              className="p-2 rounded-xl hover:bg-[#2c5234] text-[#F2E8CF] transition-colors cursor-pointer"
            >
              {speechEnabled ? (
                <Volume2 className="w-4 h-4 text-[#A7C957]" />
              ) : (
                <VolumeX className="w-4 h-4 text-[#F2E8CF]/50" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-[#2c5234] text-[#F2E8CF] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mode Selector (Live Voice Mode vs Text Chat) */}
        <div className="bg-[#e8dcb8] px-4 py-2 border-b border-[#386641]/15 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("chat")}
              className={`px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer ${
                activeTab === "chat"
                  ? "bg-[#386641] text-[#F2E8CF] shadow-xs"
                  : "bg-white/80 hover:bg-white text-[#386641]"
              }`}
            >
              Chat & Commands
            </button>
            <button
              onClick={() => {
                setActiveTab("live");
                if (!isLiveActive) toggleGeminiLive();
              }}
              className={`px-3 py-1 rounded-full text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "live"
                  ? "bg-[#BC4749] text-white shadow-xs"
                  : "bg-white/80 hover:bg-white text-[#386641]"
              }`}
            >
              <Radio className="w-3 h-3 animate-pulse" />
              <span>Gemini Live Voice</span>
            </button>
          </div>

          {activeTab === "live" && (
            <span className="text-[11px] font-bold text-[#386641] flex items-center gap-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  isLiveActive ? "bg-[#6A994E] animate-ping" : "bg-[#BC4749]"
                }`}
              />
              {isLiveActive ? "Live Connected" : "Off"}
            </span>
          )}
        </div>

        {/* LIVE VOICE MODE VIEW */}
        {activeTab === "live" ? (
          <div className="flex-1 flex flex-col items-center justify-between p-6 bg-[#F2E8CF]/80 text-center">
            <div className="max-w-xs space-y-2 mt-4">
              <div className="relative mx-auto w-24 h-24">
                {/* Glowing audio waveform ring */}
                {isLiveActive && (
                  <div className="absolute inset-0 rounded-full border-4 border-[#A7C957] animate-ping opacity-40 pointer-events-none" />
                )}
                {isDogSpeaking && (
                  <div className="absolute -inset-2 rounded-full border-4 border-[#BC4749] animate-pulse opacity-60 pointer-events-none" />
                )}
                <img
                  src={dogAvatar}
                  alt={petStats.name}
                  referrerPolicy="no-referrer"
                  className="w-24 h-24 rounded-full object-cover border-4 border-[#386641] shadow-xl relative z-10"
                />
              </div>

              <h3 className="text-base font-black text-[#386641]">{petStats.name} Live Voice</h3>
              <p className="text-xs font-medium text-[#386641]/80 leading-relaxed">
                {liveStatusText}
              </p>
            </div>

            {/* Audio Wave Visualizer Simulation */}
            <div className="flex items-center justify-center gap-1.5 h-12 my-4">
              {[40, 65, 90, 45, 80, 100, 70, 50, 85, 60, 40].map((h, i) => (
                <div
                  key={i}
                  className={`w-1.5 rounded-full transition-all duration-150 ${
                    isLiveActive
                      ? isDogSpeaking
                        ? "bg-[#BC4749]"
                        : "bg-[#386641]"
                      : "bg-[#386641]/20"
                  }`}
                  style={{
                    height: isLiveActive ? `${Math.max(12, (h * (isDogSpeaking ? 1 : 0.6)) / 2.2)}px` : "8px",
                  }}
                />
              ))}
            </div>

            {/* Interactive Voice Controls */}
            <div className="w-full space-y-3">
              <button
                onClick={toggleGeminiLive}
                className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm shadow-md flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer ${
                  isLiveActive
                    ? "bg-[#BC4749] hover:bg-[#a63a3c] text-white"
                    : "bg-[#386641] hover:bg-[#2c5234] text-[#F2E8CF]"
                }`}
              >
                {isLiveActive ? (
                  <>
                    <MicOff className="w-5 h-5" />
                    <span>Mute Microphone & Pause Live</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5" />
                    <span>Start Talking with {petStats.name}</span>
                  </>
                )}
              </button>

              <div className="text-[11px] text-[#386641]/70 font-semibold">
                Try saying: "Sit down", "Roll over", "Do a tap dance", or "Good boy!"
              </div>
            </div>
          </div>
        ) : (
          /* TEXT & COMMANDS STREAM */
          <>
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#F2E8CF]/60">
              {messages.map((m) => {
                const isDog = m.sender === "dog";
                return (
                  <div
                    key={m.id}
                    className={`flex gap-2.5 ${isDog ? "justify-start" : "justify-end"}`}
                  >
                    {isDog && (
                      <img
                        src={dogAvatar}
                        alt={petStats.name}
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-full object-cover border border-[#BC4749] shrink-0 self-end mb-1"
                      />
                    )}

                    <div
                      className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-xs ${
                        isDog
                          ? "bg-white text-[#386641] border border-[#386641]/15 rounded-tl-xs"
                          : "bg-[#386641] text-[#F2E8CF] font-medium rounded-tr-xs"
                      }`}
                    >
                      {/* Highlight canine stage actions italicized */}
                      {isDog ? (
                        <div>
                          {m.text.split(/(\*[^*]+\*)/g).map((segment, idx) => {
                            if (segment.startsWith("*") && segment.endsWith("*")) {
                              return (
                                <span
                                  key={`${m.id}-action-${idx}`}
                                  className="italic text-[#6A994E] block my-0.5 text-xs font-serif"
                                >
                                  {segment}
                                </span>
                              );
                            }
                            const clean = segment.replace(/\[ACTION:[^\]]+\]/g, "");
                            return <span key={`${m.id}-text-${idx}`}>{clean}</span>;
                          })}
                          {m.actionTriggered && (
                            <div className="flex items-center gap-1 text-[11px] font-bold text-[#386641] bg-[#A7C957]/40 border border-[#6A994E]/40 px-2 py-0.5 rounded-full mt-1.5 w-fit">
                              <Sparkles className="w-3 h-3 text-[#386641]" />
                              Triggered: {m.actionTriggered.toUpperCase()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span>{m.text}</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex gap-2.5 justify-start items-center">
                  <img
                    src={dogAvatar}
                    alt={petStats.name}
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-full object-cover border border-[#BC4749] shrink-0"
                  />
                  <div className="bg-white border border-[#386641]/15 rounded-2xl rounded-tl-xs px-3.5 py-2 text-xs text-[#386641] flex items-center gap-2 shadow-xs">
                    <span className="font-semibold">{petStats.name} is perking ears...</span>
                    <span className="flex gap-1">
                      <span
                        className="w-1.5 h-1.5 bg-[#6A994E] rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className="w-1.5 h-1.5 bg-[#6A994E] rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="w-1.5 h-1.5 bg-[#6A994E] rounded-full animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestion Chips (Affectionate Phrases & Commands) */}
            <div className="px-4 py-2 bg-[#F2E8CF] border-t border-[#386641]/15 flex gap-2 overflow-x-auto no-scrollbar">
              {QUICK_PROMPTS.map((prompt, i) => (
                <button
                  key={`quick-prompt-${i}-${prompt}`}
                  onClick={() => handleSendMessage(prompt)}
                  disabled={isLoading}
                  className="text-xs shrink-0 px-3 py-1.5 bg-white hover:bg-[#F2E8CF] active:bg-[#e8dcb8] text-[#386641] rounded-full border border-[#386641]/20 font-bold transition-colors shadow-xs cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 bg-[#F2E8CF] border-t border-[#386641]/15 flex items-center gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Talk to ${petStats.name}... (e.g. "Sit down", "I love you!")`}
                disabled={isLoading}
                className="flex-1 bg-white border border-[#386641]/25 rounded-xl px-4 py-2.5 text-sm text-[#386641] placeholder-[#386641]/50 focus:outline-none focus:border-[#386641] focus:ring-1 focus:ring-[#386641] transition-colors"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className={`p-2.5 rounded-xl font-bold flex items-center justify-center transition-all ${
                  inputText.trim() && !isLoading
                    ? "bg-[#386641] hover:bg-[#2c5234] text-[#F2E8CF] shadow-md cursor-pointer active:scale-95"
                    : "bg-[#386641]/20 text-[#386641]/40 cursor-not-allowed"
                }`}
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
