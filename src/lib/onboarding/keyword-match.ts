/**
 * The demo's keyword matcher — a deliberate mirror of the server's.
 *
 * The demo on onboarding screen 3 is a promise: *this is what will happen on your account*. It is
 * worth nothing if a comment that fires here would not fire in production, or the reverse. So the
 * three rules below are copied from `server/src/services/commentAutomation.ts` exactly:
 *
 * 1. lower-case;
 * 2. every character that is not a letter, a number or whitespace becomes a space, then runs of
 *    whitespace collapse — so "GUIDE!!!" and "guide," both normalize to "guide"; and
 * 3. whole-word matching against the normalized comment, so "how much is this?" matches the
 *    keyword "how much" but "guidebook" does not match "guide".
 *
 * 🚩 **This is a duplicate of server logic, and that is a cost, not an oversight.** The alternative
 * — asking the API whether a demo comment matched — would put a network round trip inside a
 * typing interaction, and would make the demo unusable offline or while the API is slow, on the
 * screen whose entire job is to make the product feel instant. The duplication is bounded (one
 * function, no state) and pinned by `keyword-match.test.ts`, which asserts the cases that
 * distinguish this implementation from a naive `includes()`.
 *
 * If `commentAutomation.normalize` changes, this changes with it.
 */

/** Mirrors `nonWordRegex` in `commentAutomation.ts`. */
const NON_WORD = /[^\p{L}\p{N}\s]/gu;
const MULTI_SPACE = /\s+/g;
const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

export function normalizeComment(text: string): string {
  return text.toLowerCase().replace(NON_WORD, " ").replace(MULTI_SPACE, " ").trim();
}

const escapeRegex = (value: string): string => value.replace(REGEX_SPECIALS, "\\$&");

/**
 * Does `comment` contain any of `keywords` as a whole word (or whole phrase)?
 *
 * A keyword that normalizes to nothing — `"!!!"`, a bare emoji — never matches, which is the same
 * answer the server gives and the reason `normalizeAutomationKeywords` refuses to store one.
 */
export function commentMatchesKeywords(comment: string, keywords: string[]): boolean {
  const normalizedComment = normalizeComment(comment);
  if (!normalizedComment) {
    return false;
  }
  return keywords.some((keyword) => {
    const normalizedKeyword = normalizeComment(keyword);
    if (!normalizedKeyword) {
      return false;
    }
    return new RegExp(`\\b${escapeRegex(normalizedKeyword)}\\b`).test(normalizedComment);
  });
}

/**
 * Split a comma-separated keyword field into what the server will actually store.
 *
 * The same three rules as `normalizeAutomationKeywords` on the server — split on commas, drop
 * anything with no letter or digit, dedupe on the normalized value, upper-case — so the chips the
 * user sees under the field are the keywords that end up in the database, not an optimistic
 * preview of them.
 */
export function parseKeywordField(value: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of value.split(",")) {
    const trimmed = part.trim().replace(MULTI_SPACE, " ");
    if (!trimmed || !normalizeComment(trimmed)) {
      continue;
    }
    const upper = trimmed.toLocaleUpperCase();
    if (seen.has(upper)) {
      continue;
    }
    seen.add(upper);
    out.push(upper);
  }
  return out;
}
