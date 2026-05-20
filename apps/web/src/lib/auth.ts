/**
 * Authentication.
 *
 * Two paths:
 *  - DEV_AUTH_BYPASS=true → returns a deterministic principal so the app
 *    works without an IdP. NEVER enable in prod.
 *  - Otherwise → NextAuth (Auth.js) with the Microsoft Entra ID provider.
 *
 * Roles come from the Entra `roles` claim (app roles you configure in
 * the app registration). On first sign-in we upsert the user row.
 */
import { db } from "@/db/client";
import { users, userRoles } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import NextAuth, { type DefaultSession } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

export type AppRole =
  | "Champion"
  | "AITeam"
  | "ITSecurity"
  | "DevGovernance"
  | "Licensing"
  | "ITSupport"
  | "Admin";

export type Principal = {
  userId: string;
  email: string;
  displayName: string;
  roles: AppRole[];
};

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      roles: AppRole[];
    };
  }
}

const isDev = process.env.DEV_AUTH_BYPASS === "true";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: isDev
    ? []
    : [
        MicrosoftEntraID({
          clientId: process.env.AUTH_ENTRA_CLIENT_ID,
          clientSecret: process.env.AUTH_ENTRA_CLIENT_SECRET,
          issuer: `https://login.microsoftonline.com/${process.env.AUTH_ENTRA_TENANT_ID}/v2.0`,
        }),
      ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        // Persist roles claim onto the token
        const roles = ((profile as { roles?: string[] }).roles ?? []).filter(
          (r): r is AppRole =>
            [
              "Champion",
              "AITeam",
              "ITSecurity",
              "DevGovernance",
              "Licensing",
              "ITSupport",
              "Admin",
            ].includes(r),
        );
        token.roles = roles;
        token.email = profile.email ?? token.email;
        token.name = profile.name ?? token.name;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = (token.sub as string) ?? "";
      session.user.roles = (token.roles as AppRole[]) ?? [];
      return session;
    },
  },
});

/**
 * Returns the current principal, upserting them into the local `users`
 * table on first sight so other tables can foreign-key them.
 */
export async function getPrincipal(): Promise<Principal | null> {
  if (isDev) {
    return upsertDevPrincipal();
  }
  const session = await auth();
  if (!session?.user?.email) return null;
  const dbUser = await upsertUserFromSession({
    entraOid: session.user.id,
    email: session.user.email,
    displayName: session.user.name ?? session.user.email,
  });
  return {
    userId: dbUser.id,
    email: dbUser.email,
    displayName: dbUser.displayName,
    roles: session.user.roles ?? [],
  };
}

async function upsertDevPrincipal(): Promise<Principal> {
  const email = process.env.DEV_AUTH_USER_EMAIL ?? "dev@example.test";
  const displayName = process.env.DEV_AUTH_USER_NAME ?? "Dev User";
  const roles = (
    process.env.DEV_AUTH_USER_ROLES?.split(",").map((r) => r.trim()) ?? [
      "Champion",
      "AITeam",
      "Admin",
    ]
  ) as AppRole[];

  try {
    const dbUser = await upsertUserFromSession({
      entraOid: `dev:${email}`,
      email,
      displayName,
    });
    return { userId: dbUser.id, email, displayName, roles };
  } catch {
    // DB unreachable in dev — still return a usable principal.
    return { userId: "dev-unbacked", email, displayName, roles };
  }
}

async function upsertUserFromSession(args: {
  entraOid: string;
  email: string;
  displayName: string;
}) {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, args.email))
    .limit(1);
  if (existing) {
    // Keep entra OID up to date.
    if (existing.entraOid !== args.entraOid) {
      await db
        .update(users)
        .set({ entraOid: args.entraOid })
        .where(eq(users.id, existing.id));
    }
    return existing;
  }
  const [created] = await db
    .insert(users)
    .values({
      entraOid: args.entraOid,
      email: args.email,
      displayName: args.displayName,
      active: true,
    })
    .returning();
  return created;
}

export async function requirePrincipal(): Promise<Principal> {
  const p = await getPrincipal();
  if (!p) throw new Error("Unauthenticated");
  return p;
}

export async function requireRole(role: AppRole): Promise<Principal> {
  const p = await requirePrincipal();
  if (!p.roles.includes(role) && !p.roles.includes("Admin"))
    throw new Error(`Forbidden — requires role ${role}`);
  return p;
}

export async function hasAnyRole(roles: AppRole[]): Promise<boolean> {
  const p = await getPrincipal();
  if (!p) return false;
  if (p.roles.includes("Admin")) return true;
  return p.roles.some((r) => roles.includes(r));
}

/** Used by services to ensure a referenced reviewer-role holder exists in our DB. */
export async function userHoldsReviewerRole(
  userId: string,
  reviewerRoleCode: string,
) {
  const { userReviewerRoles } = await import("@/db/schema");
  const rows = await db
    .select()
    .from(userReviewerRoles)
    .where(
      and(
        eq(userReviewerRoles.userId, userId),
        eq(userReviewerRoles.reviewerRoleCode, reviewerRoleCode),
      ),
    );
  return rows.length > 0;
}

// Re-export so callers can `await userRoles` if needed in the future.
export { userRoles };
