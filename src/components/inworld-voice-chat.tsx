"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AudioLines,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Sparkles,
} from "lucide-react";

type TranscriptItem = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

const REALTIME_URL = "https://api.inworld.ai/v1/realtime/calls";
const ICE_URL = "https://api.inworld.ai/v1/realtime/ice-servers";

export default function InworldVoiceChat() {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const assistantDraftRef = useRef("");

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const cleanup = useCallback(() => {
    channelRef.current?.close();
    peerRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioRef.current) audioRef.current.srcObject = null;
    channelRef.current = null;
    peerRef.current = null;
    streamRef.current = null;
    setMuted(false);
    setSpeaking(false);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const addTranscript = (role: TranscriptItem["role"], text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setTranscript((items) => [
      ...items,
      { id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`, role, text: clean },
    ]);
  };

  const handleRealtimeEvent = (event: Record<string, any>) => {
    if (event.type === "error") {
      setError(event.error?.message || "The voice service returned an error.");
      return;
    }

    if (event.type === "conversation.item.input_audio_transcription.completed") {
      addTranscript("user", event.transcript || "");
      return;
    }

    if (event.type === "response.output_audio_transcript.delta" || event.type === "response.output_text.delta") {
      assistantDraftRef.current += event.delta || "";
      setSpeaking(true);
      return;
    }

    if (event.type === "response.output_audio_transcript.done" || event.type === "response.output_text.done") {
      const finalText = event.transcript || event.text || assistantDraftRef.current;
      if (finalText) addTranscript("assistant", finalText);
      assistantDraftRef.current = "";
      setSpeaking(false);
      return;
    }

    if (event.type === "response.done") {
      if (assistantDraftRef.current.trim()) {
        addTranscript("assistant", assistantDraftRef.current);
        assistantDraftRef.current = "";
      }
      setSpeaking(false);
    }
  };

  const startConversation = async () => {
    setError(null);
    setStatus("connecting");

    try {
      const tokenResponse = await fetch("/api/inworld/token", {
        method: "POST",
        cache: "no-store",
      });
      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok || !tokenData.token) {
        throw new Error(tokenData.error || "Could not create a secure voice session.");
      }
      const token = tokenData.token as string;

      const iceResponse = await fetch(ICE_URL, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!iceResponse.ok) throw new Error("Could not load voice connection settings.");
      const iceData = await iceResponse.json();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const peer = new RTCPeerConnection({ iceServers: iceData.ice_servers || [] });
      peerRef.current = peer;
      stream.getAudioTracks().forEach((track) => peer.addTrack(track, stream));

      peer.ontrack = (event) => {
        if (!audioRef.current) return;
        audioRef.current.srcObject = new MediaStream([event.track]);
        void audioRef.current.play().catch(() => {
          setError("Your browser blocked audio playback. Tap Start conversation again.");
        });
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "connected") setStatus("connected");
        if (["failed", "disconnected", "closed"].includes(peer.connectionState)) {
          if (peer.connectionState !== "closed") {
            setError("The voice connection was interrupted. Please reconnect.");
            cleanup();
            setStatus("idle");
          }
        }
      };

      const channel = peer.createDataChannel("oai-events", { ordered: true });
      channelRef.current = channel;
      channel.onmessage = (message) => {
        try {
          handleRealtimeEvent(JSON.parse(message.data));
        } catch {
          // Ignore non-JSON provider messages.
        }
      };
      channel.onerror = () => setError("The voice event channel encountered an error.");

      channel.onopen = () => {
        setStatus("connected");
        channel.send(JSON.stringify({
          type: "session.update",
          session: {
            type: "realtime",
            model: "google-ai-studio/gemini-2.5-flash",
            instructions: "You are a helpful, natural, friendly voice assistant. Speak clearly and conversationally. Keep replies concise unless the user asks for detail. Do not claim to perform actions you cannot perform.",
            output_modalities: ["audio", "text"],
            audio: {
              input: {
                transcription: { model: "inworld/inworld-stt-1" },
                turn_detection: {
                  type: "semantic_vad",
                  eagerness: "medium",
                  create_response: true,
                  interrupt_response: true,
                },
              },
              output: {
                model: "inworld-tts-2-flash",
                voice: "Olivia",
              },
            },
          },
        }));
        channel.send(JSON.stringify({
          type: "response.speak",
          text: "Hi! I'm here. What would you like to talk about?",
        }));
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      await new Promise<void>((resolve, reject) => {
        if (peer.iceGatheringState === "complete") return resolve();
        const timeout = window.setTimeout(() => resolve(), 5000);
        const onStateChange = () => {
          if (peer.iceGatheringState === "complete") {
            window.clearTimeout(timeout);
            peer.removeEventListener("icegatheringstatechange", onStateChange);
            resolve();
          }
        };
        peer.addEventListener("icegatheringstatechange", onStateChange);
      });

      const callResponse = await fetch(REALTIME_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/sdp",
        },
        body: peer.localDescription?.sdp,
      });
      if (!callResponse.ok) {
        const detail = await callResponse.text();
        throw new Error(detail.slice(0, 220) || "Could not establish the voice session.");
      }
      await peer.setRemoteDescription({ type: "answer", sdp: await callResponse.text() });
    } catch (err) {
      cleanup();
      setStatus("error");
      setError(
        err instanceof Error
          ? err.message
          : "Unable to start the voice conversation. Check your microphone and try again.",
      );
    }
  };

  const endConversation = () => {
    cleanup();
    setStatus("idle");
  };

  const toggleMute = () => {
    const nextMuted = !muted;
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setMuted(nextMuted);
  };

  const isConnected = status === "connected";

  return (
    <main className="min-h-screen overflow-hidden bg-[#080a10] text-white selection:bg-cyan-400/30">
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_42%,rgba(34,211,238,0.10),transparent_38%),radial-gradient(ellipse_at_10%_90%,rgba(99,102,241,0.10),transparent_32%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
              <AudioLines size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[0.16em]">VOICE CHAT</p>
              <p className="text-xs text-white/40">Real-time voice assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/65">
            <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.8)]" : status === "connecting" ? "animate-pulse bg-amber-300" : "bg-white/25"}`} />
            {status === "connected" ? "Connected" : status === "connecting" ? "Connecting…" : status === "error" ? "Connection error" : "Ready"}
          </div>
        </header>

        <section className="grid flex-1 gap-8 py-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-9 grid h-56 w-56 place-items-center">
              <div className={`absolute inset-0 rounded-full border border-cyan-200/10 ${isConnected ? "animate-ping [animation-duration:3s]" : ""}`} />
              <div className={`absolute inset-5 rounded-full border border-cyan-200/15 ${isConnected ? "scale-105 shadow-[0_0_80px_rgba(34,211,238,.12)]" : ""} transition-all duration-700`} />
              <div className="grid h-36 w-36 place-items-center rounded-full border border-cyan-200/20 bg-[radial-gradient(circle_at_35%_25%,rgba(103,232,249,.25),rgba(8,145,178,.08)_55%,rgba(255,255,255,.02))] shadow-[0_0_90px_rgba(34,211,238,.12)]">
                {isConnected ? <AudioLines size={46} className={`text-cyan-100 ${speaking ? "animate-pulse" : ""}`} /> : <Sparkles size={42} className="text-cyan-100/80" />}
              </div>
            </div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.34em] text-cyan-200/70">Your voice, in real time</p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              {isConnected ? "I'm listening." : status === "connecting" ? "Connecting…" : "Let's talk."}
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/45">
              {isConnected
                ? "Speak naturally. You can interrupt whenever you want."
                : "Start a conversation with a voice assistant that listens and responds as you speak."}
            </p>

            <div className="mt-9 flex items-center gap-3">
              {isConnected ? (
                <>
                  <button onClick={toggleMute} className="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-white/[0.06] transition hover:bg-white/10" aria-label={muted ? "Unmute microphone" : "Mute microphone"}>
                    {muted ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                  <button onClick={endConversation} className="flex h-12 items-center gap-2 rounded-full bg-rose-500 px-6 text-sm font-medium text-white transition hover:bg-rose-400">
                    <PhoneOff size={17} /> End conversation
                  </button>
                </>
              ) : (
                <button onClick={startConversation} disabled={status === "connecting"} className="flex h-12 items-center gap-2 rounded-full bg-cyan-300 px-7 text-sm font-semibold text-[#071116] shadow-[0_8px_35px_rgba(34,211,238,.16)] transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60">
                  {status === "connecting" ? <AudioLines size={17} className="animate-pulse" /> : <Phone size={17} />}
                  {status === "connecting" ? "Connecting…" : "Start conversation"}
                </button>
              )}
            </div>

            {error && (
              <div className="mt-6 flex max-w-md items-start gap-2 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3 text-left text-xs leading-5 text-rose-100/85">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <p className="mt-7 text-[11px] text-white/25">Microphone permission is required · Best in Chrome or Edge</p>
          </div>

          <section className="flex min-h-[430px] flex-col rounded-3xl border border-white/10 bg-white/[0.025] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
            <div className="mb-5 flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div>
                <p className="text-sm font-medium">Conversation</p>
                <p className="mt-1 text-xs text-white/35">Live transcript</p>
              </div>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-white/35">
                <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-emerald-400" : "bg-white/20"}`} />
                {isConnected ? "Live" : "Waiting"}
              </div>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              {transcript.length === 0 ? (
                <div className="grid min-h-[300px] place-items-center text-center">
                  <div>
                    <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-white/[0.04] text-white/30"><AudioLines size={19} /></div>
                    <p className="text-sm text-white/45">Your conversation will appear here.</p>
                    <p className="mt-1 text-xs text-white/25">Start talking to see the transcript.</p>
                  </div>
                </div>
              ) : transcript.map((item) => (
                <div key={item.id} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${item.role === "user" ? "bg-cyan-300/10 text-cyan-50" : "bg-white/[0.06] text-white/80"}`}>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] opacity-40">{item.role === "user" ? "You" : "Assistant"}</p>
                    {item.text}
                  </div>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          </section>
        </section>

        <footer className="flex items-center justify-between border-t border-white/10 pt-4 text-[11px] text-white/25">
          <span>Powered by Inworld Realtime</span>
          <span className="hidden sm:inline">Speech-to-speech · Live transcription · Interruptible audio</span>
        </footer>
      </div>
    </main>
  );
}
