import { createHmac, randomBytes } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readCredentials() {
  const encoded = process.env.INWORLD_API_KEY?.trim();
  if (!encoded) throw new Error("INWORLD_API_KEY is not configured");

  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator <= 0 || separator === decoded.length - 1) {
    throw new Error("INWORLD_API_KEY is not a valid Base64 key ID and secret credential");
  }

  return {
    keyId: decoded.slice(0, separator),
    secret: decoded.slice(separator + 1),
  };
}

function createAuthorization(keyId: string, secret: string) {
  const host = "api.inworld.ai";
  const method = "ai.inworld.engine.v1.SessionTokens/GenerateSessionToken";
  const dateTime = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const nonce = randomBytes(16).toString("hex");

  let signature = Buffer.from(`IW1${secret}`, "utf8");
  for (const part of [dateTime, host, method, nonce, "iw1_request"]) {
    signature = createHmac("sha256", signature).update(part).digest();
  }

  return `IW1-HMAC-SHA256 ApiKey=${keyId},DateTime=${dateTime},Nonce=${nonce},Signature=${signature.toString("hex")}`;
}

export async function POST() {
  try {
    const { keyId, secret } = readCredentials();
    const response = await fetch("https://api.inworld.ai/v1/sessionTokens/token:generate", {
      method: "POST",
      headers: {
        Authorization: createAuthorization(keyId, secret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ api_key: keyId }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("[Inworld] Session-token request failed:", response.status, detail.slice(0, 500));
      return Response.json(
        { error: `Inworld session-token request failed (HTTP ${response.status}). Check that INWORLD_API_KEY is the complete, active Basic (Base64) credential for a Realtime-only key.` },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const data = (await response.json()) as { token?: string; expirationTime?: string };
    if (!data.token) {
      console.error("[Inworld] Session-token response did not contain a token");
      return Response.json(
        { error: "Inworld did not return a session token." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    return Response.json(
      { token: data.token, expirationTime: data.expirationTime },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("[Inworld] Session-token route error:", error instanceof Error ? error.message : "Unknown error");
    return Response.json(
      { error: error instanceof Error && error.message.includes("INWORLD_API_KEY")
        ? error.message
        : "The voice authentication service is temporarily unavailable. Check the server logs." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
