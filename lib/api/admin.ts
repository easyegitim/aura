// SPEC 4.2 /admin ve 14 /api/admin/*: yalnız ADMIN_EMAILS (virgülle ayrılmış). Anonim kullanıcı asla admin değildir.
export function adminEmails(env: Record<string, string | undefined> = process.env): string[] {
  return (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminUser(user: { email?: string | null; is_anonymous?: boolean } | null | undefined, env?: Record<string, string | undefined>): boolean {
  if (!user?.email || user.is_anonymous) return false;
  return adminEmails(env).includes(user.email.toLowerCase());
}
