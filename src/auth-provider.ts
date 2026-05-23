import { GoogleProvider, GitHubProvider, OAuthProvider } from "fastmcp";
import type { TokenStorage } from "fastmcp/auth";

export type AuthProviderType = "google" | "github" | "cyberark" | "custom";

export interface AuthProviderOptions {
  provider: AuthProviderType;
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  /** CyberArk tenant URL (e.g. https://abc1234.id.cyberark.cloud) - required for cyberark provider */
  cyberarkTenantUrl?: string;
  /** OAuth authorization endpoint URL - required for custom provider */
  authorizationEndpoint?: string;
  /** OAuth token endpoint URL - required for custom provider */
  tokenEndpoint?: string;
  /** OAuth scopes - optional for custom provider (defaults to ['openid', 'email']) */
  scopes?: string[];
  /** Token storage backend for persisting OAuth sessions across restarts */
  tokenStorage?: TokenStorage;
  /** Encryption key for token storage (set to false to disable if already encrypted, or provide a hex string) */
  encryptionKey?: false | string;
}

/**
 * Create an OAuth auth provider for use with FastMCP HTTP transport.
 * Supports Google, GitHub, CyberArk Identity, and custom OAuth providers.
 */
export function createAuthProvider(options: AuthProviderOptions) {
  const { provider, baseUrl, clientId, clientSecret } = options;

  switch (provider) {
    case "google":
      return new GoogleProvider({
        clientId,
        clientSecret,
        baseUrl,
        scopes: ["openid", "email"],
        // consentRequired left at the provider default so Google shows its
        // consent screen on first-time grants. Disabling it (0.2.x did) raised
        // silent-grant / phishing risk for a server holding financial data.
        ...(options.tokenStorage && { tokenStorage: options.tokenStorage }),
        ...(options.encryptionKey !== undefined && { encryptionKey: options.encryptionKey }),
      });

    case "github":
      return new GitHubProvider({
        clientId,
        clientSecret,
        baseUrl,
        scopes: ["read:user", "user:email"],
        ...(options.tokenStorage && { tokenStorage: options.tokenStorage }),
        ...(options.encryptionKey !== undefined && { encryptionKey: options.encryptionKey }),
      });

    case "cyberark": {
      const tenantUrl = options.cyberarkTenantUrl;
      if (!tenantUrl) {
        throw new Error(
          "cyberarkTenantUrl is required for CyberArk Identity OAuth"
        );
      }
      return new OAuthProvider({
        clientId,
        clientSecret,
        baseUrl,
        authorizationEndpoint: `${tenantUrl}/oauth2/authorize`,
        tokenEndpoint: `${tenantUrl}/oauth2/token`,
        scopes: ["openid", "email", "profile"],
        ...(options.tokenStorage && { tokenStorage: options.tokenStorage }),
        ...(options.encryptionKey !== undefined && { encryptionKey: options.encryptionKey }),
      });
    }

    case "custom": {
      if (!options.authorizationEndpoint || !options.tokenEndpoint) {
        throw new Error(
          "authorizationEndpoint and tokenEndpoint are required for custom OAuth"
        );
      }
      return new OAuthProvider({
        clientId,
        clientSecret,
        baseUrl,
        authorizationEndpoint: options.authorizationEndpoint,
        tokenEndpoint: options.tokenEndpoint,
        scopes: options.scopes || ["openid", "email"],
        ...(options.tokenStorage && { tokenStorage: options.tokenStorage }),
        ...(options.encryptionKey !== undefined && { encryptionKey: options.encryptionKey }),
      });
    }

    default:
      throw new Error(
        `Unknown auth provider: ${provider as string}. Supported: google, github, cyberark, custom`
      );
  }
}

/**
 * Additional environment-based config for providers that need extra fields.
 */
export interface AuthProviderEnvConfig {
  clientId: string;
  clientSecret: string;
  /** CyberArk tenant URL - present only for cyberark provider */
  cyberarkTenantUrl?: string;
  /** OAuth authorization endpoint - present only for custom provider */
  authorizationEndpoint?: string;
  /** OAuth token endpoint - present only for custom provider */
  tokenEndpoint?: string;
  /** OAuth scopes - present only for custom provider */
  scopes?: string[];
}

/**
 * Read OAuth credentials from environment variables for the given provider.
 * Throws if required env vars are missing.
 */
export function getAuthCredentialsFromEnv(provider: AuthProviderType): AuthProviderEnvConfig {
  switch (provider) {
    case "google": {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        throw new Error(
          "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required for Google OAuth"
        );
      }
      return { clientId, clientSecret };
    }

    case "github": {
      const clientId = process.env.GITHUB_CLIENT_ID;
      const clientSecret = process.env.GITHUB_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        throw new Error(
          "GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables are required for GitHub OAuth"
        );
      }
      return { clientId, clientSecret };
    }

    case "cyberark": {
      const tenantUrl = process.env.CYBERARK_TENANT_URL;
      const clientId = process.env.CYBERARK_CLIENT_ID || process.env.OAUTH_CLIENT_ID;
      const clientSecret = process.env.CYBERARK_CLIENT_SECRET || process.env.OAUTH_CLIENT_SECRET;
      if (!tenantUrl || !clientId || !clientSecret) {
        throw new Error(
          "CYBERARK_TENANT_URL, CYBERARK_CLIENT_ID (or OAUTH_CLIENT_ID), and CYBERARK_CLIENT_SECRET (or OAUTH_CLIENT_SECRET) are required for CyberArk Identity OAuth"
        );
      }
      return { clientId, clientSecret, cyberarkTenantUrl: tenantUrl };
    }

    case "custom": {
      const authorizationEndpoint = process.env.OAUTH_AUTH_URL;
      const tokenEndpoint = process.env.OAUTH_TOKEN_URL;
      const clientId = process.env.OAUTH_CLIENT_ID;
      const clientSecret = process.env.OAUTH_CLIENT_SECRET;
      const scopes = process.env.OAUTH_SCOPES?.split(",") || undefined;
      if (!authorizationEndpoint || !tokenEndpoint || !clientId || !clientSecret) {
        throw new Error(
          "OAUTH_AUTH_URL, OAUTH_TOKEN_URL, OAUTH_CLIENT_ID, and OAUTH_CLIENT_SECRET are required for custom OAuth"
        );
      }
      return { clientId, clientSecret, authorizationEndpoint, tokenEndpoint, scopes };
    }

    default:
      throw new Error(
        `Unknown auth provider: ${provider as string}. Supported: google, github, cyberark, custom`
      );
  }
}
