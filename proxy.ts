import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Keyless-safe: Clerk is only loaded when keys exist, so `next dev` /
// previews without envs still serve pages and honest API errors.
export default async function proxy(req: NextRequest) {
  if (!process.env.CLERK_SECRET_KEY || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return NextResponse.next();
  }
  const { clerkMiddleware, createRouteMatcher } = await import("@clerk/nextjs/server");
  const isAppRoute = createRouteMatcher(["/onboarding(.*)", "/app(.*)"]);
  const handler = clerkMiddleware(async (auth, r) => {
    if (isAppRoute(r)) await auth.protect();
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (handler as any)(req, {});
}

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)"],
};
