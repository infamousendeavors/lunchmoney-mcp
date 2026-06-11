import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseAllowlist,
  isAllowlistConfigured,
  decodeJwtPayload,
  identityFromIdToken,
  isIdentityAllowed,
  resolveIdentity,
  wrapAuthenticateWithAllowlist,
  type Allowlist,
  type ResolvedIdentity,
} from "../src/authorization.js";

/** Build a JWT with the given payload (signature is irrelevant — we never verify it). */
function makeJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "RS256", typ: "JWT" })}.${b64(payload)}.fakesignature`;
}

describe("parseAllowlist", () => {
  it("parses, trims, and lowercases all three lists", () => {
    const a = parseAllowlist({
      ALLOWED_EMAILS: "Alice@Example.com, bob@example.com ",
      ALLOWED_EMAIL_DOMAINS: " Example.COM ,corp.io",
      ALLOWED_GITHUB_USERS: "OctoCat, infamousjoeg",
    });
    expect([...a.emails]).toEqual(["alice@example.com", "bob@example.com"]);
    expect([...a.domains]).toEqual(["example.com", "corp.io"]);
    expect([...a.githubUsers]).toEqual(["octocat", "infamousjoeg"]);
  });

  it("strips a leading @ from domains", () => {
    const a = parseAllowlist({ ALLOWED_EMAIL_DOMAINS: "@example.com" });
    expect([...a.domains]).toEqual(["example.com"]);
  });

  it("ignores empty entries", () => {
    const a = parseAllowlist({ ALLOWED_EMAILS: " , ,, " });
    expect(a.emails.size).toBe(0);
  });

  it("returns empty sets when nothing is configured", () => {
    const a = parseAllowlist({});
    expect(isAllowlistConfigured(a)).toBe(false);
  });
});

describe("isAllowlistConfigured", () => {
  it("is true when any list is non-empty", () => {
    expect(isAllowlistConfigured(parseAllowlist({ ALLOWED_EMAILS: "a@b.com" }))).toBe(true);
    expect(isAllowlistConfigured(parseAllowlist({ ALLOWED_EMAIL_DOMAINS: "b.com" }))).toBe(true);
    expect(isAllowlistConfigured(parseAllowlist({ ALLOWED_GITHUB_USERS: "x" }))).toBe(true);
  });
});

describe("decodeJwtPayload", () => {
  it("decodes a base64url JWT payload", () => {
    const jwt = makeJwt({ email: "a@b.com", sub: "123" });
    expect(decodeJwtPayload(jwt)).toMatchObject({ email: "a@b.com", sub: "123" });
  });

  it("returns undefined for malformed input", () => {
    expect(decodeJwtPayload("not-a-jwt")).toBeUndefined();
    expect(decodeJwtPayload("")).toBeUndefined();
    expect(decodeJwtPayload("a.b")).toBeUndefined();
  });
});

describe("identityFromIdToken", () => {
  it("extracts email, verification, and hosted domain", () => {
    const jwt = makeJwt({ email: "User@Example.com", email_verified: true, hd: "example.com" });
    const id = identityFromIdToken(jwt);
    expect(id).toEqual({
      email: "User@Example.com",
      emailVerified: true,
      hostedDomain: "example.com",
    });
  });

  it("coerces a string email_verified of 'true'", () => {
    const jwt = makeJwt({ email: "u@e.com", email_verified: "true" });
    expect(identityFromIdToken(jwt).emailVerified).toBe(true);
  });

  it("treats a missing email_verified as unverified", () => {
    const jwt = makeJwt({ email: "u@e.com" });
    expect(identityFromIdToken(jwt).emailVerified).toBe(false);
  });
});

describe("isIdentityAllowed", () => {
  const allowlist: Allowlist = parseAllowlist({
    ALLOWED_EMAILS: "owner@example.com",
    ALLOWED_EMAIL_DOMAINS: "corp.io",
    ALLOWED_GITHUB_USERS: "infamousjoeg",
  });

  it("allows an exact verified email match", () => {
    const id: ResolvedIdentity = { email: "Owner@Example.com", emailVerified: true };
    expect(isIdentityAllowed(allowlist, "google", id)).toBe(true);
  });

  it("rejects an allow-listed email that is NOT verified", () => {
    const id: ResolvedIdentity = { email: "owner@example.com", emailVerified: false };
    expect(isIdentityAllowed(allowlist, "google", id)).toBe(false);
  });

  it("allows a verified email whose domain is allow-listed", () => {
    const id: ResolvedIdentity = { email: "someone@corp.io", emailVerified: true };
    expect(isIdentityAllowed(allowlist, "google", id)).toBe(true);
  });

  it("allows a Google Workspace hosted-domain match", () => {
    const id: ResolvedIdentity = { email: "x@corp.io", emailVerified: true, hostedDomain: "corp.io" };
    expect(isIdentityAllowed(allowlist, "google", id)).toBe(true);
  });

  it("allows a hosted-domain match even when the email is unverified (hd is asserted by Google, not user-set)", () => {
    const id: ResolvedIdentity = { email: "x@corp.io", emailVerified: false, hostedDomain: "corp.io" };
    expect(isIdentityAllowed(allowlist, "google", id)).toBe(true);
  });

  it("rejects an unverified email whose hosted domain is NOT allow-listed", () => {
    const id: ResolvedIdentity = { email: "x@corp.io", emailVerified: false, hostedDomain: "evil.com" };
    expect(isIdentityAllowed(allowlist, "google", id)).toBe(false);
  });

  it("does not allow look-alike domains (evil-example or subdomain suffix)", () => {
    expect(
      isIdentityAllowed(allowlist, "google", { email: "a@evil-corp.io", emailVerified: true })
    ).toBe(false);
    expect(
      isIdentityAllowed(allowlist, "google", { email: "a@corp.io.attacker.com", emailVerified: true })
    ).toBe(false);
  });

  it("rejects a stranger's verified email", () => {
    const id: ResolvedIdentity = { email: "attacker@gmail.com", emailVerified: true };
    expect(isIdentityAllowed(allowlist, "google", id)).toBe(false);
  });

  it("allows a GitHub username match without requiring email verification", () => {
    const id: ResolvedIdentity = { username: "InfamousJoeg" };
    expect(isIdentityAllowed(allowlist, "github", id)).toBe(true);
  });

  it("rejects a non-allow-listed GitHub username", () => {
    const id: ResolvedIdentity = { username: "randoperson" };
    expect(isIdentityAllowed(allowlist, "github", id)).toBe(false);
  });

  it("fails closed on an empty identity", () => {
    expect(isIdentityAllowed(allowlist, "google", {})).toBe(false);
  });
});

describe("resolveIdentity", () => {
  it("decodes the idToken for OIDC providers without a network call", async () => {
    const idToken = makeJwt({ email: "u@e.com", email_verified: true, hd: "e.com" });
    const fetchSpy = vi.fn();
    const id = await resolveIdentity("google", { accessToken: "ua", idToken } as any, fetchSpy);
    expect(id).toEqual({ email: "u@e.com", emailVerified: true, hostedDomain: "e.com" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("calls the GitHub API for the username and verified primary email", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ login: "octocat" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { email: "old@e.com", primary: false, verified: true },
          { email: "octo@e.com", primary: true, verified: true },
        ],
      });
    const id = await resolveIdentity("github", { accessToken: "ghtok" } as any, fetchSpy);
    expect(id).toEqual({ username: "octocat", email: "octo@e.com", emailVerified: true });
    const firstUrl = fetchSpy.mock.calls[0][0];
    expect(firstUrl).toBe("https://api.github.com/user");
  });

  it("returns undefined (fail closed) when GitHub API rejects the token", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    const id = await resolveIdentity("github", { accessToken: "bad" } as any, fetchSpy);
    expect(id).toBeUndefined();
  });

  it("returns undefined when an OIDC session carries no idToken", async () => {
    const id = await resolveIdentity("custom", { accessToken: "ua" } as any, vi.fn());
    expect(id).toBeUndefined();
  });
});

describe("wrapAuthenticateWithAllowlist", () => {
  const allowlist = parseAllowlist({ ALLOWED_EMAILS: "owner@example.com" });

  function googleProviderReturning(session: unknown) {
    return { authenticate: vi.fn().mockResolvedValue(session) } as any;
  }

  it("passes through unauthenticated requests (returns undefined)", async () => {
    const provider = googleProviderReturning(undefined);
    const gate = wrapAuthenticateWithAllowlist("google", provider, allowlist);
    await expect(gate(undefined)).resolves.toBeUndefined();
  });

  it("returns the session for an allow-listed identity", async () => {
    const idToken = makeJwt({ email: "owner@example.com", email_verified: true });
    const session = { accessToken: "ua", idToken };
    const provider = googleProviderReturning(session);
    const gate = wrapAuthenticateWithAllowlist("google", provider, allowlist);
    await expect(gate({} as any)).resolves.toBe(session);
  });

  it("THROWS for an authenticated but non-allow-listed identity", async () => {
    const idToken = makeJwt({ email: "attacker@gmail.com", email_verified: true });
    const provider = googleProviderReturning({ accessToken: "ua", idToken });
    const gate = wrapAuthenticateWithAllowlist("google", provider, allowlist);
    await expect(gate({} as any)).rejects.toThrow(/not authorized|access denied/i);
  });

  it("THROWS (fail closed) when identity cannot be resolved", async () => {
    const provider = googleProviderReturning({ accessToken: "ua" }); // no idToken
    const gate = wrapAuthenticateWithAllowlist("google", provider, allowlist);
    await expect(gate({} as any)).rejects.toThrow(/not authorized|access denied/i);
  });

  it("does not leak the rejected email in the thrown error message", async () => {
    const idToken = makeJwt({ email: "secret-victim@gmail.com", email_verified: true });
    const provider = googleProviderReturning({ accessToken: "ua", idToken });
    const gate = wrapAuthenticateWithAllowlist("google", provider, allowlist);
    await expect(gate({} as any)).rejects.not.toThrow(/secret-victim/);
  });
});
