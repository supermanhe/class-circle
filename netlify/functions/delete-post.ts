import crypto from "crypto";
import type { Handler, HandlerEvent } from "@netlify/functions";
import { requireAdminPassword } from "./_lib/admin-auth";
import { json } from "./_lib/http";
import { normalizePostImages } from "./_lib/posts";
import { getSupabaseAdmin } from "./_lib/supabase";

const parsePostId = (raw: string | undefined): number | null => {
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  if (Number.isNaN(id) || id <= 0) return null;
  return id;
};

const parsePostIdFromPath = (path: string | undefined): number | null => {
  if (!path) return null;
  const match = path.match(/\/api\/posts\/(\d+)\/?$/);
  if (!match) return null;
  return parsePostId(match[1]);
};

const resolvePostId = (event: HandlerEvent): number | null => {
  const fromQuery = parsePostId(event.queryStringParameters?.id);
  if (fromQuery) return fromQuery;

  const fromPath = parsePostIdFromPath(event.path);
  if (fromPath) return fromPath;

  if (event.rawUrl) {
    try {
      const url = new URL(event.rawUrl);
      const fromRawUrl = parsePostIdFromPath(url.pathname);
      if (fromRawUrl) return fromRawUrl;
    } catch {
      // Ignore invalid raw URLs and continue.
    }
  }

  return null;
};

const parseCloudinaryPublicId = (imageUrl: string): string | null => {
  try {
    const url = new URL(imageUrl);
    const marker = "/upload/";
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;

    const afterUpload = url.pathname.slice(markerIndex + marker.length);
    const segments = afterUpload.split("/").filter(Boolean);
    if (segments.length === 0) return null;

    const versionIndex = segments.findIndex((segment) => /^v\d+$/.test(segment));
    const publicIdSegments = versionIndex >= 0 ? segments.slice(versionIndex + 1) : segments;
    if (publicIdSegments.length === 0) return null;

    const lastSegment = publicIdSegments[publicIdSegments.length - 1];
    publicIdSegments[publicIdSegments.length - 1] = lastSegment.replace(/\.[^/.]+$/, "");
    return decodeURIComponent(publicIdSegments.join("/"));
  } catch {
    return null;
  }
};

const deleteCloudinaryImage = async (publicId: string): Promise<void> => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary is not configured");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signatureBase = `public_id=${publicId}&timestamp=${timestamp}`;
  const signature = crypto.createHash("sha1").update(`${signatureBase}${apiSecret}`).digest("hex");

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      public_id: publicId,
      api_key: apiKey,
      timestamp: String(timestamp),
      signature,
    }).toString(),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    result?: string;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message || "Failed to delete Cloudinary image");
  }

  if (payload.result !== "ok" && payload.result !== "not found") {
    throw new Error(payload.error?.message || `Unexpected Cloudinary result: ${payload.result ?? "unknown"}`);
  }
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "DELETE") {
    return json(405, { error: "Method not allowed" });
  }

  const authError = requireAdminPassword(event);
  if (authError) {
    return authError;
  }

  const id = resolvePostId(event);
  if (!id) {
    return json(400, { error: "Invalid post id" });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: post, error: fetchError } = await supabase
      .from("posts")
      .select("id, images")
      .eq("id", id)
      .maybeSingle();
    if (fetchError) {
      console.error("Failed to fetch post before delete:", fetchError);
      return json(500, { error: "Failed to delete post" });
    }
    if (!post) {
      return json(404, { error: "Post not found" });
    }

    const images = normalizePostImages(post.images);
    const publicIds = images
      .map((imageUrl) => parseCloudinaryPublicId(imageUrl))
      .filter((item): item is string => typeof item === "string" && item.length > 0);

    const { error: deletePostError } = await supabase.from("posts").delete().eq("id", id);
    if (deletePostError) {
      console.error("Failed to delete post:", deletePostError);
      return json(500, { error: "Failed to delete post" });
    }

    const deletionResults = await Promise.allSettled(publicIds.map((publicId) => deleteCloudinaryImage(publicId)));
    const cloudinaryFailed = deletionResults.filter((result) => result.status === "rejected").length;

    return json(200, {
      id,
      deleted: true,
      cloudinaryDeleted: publicIds.length - cloudinaryFailed,
      cloudinaryFailed,
    });
  } catch (error) {
    console.error("Failed to delete post:", error);
    return json(500, { error: "Failed to delete post" });
  }
};

