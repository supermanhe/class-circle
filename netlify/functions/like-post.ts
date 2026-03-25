import type { Handler, HandlerEvent } from "@netlify/functions";
import { json } from "./_lib/http";
import { getSupabaseAdmin } from "./_lib/supabase";

const parsePostId = (raw: string | undefined): number | null => {
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  if (Number.isNaN(id) || id <= 0) return null;
  return id;
};

const parsePostIdFromPath = (path: string | undefined): number | null => {
  if (!path) return null;
  const match = path.match(/\/api\/posts\/(\d+)\/like\/?$/);
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
      // Ignore invalid URLs and continue.
    }
  }

  return null;
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const id = resolvePostId(event);
  if (!id) {
    console.warn("Invalid post id payload", {
      query: event.queryStringParameters,
      path: event.path,
      rawUrl: event.rawUrl,
    });
    return json(400, { error: "Invalid post id" });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("increment_post_likes", {
      target_post_id: id,
    });

    if (error) {
      console.error("Failed to like post:", error);
      return json(500, { error: "Failed to like post" });
    }

    if (data === null) {
      return json(404, { error: "Post not found" });
    }

    return json(200, { id, likes: data });
  } catch (error) {
    console.error("Failed to like post:", error);
    return json(500, { error: "Failed to like post" });
  }
};
