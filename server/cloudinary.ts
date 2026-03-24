import crypto from "crypto";

interface CloudinaryEnv {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  defaultFolder: string;
}

const HARDCODED_CLOUDINARY = {
  cloudName: "dnhjgceru",
  apiKey: "318916283577763",
  apiSecret: "sxIebK27cXvPeXcqQRXkFSc6-UM",
};

export interface UploadSignaturePayload {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
}

const sanitizeFolder = (value: string | undefined, fallback: string): string => {
  const cleaned = (value ?? fallback)
    .trim()
    .replace(/[^a-zA-Z0-9/_-]/g, "")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "");
  return cleaned || fallback;
};

const loadEnv = (): CloudinaryEnv | null => {
  const cloudName =
    process.env.CLOUDINARY_CLOUD_NAME?.trim() || HARDCODED_CLOUDINARY.cloudName;
  const apiKey =
    process.env.CLOUDINARY_API_KEY?.trim() || HARDCODED_CLOUDINARY.apiKey;
  const apiSecret =
    process.env.CLOUDINARY_API_SECRET?.trim() || HARDCODED_CLOUDINARY.apiSecret;
  const defaultFolder = sanitizeFolder(
    process.env.CLOUDINARY_FOLDER,
    "class-circle/posts",
  );

  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }

  return { cloudName, apiKey, apiSecret, defaultFolder };
};

export const hasCloudinaryConfig = (): boolean => loadEnv() !== null;

export const createUploadSignature = (requestedFolder?: string): UploadSignaturePayload => {
  const env = loadEnv();
  if (!env) {
    throw new Error("Cloudinary environment variables are not fully configured");
  }

  const folder = sanitizeFolder(requestedFolder, env.defaultFolder);
  const timestamp = Math.floor(Date.now() / 1000);
  const signatureBase = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto
    .createHash("sha1")
    .update(`${signatureBase}${env.apiSecret}`)
    .digest("hex");

  return {
    timestamp,
    signature,
    apiKey: env.apiKey,
    cloudName: env.cloudName,
    folder,
  };
};
