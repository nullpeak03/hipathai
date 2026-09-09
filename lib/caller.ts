// Shared caller identity: Clerk userId when configured, else anonymized IP key.
export async function callerId(req: Request): Promise<string> {
  if (process.env.CLERK_SECRET_KEY) {
    try {
      const { auth } = await import("@clerk/nextjs/server");
      const { userId } = await auth();
      if (userId) return userId;
    } catch { /* fall through */ }
  }
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `anon:${fwd ?? "local"}`;
}
