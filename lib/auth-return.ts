export const AUTH_RETURN_COOKIE = "spotra_auth_next";

/** Only allow same-origin relative paths (blocks open redirects). */
export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (trimmed.includes("://")) return null;
  return trimmed;
}

export function setAuthReturnCookie(returnTo: string) {
  const path = safeReturnPath(returnTo);
  if (!path || typeof document === "undefined") return;

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${AUTH_RETURN_COOKIE}=${encodeURIComponent(path)}; Path=/; Max-Age=600; SameSite=Lax${secure}`;
}

export function clearAuthReturnCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_RETURN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function readAuthReturnCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${AUTH_RETURN_COOKIE}=([^;]*)`),
  );
  if (!match?.[1]) return null;
  try {
    return safeReturnPath(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}
