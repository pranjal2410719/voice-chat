import { createHmac, randomBytes } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InworldCredentials = { key: string; secret: string };

function readCredentials(): InworldCredentials {
  const encoded = process.env.INWORLD_API_KEY?.trim();
  if (!encoded) throw new Error("INWORLD_API_KEY is not configured");

  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator <= 0 || separator === decoded.length - 1) {
    throw new Error("INWORLD_API_KEY is not a valid Basic credential");
  }

  return {
    key: decoded.slice(0, separator),
    secret: decoded.slice(separator + 1),
  };
}

function createAuthorization(key: string, secret: string) {
  const dateTime = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const nonce = randomBytes(8).toString("hex");
  const method = "ai.inworld.engine.WorldEngine/GenerateToken";
  const engineHost = "api-engine.inworld.ai";

  let signature = `IW1${secret}`;
  for (const parameter of [dateTime, engineHost, method, nonce]) {
    signature = createHmac("sha256", signature).update(parameter).digest("hex");
  }
  signature = createHmac("sha256", signature).update("iw1_request").digest("hex");

  return `IW1-HMAC-SHA256 ApiKey=${key},DateTime=${dateTime},Nonce=${nonce},Signature=${signature}`;
}

export async function POST() {
  try {
    const { key, secret } = readCredentials();
    const response = await fetch("https://api.inworld.ai/auth/v1/tokens/token:generate", {
      method: "POST",
      headers: {
        Authorization: createAuthorization(key, secret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ key, resources: [] }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("[Inworld] Token request failed with status:", response.status);
      return Response.json(
        { error: "Voice authentication failed. Check the Inworld API key configuration." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const data = (await response.json()) as { token?: string; expirationTime?: string };
    if (!data.token) {
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
    console.error("[Inworld] Token route configuration error:", error instanceof Error ? error.message : "Unknown error");
    return Response.json(
      { error: "Voice service is not configured. Add INWORLD_API_KEY to the server environment." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
