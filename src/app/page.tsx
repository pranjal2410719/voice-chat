import { fetchAccessToken } from "hume";
import HumeVoiceChat from "@/components/hume-voice-chat";

export const dynamic = "force-dynamic";

export default async function Page() {
  let accessToken: string | null = null;
  let configurationError: string | null = null;

  try {
    const apiKey = process.env.HUME_API_KEY;
    const secretKey = process.env.HUME_SECRET_KEY;
    if (!apiKey || !secretKey) {
      configurationError = "Add HUME_API_KEY and HUME_SECRET_KEY to the Vercel project environment variables, then redeploy.";
    } else {
      accessToken = await fetchAccessToken({ apiKey, secretKey });
    }
  } catch (error) {
    console.error("[Hume] Access-token generation failed:", error);
    configurationError = "Could not authenticate with Hume. Check the HUME_API_KEY and HUME_SECRET_KEY environment variables and redeploy.";
  }

  return <HumeVoiceChat accessToken={accessToken} configurationError={configurationError} />;
}
