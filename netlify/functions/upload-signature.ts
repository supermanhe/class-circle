import crypto from "crypto";
import type { Handler } from "@netlify/functions";
import { json } from "./_lib/http";

interface SignaturePayload {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
}

const DEFAULT_FOLDER = "class-circle/posts";

const sanitizeFolder = (value: string | undefined, fallback: string): string => {
  const cleaned = (value ?? fallback)
    .trim()
    .replace(/[^a-zA-Z0-9/_-]/g, "")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "");
  return cleaned || fallback;
};

const getRequiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const parseRequestBody = (body: string | null): Record<string, unknown> | null => {
  if (!body) return {};
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const buildSignature = (folder: string): SignaturePayload => {
  const cloudName = getRequiredEnv("CLOUDINARY_CLOUD_NAME");
  const apiKey = getRequiredEnv("CLOUDINARY_API_KEY");
  const apiSecret = getRequiredEnv("CLOUDINARY_API_SECRET");
  const timestamp = Math.floor(Date.now() / 1000);
  const signatureBase = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto
    .createHash("sha1")
    .update(`${signatureBase}${apiSecret}`)
    .digest("hex");

  return { timestamp, signature, apiKey, cloudName, folder };
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const body = parseRequestBody(event.body ?? null);
  if (body === null) {
    return json(400, { error: "Invalid JSON body" });
  }

  const requestedFolder = typeof body.folder === "string" ? body.folder : undefined;
  const envFolder = process.env.CLOUDINARY_FOLDER?.trim() || DEFAULT_FOLDER;
  const folder = sanitizeFolder(requestedFolder, envFolder);

  try {
    return json(200, buildSignature(folder));
  } catch (error) {
    console.error("Failed to create upload signature:", error);
    return json(500, {
      error:
        "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.",
    });
  }
};
