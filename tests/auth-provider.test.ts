import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Hoist mock values so they're available in vi.mock factory
const mocks = vi.hoisted(() => {
  // Use mockImplementation for classes called with `new`
  const GoogleProviderMock = vi.fn().mockImplementation(function (this: any, config: any) {
    this.type = "google";
    this.config = config;
  });
  const GitHubProviderMock = vi.fn().mockImplementation(function (this: any, config: any) {
    this.type = "github";
    this.config = config;
  });
  const OAuthProviderMock = vi.fn().mockImplementation(function (this: any, config: any) {
    this.type = "oauth";
    this.config = config;
  });
  return {
    GoogleProviderMock,
    GitHubProviderMock,
    OAuthProviderMock,
  };
});

vi.mock("fastmcp", () => ({
  GoogleProvider: mocks.GoogleProviderMock,
  GitHubProvider: mocks.GitHubProviderMock,
  OAuthProvider: mocks.OAuthProviderMock,
}));

import {
  createAuthProvider,
  getAuthCredentialsFromEnv,
  type AuthProviderType,
} from "../src/auth-provider.js";

describe("auth-provider", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("createAuthProvider", () => {
    it("creates a Google provider with correct config", () => {
      const result = createAuthProvider({
        provider: "google",
        baseUrl: "http://localhost:8080",
        clientId: "google-client-id",
        clientSecret: "google-client-secret",
      });

      expect(mocks.GoogleProviderMock).toHaveBeenCalledWith({
        clientId: "google-client-id",
        clientSecret: "google-client-secret",
        baseUrl: "http://localhost:8080",
        scopes: ["openid", "email"],
      });
      expect(result).toHaveProperty("type", "google");
    });

    it("does not disable the Google consent screen", () => {
      createAuthProvider({
        provider: "google",
        baseUrl: "http://localhost:8080",
        clientId: "google-client-id",
        clientSecret: "google-client-secret",
      });

      const config = mocks.GoogleProviderMock.mock.calls[0][0];
      // Security: consentRequired:false was removed in 0.3.0 so Google shows
      // its consent screen on first-time grants (anti silent-grant / phishing).
      expect(config.consentRequired).not.toBe(false);
    });

    it("creates a GitHub provider with correct config", () => {
      const result = createAuthProvider({
        provider: "github",
        baseUrl: "http://localhost:3000",
        clientId: "github-client-id",
        clientSecret: "github-client-secret",
      });

      expect(mocks.GitHubProviderMock).toHaveBeenCalledWith({
        clientId: "github-client-id",
        clientSecret: "github-client-secret",
        baseUrl: "http://localhost:3000",
        scopes: ["read:user", "user:email"],
      });
      expect(result).toHaveProperty("type", "github");
    });

    it("throws for unknown provider type", () => {
      expect(() =>
        createAuthProvider({
          provider: "unknown" as AuthProviderType,
          baseUrl: "http://localhost:8080",
          clientId: "id",
          clientSecret: "secret",
        })
      ).toThrow("Unknown auth provider: unknown. Supported: google, github, cyberark, custom");
    });

    it("passes different baseUrl values correctly", () => {
      createAuthProvider({
        provider: "google",
        baseUrl: "https://mcp.example.com",
        clientId: "id",
        clientSecret: "secret",
      });

      expect(mocks.GoogleProviderMock).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: "https://mcp.example.com",
        })
      );
    });

    describe("cyberark provider", () => {
      it("creates a CyberArk provider with correct config", () => {
        const result = createAuthProvider({
          provider: "cyberark",
          baseUrl: "http://localhost:8080",
          clientId: "cyberark-client-id",
          clientSecret: "cyberark-client-secret",
          cyberarkTenantUrl: "https://abc1234.id.cyberark.cloud",
        });

        expect(mocks.OAuthProviderMock).toHaveBeenCalledWith({
          clientId: "cyberark-client-id",
          clientSecret: "cyberark-client-secret",
          baseUrl: "http://localhost:8080",
          authorizationEndpoint: "https://abc1234.id.cyberark.cloud/oauth2/authorize",
          tokenEndpoint: "https://abc1234.id.cyberark.cloud/oauth2/token",
          scopes: ["openid", "email", "profile"],
        });
        expect(result).toHaveProperty("type", "oauth");
      });

      it("throws when cyberarkTenantUrl is missing", () => {
        expect(() =>
          createAuthProvider({
            provider: "cyberark",
            baseUrl: "http://localhost:8080",
            clientId: "id",
            clientSecret: "secret",
          })
        ).toThrow("cyberarkTenantUrl is required for CyberArk Identity OAuth");
      });

      it("constructs correct OIDC endpoints from tenant URL", () => {
        createAuthProvider({
          provider: "cyberark",
          baseUrl: "http://localhost:8080",
          clientId: "id",
          clientSecret: "secret",
          cyberarkTenantUrl: "https://my-tenant.id.cyberark.cloud",
        });

        expect(mocks.OAuthProviderMock).toHaveBeenCalledWith(
          expect.objectContaining({
            authorizationEndpoint: "https://my-tenant.id.cyberark.cloud/oauth2/authorize",
            tokenEndpoint: "https://my-tenant.id.cyberark.cloud/oauth2/token",
          })
        );
      });
    });

    describe("custom provider", () => {
      it("creates a custom provider with correct config", () => {
        const result = createAuthProvider({
          provider: "custom",
          baseUrl: "http://localhost:8080",
          clientId: "custom-client-id",
          clientSecret: "custom-client-secret",
          authorizationEndpoint: "https://idp.example.com/authorize",
          tokenEndpoint: "https://idp.example.com/token",
        });

        expect(mocks.OAuthProviderMock).toHaveBeenCalledWith({
          clientId: "custom-client-id",
          clientSecret: "custom-client-secret",
          baseUrl: "http://localhost:8080",
          authorizationEndpoint: "https://idp.example.com/authorize",
          tokenEndpoint: "https://idp.example.com/token",
          scopes: ["openid", "email"],
        });
        expect(result).toHaveProperty("type", "oauth");
      });

      it("throws when authorizationEndpoint is missing", () => {
        expect(() =>
          createAuthProvider({
            provider: "custom",
            baseUrl: "http://localhost:8080",
            clientId: "id",
            clientSecret: "secret",
            tokenEndpoint: "https://idp.example.com/token",
          })
        ).toThrow("authorizationEndpoint and tokenEndpoint are required for custom OAuth");
      });

      it("throws when tokenEndpoint is missing", () => {
        expect(() =>
          createAuthProvider({
            provider: "custom",
            baseUrl: "http://localhost:8080",
            clientId: "id",
            clientSecret: "secret",
            authorizationEndpoint: "https://idp.example.com/authorize",
          })
        ).toThrow("authorizationEndpoint and tokenEndpoint are required for custom OAuth");
      });

      it("uses custom scopes when provided", () => {
        createAuthProvider({
          provider: "custom",
          baseUrl: "http://localhost:8080",
          clientId: "id",
          clientSecret: "secret",
          authorizationEndpoint: "https://idp.example.com/authorize",
          tokenEndpoint: "https://idp.example.com/token",
          scopes: ["api", "read", "write"],
        });

        expect(mocks.OAuthProviderMock).toHaveBeenCalledWith(
          expect.objectContaining({
            scopes: ["api", "read", "write"],
          })
        );
      });

      it("defaults scopes to openid and email when not provided", () => {
        createAuthProvider({
          provider: "custom",
          baseUrl: "http://localhost:8080",
          clientId: "id",
          clientSecret: "secret",
          authorizationEndpoint: "https://idp.example.com/authorize",
          tokenEndpoint: "https://idp.example.com/token",
        });

        expect(mocks.OAuthProviderMock).toHaveBeenCalledWith(
          expect.objectContaining({
            scopes: ["openid", "email"],
          })
        );
      });
    });
  });

  describe("getAuthCredentialsFromEnv", () => {
    describe("google provider", () => {
      it("returns credentials when both env vars are set", () => {
        process.env.GOOGLE_CLIENT_ID = "test-google-id";
        process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";

        const result = getAuthCredentialsFromEnv("google");

        expect(result).toEqual({
          clientId: "test-google-id",
          clientSecret: "test-google-secret",
        });
      });

      it("throws when GOOGLE_CLIENT_ID is missing", () => {
        delete process.env.GOOGLE_CLIENT_ID;
        process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";

        expect(() => getAuthCredentialsFromEnv("google")).toThrow(
          "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required for Google OAuth"
        );
      });

      it("throws when GOOGLE_CLIENT_SECRET is missing", () => {
        process.env.GOOGLE_CLIENT_ID = "test-google-id";
        delete process.env.GOOGLE_CLIENT_SECRET;

        expect(() => getAuthCredentialsFromEnv("google")).toThrow(
          "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required for Google OAuth"
        );
      });

      it("throws when both Google env vars are missing", () => {
        delete process.env.GOOGLE_CLIENT_ID;
        delete process.env.GOOGLE_CLIENT_SECRET;

        expect(() => getAuthCredentialsFromEnv("google")).toThrow(
          "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required for Google OAuth"
        );
      });

      it("throws when GOOGLE_CLIENT_ID is empty string", () => {
        process.env.GOOGLE_CLIENT_ID = "";
        process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";

        expect(() => getAuthCredentialsFromEnv("google")).toThrow(
          "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required for Google OAuth"
        );
      });
    });

    describe("github provider", () => {
      it("returns credentials when both env vars are set", () => {
        process.env.GITHUB_CLIENT_ID = "test-github-id";
        process.env.GITHUB_CLIENT_SECRET = "test-github-secret";

        const result = getAuthCredentialsFromEnv("github");

        expect(result).toEqual({
          clientId: "test-github-id",
          clientSecret: "test-github-secret",
        });
      });

      it("throws when GITHUB_CLIENT_ID is missing", () => {
        delete process.env.GITHUB_CLIENT_ID;
        process.env.GITHUB_CLIENT_SECRET = "test-github-secret";

        expect(() => getAuthCredentialsFromEnv("github")).toThrow(
          "GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables are required for GitHub OAuth"
        );
      });

      it("throws when GITHUB_CLIENT_SECRET is missing", () => {
        process.env.GITHUB_CLIENT_ID = "test-github-id";
        delete process.env.GITHUB_CLIENT_SECRET;

        expect(() => getAuthCredentialsFromEnv("github")).toThrow(
          "GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables are required for GitHub OAuth"
        );
      });

      it("throws when both GitHub env vars are missing", () => {
        delete process.env.GITHUB_CLIENT_ID;
        delete process.env.GITHUB_CLIENT_SECRET;

        expect(() => getAuthCredentialsFromEnv("github")).toThrow(
          "GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables are required for GitHub OAuth"
        );
      });
    });

    describe("cyberark provider", () => {
      it("returns credentials and tenant URL when all env vars are set", () => {
        process.env.CYBERARK_TENANT_URL = "https://abc1234.id.cyberark.cloud";
        process.env.CYBERARK_CLIENT_ID = "cyberark-id";
        process.env.CYBERARK_CLIENT_SECRET = "cyberark-secret";

        const result = getAuthCredentialsFromEnv("cyberark");

        expect(result).toEqual({
          clientId: "cyberark-id",
          clientSecret: "cyberark-secret",
          cyberarkTenantUrl: "https://abc1234.id.cyberark.cloud",
        });
      });

      it("falls back to OAUTH_CLIENT_ID when CYBERARK_CLIENT_ID is missing", () => {
        process.env.CYBERARK_TENANT_URL = "https://abc1234.id.cyberark.cloud";
        delete process.env.CYBERARK_CLIENT_ID;
        process.env.OAUTH_CLIENT_ID = "fallback-id";
        process.env.CYBERARK_CLIENT_SECRET = "cyberark-secret";

        const result = getAuthCredentialsFromEnv("cyberark");

        expect(result.clientId).toBe("fallback-id");
      });

      it("falls back to OAUTH_CLIENT_SECRET when CYBERARK_CLIENT_SECRET is missing", () => {
        process.env.CYBERARK_TENANT_URL = "https://abc1234.id.cyberark.cloud";
        process.env.CYBERARK_CLIENT_ID = "cyberark-id";
        delete process.env.CYBERARK_CLIENT_SECRET;
        process.env.OAUTH_CLIENT_SECRET = "fallback-secret";

        const result = getAuthCredentialsFromEnv("cyberark");

        expect(result.clientSecret).toBe("fallback-secret");
      });

      it("throws when CYBERARK_TENANT_URL is missing", () => {
        delete process.env.CYBERARK_TENANT_URL;
        process.env.CYBERARK_CLIENT_ID = "cyberark-id";
        process.env.CYBERARK_CLIENT_SECRET = "cyberark-secret";

        expect(() => getAuthCredentialsFromEnv("cyberark")).toThrow(
          "CYBERARK_TENANT_URL, CYBERARK_CLIENT_ID (or OAUTH_CLIENT_ID), and CYBERARK_CLIENT_SECRET (or OAUTH_CLIENT_SECRET) are required for CyberArk Identity OAuth"
        );
      });

      it("throws when client ID is missing from both CYBERARK and OAUTH env vars", () => {
        process.env.CYBERARK_TENANT_URL = "https://abc1234.id.cyberark.cloud";
        delete process.env.CYBERARK_CLIENT_ID;
        delete process.env.OAUTH_CLIENT_ID;
        process.env.CYBERARK_CLIENT_SECRET = "cyberark-secret";

        expect(() => getAuthCredentialsFromEnv("cyberark")).toThrow(
          "CYBERARK_TENANT_URL, CYBERARK_CLIENT_ID (or OAUTH_CLIENT_ID), and CYBERARK_CLIENT_SECRET (or OAUTH_CLIENT_SECRET) are required for CyberArk Identity OAuth"
        );
      });

      it("throws when client secret is missing from both CYBERARK and OAUTH env vars", () => {
        process.env.CYBERARK_TENANT_URL = "https://abc1234.id.cyberark.cloud";
        process.env.CYBERARK_CLIENT_ID = "cyberark-id";
        delete process.env.CYBERARK_CLIENT_SECRET;
        delete process.env.OAUTH_CLIENT_SECRET;

        expect(() => getAuthCredentialsFromEnv("cyberark")).toThrow(
          "CYBERARK_TENANT_URL, CYBERARK_CLIENT_ID (or OAUTH_CLIENT_ID), and CYBERARK_CLIENT_SECRET (or OAUTH_CLIENT_SECRET) are required for CyberArk Identity OAuth"
        );
      });
    });

    describe("custom provider", () => {
      it("returns credentials and endpoints when all env vars are set", () => {
        process.env.OAUTH_AUTH_URL = "https://idp.example.com/authorize";
        process.env.OAUTH_TOKEN_URL = "https://idp.example.com/token";
        process.env.OAUTH_CLIENT_ID = "custom-id";
        process.env.OAUTH_CLIENT_SECRET = "custom-secret";

        const result = getAuthCredentialsFromEnv("custom");

        expect(result).toEqual({
          clientId: "custom-id",
          clientSecret: "custom-secret",
          authorizationEndpoint: "https://idp.example.com/authorize",
          tokenEndpoint: "https://idp.example.com/token",
          scopes: undefined,
        });
      });

      it("parses OAUTH_SCOPES into array", () => {
        process.env.OAUTH_AUTH_URL = "https://idp.example.com/authorize";
        process.env.OAUTH_TOKEN_URL = "https://idp.example.com/token";
        process.env.OAUTH_CLIENT_ID = "custom-id";
        process.env.OAUTH_CLIENT_SECRET = "custom-secret";
        process.env.OAUTH_SCOPES = "api,read,write";

        const result = getAuthCredentialsFromEnv("custom");

        expect(result.scopes).toEqual(["api", "read", "write"]);
      });

      it("throws when OAUTH_AUTH_URL is missing", () => {
        delete process.env.OAUTH_AUTH_URL;
        process.env.OAUTH_TOKEN_URL = "https://idp.example.com/token";
        process.env.OAUTH_CLIENT_ID = "custom-id";
        process.env.OAUTH_CLIENT_SECRET = "custom-secret";

        expect(() => getAuthCredentialsFromEnv("custom")).toThrow(
          "OAUTH_AUTH_URL, OAUTH_TOKEN_URL, OAUTH_CLIENT_ID, and OAUTH_CLIENT_SECRET are required for custom OAuth"
        );
      });

      it("throws when OAUTH_TOKEN_URL is missing", () => {
        process.env.OAUTH_AUTH_URL = "https://idp.example.com/authorize";
        delete process.env.OAUTH_TOKEN_URL;
        process.env.OAUTH_CLIENT_ID = "custom-id";
        process.env.OAUTH_CLIENT_SECRET = "custom-secret";

        expect(() => getAuthCredentialsFromEnv("custom")).toThrow(
          "OAUTH_AUTH_URL, OAUTH_TOKEN_URL, OAUTH_CLIENT_ID, and OAUTH_CLIENT_SECRET are required for custom OAuth"
        );
      });

      it("throws when OAUTH_CLIENT_ID is missing", () => {
        process.env.OAUTH_AUTH_URL = "https://idp.example.com/authorize";
        process.env.OAUTH_TOKEN_URL = "https://idp.example.com/token";
        delete process.env.OAUTH_CLIENT_ID;
        process.env.OAUTH_CLIENT_SECRET = "custom-secret";

        expect(() => getAuthCredentialsFromEnv("custom")).toThrow(
          "OAUTH_AUTH_URL, OAUTH_TOKEN_URL, OAUTH_CLIENT_ID, and OAUTH_CLIENT_SECRET are required for custom OAuth"
        );
      });

      it("throws when OAUTH_CLIENT_SECRET is missing", () => {
        process.env.OAUTH_AUTH_URL = "https://idp.example.com/authorize";
        process.env.OAUTH_TOKEN_URL = "https://idp.example.com/token";
        process.env.OAUTH_CLIENT_ID = "custom-id";
        delete process.env.OAUTH_CLIENT_SECRET;

        expect(() => getAuthCredentialsFromEnv("custom")).toThrow(
          "OAUTH_AUTH_URL, OAUTH_TOKEN_URL, OAUTH_CLIENT_ID, and OAUTH_CLIENT_SECRET are required for custom OAuth"
        );
      });

      it("throws when all custom env vars are missing", () => {
        delete process.env.OAUTH_AUTH_URL;
        delete process.env.OAUTH_TOKEN_URL;
        delete process.env.OAUTH_CLIENT_ID;
        delete process.env.OAUTH_CLIENT_SECRET;

        expect(() => getAuthCredentialsFromEnv("custom")).toThrow(
          "OAUTH_AUTH_URL, OAUTH_TOKEN_URL, OAUTH_CLIENT_ID, and OAUTH_CLIENT_SECRET are required for custom OAuth"
        );
      });
    });

    describe("unknown provider", () => {
      it("throws for invalid provider name and lists all supported providers", () => {
        expect(() =>
          getAuthCredentialsFromEnv("okta" as AuthProviderType)
        ).toThrow("Unknown auth provider: okta. Supported: google, github, cyberark, custom");
      });
    });
  });
});
