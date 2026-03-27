import type { Handler } from "@netlify/functions";
import { requireAdminPassword } from "./_lib/admin-auth";
import { json } from "./_lib/http";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const authError = requireAdminPassword(event);
  if (authError) {
    return authError;
  }

  return json(200, { ok: true });
};
