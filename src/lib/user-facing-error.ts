/**
 * The one rule for what error text a customer may see.
 *
 * Raw transport and runtime text — axios's "Request failed with status code 400", "Failed to fetch",
 * a Postgres error, a stack trace — must never reach the UI. It tells the customer nothing they can
 * act on and leaks internals. A message the server wrote *for* the customer ("There is no active
 * subscription to cancel.") is kept.
 *
 * Applied at the two places every error funnels through, so no screen has to remember it:
 *  - `ApiError` (`lib/api/http.ts`) — every failed API call.
 *  - `toast` (`lib/toast.tsx`) — every notification, whatever a screen built its message from.
 */

export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again later.";

/** Longer than any sentence we write for a customer; longer usually means a dump. */
const MAX_USER_MESSAGE_LENGTH = 300;

const TECHNICAL_PATTERNS: RegExp[] = [
  /request failed with status code/i,
  /^request failed$/i,
  /status code \d{3}/i,
  /^network ?error$/i,
  /failed to fetch/i,
  /networkerror when attempting/i,
  /load failed$/i,
  /unexpected token/i,
  /json\.parse|is not valid json|unexpected end of json/i,
  /cannot read propert/i,
  /is not a function/i,
  /is not defined$/i,
  /undefined is not/i,
  /\b(econnrefused|econnreset|etimedout|enotfound|socket hang up)\b/i,
  /queryfailederror|syntax error at or near|violates .* constraint|relation ".*" does not exist/i,
  /invalid input value for enum|invalid input syntax for type/i,
  /^internal server error$/i,
  /<!doctype|<html/i,
  /\n\s+at\s/, // a stack trace
  /^\[object \w+\]$/,
];

export function isTechnicalMessage(message: string): boolean {
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * The text to show for an error message, given the HTTP status when there is one.
 *
 * 5xx is always generic: a server that failed did not write its `error` for a customer.
 */
export function toUserMessage(message: string | null | undefined, status?: number): string {
  const text = (message ?? "").trim();
  if (!text) return GENERIC_ERROR_MESSAGE;
  if (typeof status === "number" && status >= 500) return GENERIC_ERROR_MESSAGE;
  if (text.length > MAX_USER_MESSAGE_LENGTH) return GENERIC_ERROR_MESSAGE;
  if (isTechnicalMessage(text)) return GENERIC_ERROR_MESSAGE;
  return text;
}

/** For `catch (err)` blocks: a safe message from anything thrown. */
export function getUserErrorMessage(error: unknown, fallback = GENERIC_ERROR_MESSAGE): string {
  if (error instanceof Error) {
    const safe = toUserMessage(error.message);
    return safe === GENERIC_ERROR_MESSAGE ? fallback : safe;
  }
  if (typeof error === "string") {
    const safe = toUserMessage(error);
    return safe === GENERIC_ERROR_MESSAGE ? fallback : safe;
  }
  return fallback;
}
