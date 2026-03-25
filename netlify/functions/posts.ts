import type { Handler } from "@netlify/functions";
import { json } from "./_lib/http";
import { normalizePostImages, normalizeContent, normalizeImages, normalizeTimestamp, validatePostInput } from "./_lib/posts";
import { getSupabaseAdmin } from "./_lib/supabase";
import { requireAdminPassword } from "./_lib/admin-auth";

interface PostRow {
  id: number;
  content: string | null;
  images: unknown;
  likes: number | null;
  timestamp: string;
}

const parseRequestBody = (body: string | null) => {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
};

const mapPostRow = (row: PostRow) => ({
  id: row.id,
  content: row.content ?? "",
  images: normalizePostImages(row.images),
  likes: row.likes ?? 0,
  timestamp: row.timestamp,
});

export const handler: Handler = async (event) => {
  if (event.httpMethod === "GET") {
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("posts")
        .select("id, content, images, likes, timestamp")
        .order("timestamp", { ascending: false })
        .order("id", { ascending: false });

      if (error) {
        console.error("Failed to fetch posts:", error);
        return json(500, { error: "Failed to fetch posts" });
      }

      return json(200, (data ?? []).map((row) => mapPostRow(row as PostRow)));
    } catch (error) {
      console.error("Failed to fetch posts:", error);
      return json(500, { error: "Failed to fetch posts" });
    }
  }

  if (event.httpMethod === "POST") {
    const authError = requireAdminPassword(event);
    if (authError) {
      return authError;
    }

    const payload = parseRequestBody(event.body ?? null);
    if (payload === null) {
      return json(400, { error: "Invalid JSON body" });
    }

    const content = normalizeContent((payload as Record<string, unknown>).content);
    const images = normalizeImages((payload as Record<string, unknown>).images);
    const timestamp = normalizeTimestamp((payload as Record<string, unknown>).timestamp);

    const validationError = validatePostInput({ content, images, timestamp });
    if (validationError) {
      return json(400, { error: validationError });
    }

    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("posts")
        .insert({
          content,
          images,
          likes: 0,
          timestamp,
        })
        .select("id, content, images, likes, timestamp")
        .single();

      if (error || !data) {
        console.error("Failed to create post:", error);
        return json(500, { error: "Failed to create post" });
      }

      return json(201, mapPostRow(data as PostRow));
    } catch (error) {
      console.error("Failed to create post:", error);
      return json(500, { error: "Failed to create post" });
    }
  }

  return json(405, { error: "Method not allowed" });
};
