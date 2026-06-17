/**
 * Affiliate referral attribution — captures `?ref=` codes and replays them
 * during registration. Browser-only storage; every entry expires after 90 days.
 */
const REF_KEY = "_ref";
const REF_CLIENT_KEY = "_ref_client";
const REF_TS_KEY = "_ref_ts";
const TTL_MS = 90 * 24 * 60 * 60 * 1000;

const isBrowser = typeof window !== "undefined";

const isValidCode = (code: string): boolean => /^[a-zA-Z0-9]{3,20}$/.test(code.trim());

const setWithTs = (storage: Storage, code: string): void => {
  const ts = Date.now().toString();
  storage.setItem(REF_KEY, code);
  storage.setItem(REF_TS_KEY, ts);
};

const getIfFresh = (storage: Storage): string | null => {
  const code = storage.getItem(REF_KEY);
  const ts = storage.getItem(REF_TS_KEY);
  if (!code || !ts) return null;
  const age = Date.now() - Number(ts);
  if (Number.isNaN(age) || age > TTL_MS) {
    storage.removeItem(REF_KEY);
    storage.removeItem(REF_TS_KEY);
    return null;
  }
  return code;
};

const getClientCookieRef = (): string | null => {
  if (!isBrowser) return null;
  const match = document.cookie.match(new RegExp(`${REF_CLIENT_KEY}=([^;]+)`));
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

export const captureReferralFromUrl = (search: string): string | null => {
  if (!isBrowser) return null;
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const ref = params.get("ref")?.trim();
  if (!ref || !isValidCode(ref)) return null;

  try {
    setWithTs(sessionStorage, ref);
    setWithTs(localStorage, ref);
    document.cookie = `${REF_CLIENT_KEY}=${encodeURIComponent(ref)}; max-age=${Math.floor(TTL_MS / 1000)}; path=/; SameSite=Lax`;
  } catch {
    // storage may be blocked
  }
  return ref;
};

export const getStoredReferralCode = (): string | null => {
  if (!isBrowser) return null;
  try {
    return getIfFresh(sessionStorage) ?? getIfFresh(localStorage) ?? getClientCookieRef();
  } catch {
    return getClientCookieRef();
  }
};

export const getReferralPayloadForRegister = (): {
  referralCode?: string;
  clientRef?: string;
  sessionRef?: string;
  localRef?: string;
} => {
  if (!isBrowser) return {};
  const sessionRef = getIfFresh(sessionStorage);
  const localRef = getIfFresh(localStorage);
  const clientRef = getClientCookieRef();
  const code = sessionRef ?? localRef ?? clientRef ?? undefined;
  return {
    referralCode: code,
    clientRef: clientRef ?? undefined,
    sessionRef: sessionRef ?? undefined,
    localRef: localRef ?? undefined,
  };
};

export const clearStoredReferralCode = (): void => {
  if (!isBrowser) return;
  try {
    sessionStorage.removeItem(REF_KEY);
    sessionStorage.removeItem(REF_TS_KEY);
    localStorage.removeItem(REF_KEY);
    localStorage.removeItem(REF_TS_KEY);
    document.cookie = `${REF_CLIENT_KEY}=; max-age=0; path=/`;
  } catch {
    // ignore
  }
};
