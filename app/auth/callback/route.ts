import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { AUTH_RETURN_COOKIE, safeReturnPath } from "@/lib/auth-return";

function pathFromCookie(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    return safeReturnPath(decodeURIComponent(raw));
  } catch {
    return safeReturnPath(raw);
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  const cookieStore = await cookies();
  const next =
    safeReturnPath(searchParams.get("next")) ??
    pathFromCookie(cookieStore.get(AUTH_RETURN_COOKIE)?.value) ??
    "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);
      response.cookies.set(AUTH_RETURN_COOKIE, "", {
        path: "/",
        maxAge: 0,
      });
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`);
}
