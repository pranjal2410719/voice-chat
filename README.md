# Voice Chat

A browser-based, real-time speech-to-speech assistant powered by the Inworld Realtime API.

## How it works

- **Microphone input:** Browser captures audio through WebRTC.
- **Speech recognition:** Inworld Realtime STT transcribes speech as part of the live session.
- **Language model:** Inworld Realtime routes the conversation to the configured LLM.
- **Voice response:** Inworld streams generated speech back over the same WebRTC session.
- **Turn-taking:** Semantic VAD detects when a speaker has finished and supports interruptions.

The browser never receives the long-lived Inworld API credential. A Next.js server route exchanges it for a short-lived session token.

## Setup

1. Create an **Inworld Realtime-only** API key in the Inworld Portal.
2. In Vercel → Project → Settings → Environment Variables, add:

   `INWORLD_API_KEY` — the complete **Basic (Base64)** credential copied from the Inworld Portal.

   Add it to Production, Preview, and Development as needed. Do not add the credential to a `NEXT_PUBLIC_*` variable, commit it to Git, or paste it into chat.

3. Redeploy the project after adding the variable.
4. Open the app in a secure browser context (HTTPS or localhost), allow microphone access, and select **Start conversation**.

## Local development

Create `.env.local` in the project root:

```env
INWORLD_API_KEY=your_complete_basic_base64_credential
```

Then run:

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

## Configuration

The initial session uses:

- LLM: `google-ai-studio/gemini-2.5-flash`
- STT: `inworld/inworld-stt-1`
- TTS: `inworld-tts-2-flash`
- Voice: `Olivia`
- Turn detection: semantic VAD, medium eagerness, interruptions enabled

These defaults can be changed in `src/components/inworld-voice-chat.tsx`.

## Security notes

- Keep `INWORLD_API_KEY` server-side only.
- The token route returns short-lived session tokens and disables caching.
- The app currently has no user login or per-user rate limiting. Add those before opening the endpoint to a large public audience.
- Realtime usage is billed by Inworld according to the models and minutes/tokens consumed.

## References

- [Inworld Realtime API](https://docs.inworld.ai/realtime/overview)
- [Inworld authentication](https://docs.inworld.ai/api-reference/introduction)
- [Configuring Realtime models](https://docs.inworld.ai/realtime/usage/using-realtime-models)
