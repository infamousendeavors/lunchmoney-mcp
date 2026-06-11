#!/usr/bin/env node

import { createServer, startServer } from "./server.js";
import { runSetupWizard } from "./setup.js";
import {
  createAuthProvider,
  getAuthCredentialsFromEnv,
  type AuthProviderType,
} from "./auth-provider.js";
import { CredentialStore } from "./credential-store.js";
import { createSessionStore } from "./session-store.js";
import {
  parseAllowlist,
  isAllowlistConfigured,
  wrapAuthenticateWithAllowlist,
} from "./authorization.js";
import { createRequire } from "module";

export interface CLIOptions {
  mode: "stdio" | "http" | "setup" | "version";
  port: number;
}

export function parseArgs(argv: string[]): CLIOptions {
  const args = argv.slice(2); // skip node and script path

  // Check for --version
  if (args.includes("--version") || args.includes("-v")) {
    return { mode: "version", port: 8080 };
  }

  // Check for setup command
  if (args.includes("setup")) {
    return { mode: "setup", port: 8080 };
  }

  // Check for --http flag
  const isHttp = args.includes("--http");

  // Check for --port flag
  let port = 8080;
  const portIndex = args.indexOf("--port");
  if (portIndex !== -1 && portIndex + 1 < args.length) {
    const parsedPort = parseInt(args[portIndex + 1], 10);
    if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
      port = parsedPort;
    }
  }

  // Also check PORT env var if --port not specified on CLI
  if (portIndex === -1 && process.env.PORT) {
    const envPort = parseInt(process.env.PORT, 10);
    if (!isNaN(envPort) && envPort > 0 && envPort <= 65535) {
      port = envPort;
    }
  }

  return {
    mode: isHttp ? "http" : "stdio",
    port,
  };
}

/**
 * Resolve the auth provider type from the AUTH_PROVIDER env var.
 * Defaults to 'google' if not set. Throws if invalid.
 */
export function resolveAuthProvider(): AuthProviderType {
  const providerEnv = process.env.AUTH_PROVIDER || "google";
  const valid: AuthProviderType[] = ["google", "github", "cyberark", "custom"];
  if (!valid.includes(providerEnv as AuthProviderType)) {
    throw new Error(
      `Invalid AUTH_PROVIDER="${providerEnv}". Supported: ${valid.join(", ")}`
    );
  }
  return providerEnv as AuthProviderType;
}

async function main() {
  const options = parseArgs(process.argv);

  switch (options.mode) {
    case "version": {
      const require = createRequire(import.meta.url);
      const pkg = require("../package.json");
      console.log(`lunchmoney-mcp v${pkg.version}`);
      break;
    }

    case "setup": {
      await runSetupWizard();
      break;
    }

    case "http": {
      // HTTP mode requires OAuth
      const providerType = resolveAuthProvider();
      const envConfig = getAuthCredentialsFromEnv(providerType);
      const baseUrl = process.env.BASE_URL || `http://localhost:${options.port}`;

      // Authorization gate: OAuth only proves the caller has *an* account at the
      // IdP, not that they own this server's Lunch Money token. Require an
      // explicit allow-list and fail closed when it is missing — otherwise any
      // authenticated IdP account would gain full access to the owner's finances.
      const allowlist = parseAllowlist();
      if (!isAllowlistConfigured(allowlist)) {
        throw new Error(
          "HTTP mode requires an authorization allow-list. Set at least one of " +
            "ALLOWED_EMAILS, ALLOWED_EMAIL_DOMAINS, or ALLOWED_GITHUB_USERS so only " +
            "authorized accounts can access your Lunch Money data. Refusing to start " +
            "with OAuth authentication but no authorization."
        );
      }

      // Create encrypted session store for persisting OAuth tokens across restarts
      const credentialStore = new CredentialStore();
      const tokenStorage = await createSessionStore(credentialStore);

      const auth = createAuthProvider({
        provider: providerType,
        baseUrl,
        clientId: envConfig.clientId,
        clientSecret: envConfig.clientSecret,
        cyberarkTenantUrl: envConfig.cyberarkTenantUrl,
        authorizationEndpoint: envConfig.authorizationEndpoint,
        tokenEndpoint: envConfig.tokenEndpoint,
        scopes: envConfig.scopes,
        tokenStorage,
        // Disable FastMCP's built-in encryption since EncryptedTokenStorage already handles it
        encryptionKey: false,
      });

      const authenticate = wrapAuthenticateWithAllowlist(providerType, auth, allowlist);

      const server = await createServer({ auth, authenticate, health: true });
      await startServer(server, "httpStream", options.port, providerType);
      break;
    }

    case "stdio":
    default: {
      const server = await createServer();
      await startServer(server, "stdio");
      break;
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error.message || error);
  process.exit(1);
});
