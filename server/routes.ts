import type { Express } from "express";
import { createUploadSignature, hasCloudinaryConfig } from "./cloudinary.ts";
import { createPost, likePost, listPosts } from "./db.ts";

const MAX_IMAGES_PER_POST = 9;
const HTTPS_URL_PATTERN = /^https?:\/\/.+/i;

const normalizeContent = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const normalizeTimestamp = (value: unknown): string => {
  if (typeof value !== "string") {
    return new Date().toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
};

const normalizeImages = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const containsBase64Data = (value: string): boolean => value.startsWith("data:");

export const registerApiRoutes = (app: Express): void => {
  app.get("/api/posts", (_req, res) => {
    try {
      res.json(listPosts());
    } catch (error) {
      console.error("Failed to fetch posts:", error);
      res.status(500).json({ error: "Failed to fetch posts" });
    }
  });

  app.post("/api/posts", (req, res) => {
    try {
      const content = normalizeContent(req.body?.content);
      const images = normalizeImages(req.body?.images);
      const timestamp = normalizeTimestamp(req.body?.timestamp);

      if (!content && images.length === 0) {
        res.status(400).json({ error: "Post content or images are required" });
        return;
      }

      if (images.length > MAX_IMAGES_PER_POST) {
        res.status(400).json({ error: `A post can include up to ${MAX_IMAGES_PER_POST} images` });
        return;
      }

      if (images.some(containsBase64Data)) {
        res.status(400).json({
          error: "Base64 images are no longer accepted. Upload files to Cloudinary and submit image URLs.",
        });
        return;
      }

      if (images.some((img) => !HTTPS_URL_PATTERN.test(img))) {
        res.status(400).json({ error: "All images must be valid HTTP(S) URLs" });
        return;
      }

      const post = createPost({ content, images, timestamp });
      res.status(201).json(post);
    } catch (error) {
      console.error("Failed to create post:", error);
      res.status(500).json({ error: "Failed to create post" });
    }
  });

  app.post("/api/posts/:id/like", (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id) || id <= 0) {
        res.status(400).json({ error: "Invalid post id" });
        return;
      }

      const likes = likePost(id);
      if (likes === null) {
        res.status(404).json({ error: "Post not found" });
        return;
      }

      res.json({ id, likes });
    } catch (error) {
      console.error("Failed to like post:", error);
      res.status(500).json({ error: "Failed to like post" });
    }
  });

  app.post("/api/uploads/signature", (req, res) => {
    if (!hasCloudinaryConfig()) {
      res.status(500).json({
        error:
          "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.",
      });
      return;
    }

    try {
      const folder = typeof req.body?.folder === "string" ? req.body.folder : undefined;
      const payload = createUploadSignature(folder);
      res.json(payload);
    } catch (error) {
      console.error("Failed to create upload signature:", error);
      res.status(500).json({ error: "Failed to create upload signature" });
    }
  });
};
