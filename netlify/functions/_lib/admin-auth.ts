import crypto from "crypto";
import type { HandlerEvent, HandlerResponse } from "@netlify/functions";
import { json } from "./http";

const PASSWORD_HEADER_NAME = "x-admin-password";

const getHeader = (event: HandlerEvent, name: string): string | undefined => {
  const target = name.toLowerCase();
  const entry = Object.entries(event.headers ?? {}).find(
    ([key, value]) => key.toLowerCase() === target && typeof value === "string",
  );
  return entry?.[1];
};

const hashValue = (value: string): Buffer => crypto.createHash("sha256").update(value).digest();

const verifyPassword = (provided: string, expected: string): boolean =>
  crypto.timingSafeEqual(hashValue(provided), hashValue(expected));

export const requireAdminPassword = (event: HandlerEvent): HandlerResponse | null => {
  const expectedPassword = process.env.ADMIN_WRITE_PASSWORD?.trim();
  if (!expectedPassword) {
    console.error("Missing required environment variable: ADMIN_WRITE_PASSWORD");
    return json(500, { error: "Server admin password is not configured" });
  }

  const providedPassword = getHeader(event, PASSWORD_HEADER_NAME)?.trim();
  if (!providedPassword) {
    return json(401, { error: "Admin password required" });
  }

  if (!verifyPassword(providedPassword, expectedPassword)) {
    return json(403, { error: "Invalid admin password" });
  }

  return null;
};

