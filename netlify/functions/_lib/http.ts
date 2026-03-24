import type { HandlerResponse } from "@netlify/functions";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
};

export const json = (statusCode: number, body: unknown): HandlerResponse => ({
  statusCode,
  headers: JSON_HEADERS,
  body: JSON.stringify(body),
});
