import type { AuthProviderType } from "./auth-provider.js";

/**
 * Authorization allow-list for HTTP/OAuth mode.
 *
 * OAuth proves a caller holds *an* account at the configured IdP — it does not
 * prove they are the account owner whose Lunch Money token this server wields.
 * Without an explicit allow-list, any IdP account that completes the flow would
 * gain full access to the owner's finances. This module is the authorization
 * step that maps an authenticated identity to "allowed" or not.
 */
export interface Allowlist {
  /** Exact verified emails permitted (lowercased). */
  emails: Set<string>;
  /** Email domains permitted, also matched against Google Workspace `hd` (lowercased, no leading @). */
  domains: Set<string>;
  /** GitHub logins permitted (lowercased). */
  githubUsers: Set<string>;
}

/** Identity resolved from an authenticated OAuth session. */
export interface ResolvedIdentity {
  email?: string;
  emailVerified?: boolean;
  /** Google Workspace hosted domain (`hd` claim). */
  hostedDomain?: string;
  /** GitHub login. */
  username?: string;
}

/** The minimal shape we rely on from a FastMCP OAuth session. */
interface OAuthSessionLike {
  accessToken: string;
  idToken?: string;
}

type FetchFn = typeof fetch;

function parseList(raw: string | undefined, stripLeadingAt = false): Set<string> {
  const out = new Set<string>();
  if (!raw) return out;
  for (const part of raw.split(",")) {
    let v = part.trim().toLowerCase();
    if (stripLeadingAt && v.startsWith("@")) v = v.slice(1);
    if (v) out.add(v);
  }
  return out;
}

/** Build the allow-list from environment variables (trusted config). */
export function parseAllowlist(env: NodeJS.ProcessEnv = process.env): Allowlist {
  return {
    emails: parseList(env.ALLOWED_EMAILS),
    domains: parseList(env.ALLOWED_EMAIL_DOMAINS, true),
    githubUsers: parseList(env.ALLOWED_GITHUB_USERS),
  };
}

export function isAllowlistConfigured(a: Allowlist): boolean {
  return a.emails.size > 0 || a.domains.size > 0 || a.githubUsers.size > 0;
}

/**
 * Decode a JWT payload WITHOUT signature verification.
 *
 * Safe here: the idToken is retrieved server-side from our own encrypted token
 * storage during the OAuth exchange — it is never supplied directly by the
 * client — so its contents are trusted. We only read claims, never authorize on
 * an unverified, client-supplied token.
 */
export function decodeJwtPayload(jwt: string): Record<string, unknown> | undefined {
  const parts = jwt.split(".");
  if (parts.length !== 3) return undefined;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    const parsed = JSON.parse(json) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function coerceVerified(value: unknown): boolean {
  return value === true || value === "true";
}

export function identityFromIdToken(idToken: string): ResolvedIdentity {
  const claims = decodeJwtPayload(idToken) ?? {};
  const email = typeof claims.email === "string" ? claims.email : undefined;
  const hostedDomain = typeof claims.hd === "string" ? claims.hd : undefined;
  return {
    email,
    emailVerified: coerceVerified(claims.email_verified),
    hostedDomain,
  };
}

interface GitHubUser {
  login?: string;
}
interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

/**
 * Resolve the caller's identity from an authenticated session.
 *
 * FastMCP 3.35.0 does not populate email/username on the session, so we derive
 * identity from the upstream tokens: decode the OIDC idToken for
 * Google/CyberArk/custom, or call the GitHub API for GitHub. Returns undefined
 * (fail closed) when identity cannot be established.
 */
export async function resolveIdentity(
  provider: AuthProviderType,
  session: OAuthSessionLike,
  fetchFn: FetchFn = fetch
): Promise<ResolvedIdentity | undefined> {
  if (provider === "github") {
    try {
      const headers = {
        Authorization: `Bearer ${session.accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "lunchmoney-mcp",
      };
      const userRes = await fetchFn("https://api.github.com/user", { headers });
      if (!userRes.ok) return undefined;
      const user = (await userRes.json()) as GitHubUser;
      if (!user.login) return undefined;

      const identity: ResolvedIdentity = { username: user.login };

      // Best-effort verified primary email (used only if a username match misses).
      try {
        const emailRes = await fetchFn("https://api.github.com/user/emails", { headers });
        if (emailRes.ok) {
          const emails = (await emailRes.json()) as GitHubEmail[];
          const primary = Array.isArray(emails)
            ? emails.find((e) => e.primary && e.verified)
            : undefined;
          if (primary) {
            identity.email = primary.email;
            identity.emailVerified = true;
          }
        }
      } catch {
        // Email lookup is optional — keep the username-only identity.
      }
      return identity;
    } catch {
      return undefined;
    }
  }

  // OIDC providers (google, cyberark, custom): identity lives in the idToken.
  if (!session.idToken) return undefined;
  const identity = identityFromIdToken(session.idToken);
  if (!identity.email) return undefined;
  return identity;
}

/** Decide whether a resolved identity is permitted by the allow-list. */
export function isIdentityAllowed(
  allowlist: Allowlist,
  provider: AuthProviderType,
  identity: ResolvedIdentity
): boolean {
  if (provider === "github" && identity.username) {
    if (allowlist.githubUsers.has(identity.username.toLowerCase())) return true;
  }

  if (identity.email && identity.emailVerified === true) {
    const email = identity.email.toLowerCase();
    if (allowlist.emails.has(email)) return true;
    const domain = email.split("@")[1];
    if (domain && allowlist.domains.has(domain)) return true;
  }

  if (identity.hostedDomain && allowlist.domains.has(identity.hostedDomain.toLowerCase())) {
    return true;
  }

  return false;
}

/** Provider instance exposing FastMCP's authenticate(request) contract. */
interface AuthenticatingProvider {
  authenticate(request: unknown): Promise<OAuthSessionLike | undefined>;
}

/**
 * Wrap a provider's `authenticate` with the allow-list authorization gate.
 *
 * - Unauthenticated requests (provider returns undefined) pass through unchanged
 *   so the transport can issue its normal OAuth challenge.
 * - Authenticated, allow-listed identities return the session.
 * - Authenticated but NOT allow-listed identities (or identities that cannot be
 *   resolved) THROW — failing the request closed. Returning undefined here would
 *   be unsafe: in FastMCP stateful HTTP mode a missing auth yields the full tool
 *   set. The thrown message is deliberately generic to avoid leaking the email.
 */
export function wrapAuthenticateWithAllowlist(
  provider: AuthProviderType,
  authProvider: AuthenticatingProvider,
  allowlist: Allowlist,
  fetchFn: FetchFn = fetch
): (request: unknown) => Promise<OAuthSessionLike | undefined> {
  return async (request: unknown) => {
    const session = await authProvider.authenticate(request);
    if (!session) return undefined;

    const identity = await resolveIdentity(provider, session, fetchFn);
    if (!identity || !isIdentityAllowed(allowlist, provider, identity)) {
      // "Unauthorized" is deliberate: the transport (mcp-proxy) maps it to a
      // 401 challenge rather than a generic 500. The message stays generic so it
      // never echoes the rejected account's email.
      throw new Error("Unauthorized: account is not authorized for this server.");
    }
    return session;
  };
}
