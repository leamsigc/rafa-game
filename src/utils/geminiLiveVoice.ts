/**
 * Gemini Live Voice & Audio Streaming Manager
 * Connects to Gemini Live API via WebSocket and handles raw PCM input (16kHz) and output (24kHz)
 */

// Convert Float32Array to 16-bit PCM little-endian Base64
export function floatTo16BitPCM(float32Array: Float32Array): string {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Play raw PCM audio chunk (24kHz little-endian 16-bit PCM)
let outputAudioCtx: AudioContext | null = null;
let nextStartTime = 0;

export function getOutputAudioContext(): AudioContext {
  if (!outputAudioCtx || outputAudioCtx.state === "closed") {
    outputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000,
    });
  }
  if (outputAudioCtx.state === "suspended") {
    outputAudioCtx.resume();
  }
  return outputAudioCtx;
}

export function playPcmAudioChunk(base64Data: string, onEnded?: () => void) {
  try {
    const ctx = getOutputAudioContext();
    const binary = atob(base64Data);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }

    const audioBuffer = ctx.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startTime = Math.max(now, nextStartTime);
    source.start(startTime);
    nextStartTime = startTime + audioBuffer.duration;

    if (onEnded) {
      source.onended = onEnded;
    }
  } catch (err) {
    console.warn("Failed to play PCM audio chunk", err);
  }
}

export function resetAudioSchedule() {
  if (outputAudioCtx) {
    nextStartTime = outputAudioCtx.currentTime;
  }
}

export class GeminiLiveSession {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private isConnected = false;
  private isMicActive = false;

  public onAudioReceived?: (base64Audio: string) => void;
  public onTextReceived?: (text: string) => void;
  public onInterrupted?: () => void;
  public onError?: (err: any) => void;
  public onStatusChange?: (active: boolean) => void;

  constructor() {
    // Setup handlers
  }

  public async start(): Promise<boolean> {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/live`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.onStatusChange?.(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "audio" && msg.audio) {
            playPcmAudioChunk(msg.audio);
            this.onAudioReceived?.(msg.audio);
          } else if (msg.type === "text" && msg.text) {
            this.onTextReceived?.(msg.text);
          } else if (msg.type === "interrupted") {
            resetAudioSchedule();
            this.onInterrupted?.();
          }
        } catch (e) {
          console.error("Error parsing Live message:", e);
        }
      };

      this.ws.onerror = (e) => {
        console.warn("WebSocket error:", e);
        this.onError?.(e);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.onStatusChange?.(false);
      };

      // Start Microphone stream at 16kHz
      await this.startMicrophone();
      return true;
    } catch (e) {
      console.warn("Could not start Gemini Live session:", e);
      return false;
    }
  }

  private async startMicrophone() {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      this.inputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });

      const source = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
      this.processor = this.inputAudioCtx.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const base64Pcm = floatTo16BitPCM(inputData);
        this.ws.send(JSON.stringify({ type: "audio", audio: base64Pcm }));
      };

      source.connect(this.processor);
      this.processor.connect(this.inputAudioCtx.destination);
      this.isMicActive = true;
    } catch (err) {
      console.warn("Microphone not granted or not supported:", err);
    }
  }

  public sendText(text: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "text", text }));
    }
  }

  public stop() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.inputAudioCtx && this.inputAudioCtx.state !== "closed") {
      this.inputAudioCtx.close();
      this.inputAudioCtx = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.isMicActive = false;
    this.onStatusChange?.(false);
  }
}
