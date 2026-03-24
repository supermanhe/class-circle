export const MAX_IMAGES_PER_POST = 9;
const HTTPS_URL_PATTERN = /^https?:\/\/.+/i;

export interface PostInput {
  content: string;
  images: string[];
  timestamp: string;
}

export const normalizeContent = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

export const normalizeImages = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

export const normalizeTimestamp = (value: unknown): string => {
  if (typeof value !== "string") return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
};

const isBase64DataUrl = (value: string): boolean => value.startsWith("data:");

export const validatePostInput = (input: PostInput): string | null => {
  if (!input.content && input.images.length === 0) {
    return "Post content or images are required";
  }
  if (input.images.length > MAX_IMAGES_PER_POST) {
    return `A post can include up to ${MAX_IMAGES_PER_POST} images`;
  }
  if (input.images.some(isBase64DataUrl)) {
    return "Base64 images are no longer accepted. Upload files to Cloudinary and submit image URLs.";
  }
  if (input.images.some((item) => !HTTPS_URL_PATTERN.test(item))) {
    return "All images must be valid HTTP(S) URLs";
  }
  return null;
};

export const normalizePostImages = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
};
