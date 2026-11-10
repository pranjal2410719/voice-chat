"use client";

import { useMemo, useState } from "react";
import { VoiceProvider, useVoice, VoiceReadyState } from "@humeai/voice-react";
import { Mic, MicOff, Phone, PhoneOff, AudioLines, MessageCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { accessToken: string | null; configurationError: string | null };

function ConversationPanel({ accessToken, configurationError }: Props) {
  const { connect, disconnect, readyState, messages } = useVoice();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isConnected = readyState === VoiceReadyState.OPEN;
  const isConnecting = connecting || readyState === VoiceReadyState.CONNECTING;

  const visibleMessages = useMemo(() => messages.filter((item: any) =>
    item.type === "user_message" || item.type === "assistant_message"
  ), [messages]);

  const startCall = async () => {
    if (!accessToken) return;
    setError(null);
    setConnecting(true);
    try {
      await connect({ auth: { type: "accessToken", value: accessToken } });
    } catch (err) {
      console.error("[Hume] Connection failed:", err);
      setError(err instanceof Error ? err.message : "Unable to connect to Hume.");
    } finally {
      setConnecting(false);
    }
  };

  const endCall = () => {
    disconnect();
  };

  return (
    <main className="min-h-screen bg-[#090b10] text-white selection:bg-violet-500/30">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-7 sm:px-8">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-500/15 text-violet-300"><AudioLines size={21} /></div>
            <div><p className="text-sm font-semibold tracking-wide">VOICE CHAT</p><p className="text-xs text-white/45">Powered by Hume AI</p></div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/65">
            <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400" : isConnecting ? "animate-pulse bg-amber-400" : "bg-white/30"}`} />
            {isConnected ? "Connected" : isConnecting ? "Connecting" : "Not connected"}
          </div>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center py-12">
          <div className="mb-8 flex h-36 w-36 items-center justify-center rounded-full border border-violet-300/20 bg-[radial-gradient(circle_at_35%_30%,rgba(167,139,250,.28),rgba(91,33,182,.08)_58%,rgba(255,255,255,.02))] shadow-[0_0_90px_rgba(139,92,246,.13)]">
            <div className={`flex h-24 w-24 items-center justify-center rounded-full border border-violet-200/20 bg-violet-400/10 ${isConnected ? "animate-pulse" : ""}`}>
              {isConnected ? <AudioLines size={38} className="text-violet-200" /> : <Mic size={34} className="text-violet-200/80" />}
            </div>
          </div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.28em] text-violet-300/80">Empathic Voice Interface</p>
          <h1 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">{isConnected ? "I'm listening." : "Talk naturally."}</h1>
          <p className="mt-3 max-w-md text-center text-sm leading-6 text-white/50">
            {isConnected ? "Speak normally. Hume will respond with live voice and conversation." : "Start a live voice conversation. No local speech models or large downloads required."}
          </p>

          <div className="mt-8 flex items-center gap-3">
            {isConnected ? (
              <Button onClick={endCall} className="h-12 rounded-full bg-rose-500 px-7 text-white hover:bg-rose-600"><PhoneOff className="mr-2 h-4 w-4" /> End conversation</Button>
            ) : (
              <Button onClick={startCall} disabled={!accessToken || isConnecting} className="h-12 rounded-full bg-violet-500 px-7 text-white hover:bg-violet-600 disabled:opacity-40">
                {isConnecting ? <><AudioLines className="mr-2 h-4 w-4 animate-pulse" /> Connecting...</> : <><Phone className="mr-2 h-4 w-4" /> Start conversation</>}
              </Button>
            )}
          </div>

          {(configurationError || error) && <div className="mt-6 flex max-w-xl items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm text-amber-100/80"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error || configurationError}</span></div>}

          <div className="mt-12 w-full max-w-2xl rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/45"><MessageCircle size={14} /> Conversation</div>
            {visibleMessages.length === 0 ? (
              <div className="grid min-h-28 place-items-center text-center text-sm text-white/35">Your conversation will appear here.</div>
            ) : (
              <div className="max-h-[340px] space-y-3 overflow-y-auto pr-1">
                {visibleMessages.map((item: any, index: number) => {
                  const isUser = item.type === "user_message";
                  const content = item.message?.content || "";
                  return <div key={item.id || index} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${isUser ? "bg-violet-500/20 text-violet-50" : "bg-white/[0.07] text-white/85"}`}>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider opacity-45">{isUser ? "You" : "Hume"}</p>
                      {content}
                    </div>
                  </div>;
                })}
              </div>
            )}
          </div>
        </section>
        <footer className="border-t border-white/10 pt-4 text-center text-xs text-white/30">Real-time voice powered by Hume EVI · Microphone permission required</footer>
      </div>
    </main>
  );
}

export default function HumeVoiceChat(props: Props) {
  return <VoiceProvider><ConversationPanel {...props} /></VoiceProvider>;
}
