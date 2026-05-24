# Security

## Credential Architecture

lunchmoney-mcp uses a two-tier credential architecture designed to keep your financial data secure.

### Tier 1: OS Keychain (Long-lived Secrets)

Your Lunch Money API token and OAuth client credentials are stored in your operating system's native credential manager:

- **macOS:** Keychain Access
- **Linux:** Secret Service (GNOME Keyring / KDE Wallet)
- **Windows:** Windows Credential Manager

These credentials are:
- Encrypted by the OS using your login password
- Never written to disk in plain text
- Stored under the service namespace `lunchmoney-mcp`
- Accessible only to processes running as your user

### Tier 2: Encrypted Disk Store (OAuth Session Tokens)

When running in HTTP mode with OAuth, session tokens (access tokens, refresh tokens, authorization codes) are stored on disk for persistence across server restarts.

- **Encryption:** AES-256-GCM (authenticated encryption)
- **Encryption key:** Stored in the OS keychain (Tier 1), or supplied via the `ENCRYPTION_KEY` env var when no keychain is available (see below) -- the encrypted files are useless without it
- **Location:** Platform-native data directory
  - macOS: `~/Library/Application Support/lunchmoney-mcp/`
  - Linux: `~/.local/share/lunchmoney-mcp/`
  - Windows: `%APPDATA%/lunchmoney-mcp/`
- **TTL:** Tokens expire automatically and are cleaned up periodically

### ENV Variable Fallback

For containerized deployments (Docker, Kubernetes) where no OS keychain is available, credentials can be passed via environment variables:

- `LUNCH_MONEY_API_TOKEN` -- your Lunch Money API key
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` -- for Google OAuth
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` -- for GitHub OAuth
- `CYBERARK_TENANT_URL` / `CYBERARK_CLIENT_ID` / `CYBERARK_CLIENT_SECRET` -- for CyberArk Identity OAuth
- `OAUTH_CLIENT_ID` / `OAUTH_CLIENT_SECRET` / `OAUTH_AUTH_URL` / `OAUTH_TOKEN_URL` -- for custom OAuth

**Important:** When using ENV vars, ensure your deployment platform encrypts environment variables at rest (Railway, Render, and Fly.io all do this by default).

### Encryption Key (`ENCRYPTION_KEY`)

In HTTP/OAuth mode the session store is encrypted with a stable key. The key is resolved in this order:

1. **OS keychain** -- generated and persisted automatically on first run.
2. **`ENCRYPTION_KEY` env var** -- used when the keychain is unavailable (containers, headless hosts).

Requirements and behavior (as of 0.3.0):

- **Format:** exactly 64 lowercase hexadecimal characters (32 bytes). An invalid value is a hard error -- the server refuses to start rather than run with a misconfigured key.
- **Generate one:** `openssl rand -hex 32`
- **Refuse, don't drift:** if the keychain is unavailable *and* `ENCRYPTION_KEY` is unset, the server **refuses to start in HTTP/OAuth mode**. Earlier versions silently generated an ephemeral key, which invalidated every stored session on each restart. Stdio mode has no persisted sessions, so it still allows an ephemeral key.
- **Rotation:** in container deployments, set a new `ENCRYPTION_KEY` and restart. In keychain deployments, delete the `encryption-key` entry under the `lunchmoney-mcp` service in your OS credential manager and restart (a fresh key is generated). Rotating the key invalidates existing encrypted sessions; users re-authenticate on next use. Rotate if you suspect the key was exposed.

## Threat Model

| Threat | Mitigation |
|--------|-----------|
| API token stolen from disk | Token stored in OS keychain, never in plain text |
| Session tokens stolen from disk | Encrypted with AES-256-GCM; encryption key in keychain |
| Keychain compromised | Requires OS-level compromise (user login password) |
| Token in chat history (configureLunchMoneyToken) | Optional -- users can use `npx lunchmoney-mcp setup` CLI instead |
| ENV var exposure in containers | Use platform-provided secret management; never log ENV vars |
| Man-in-the-middle on API calls | All API calls use HTTPS; the OAuth flow uses PKCE (see note below) |
| Unauthorized MCP access (HTTP mode) | OAuth 2.1 with PKCE required for all authenticated endpoints (see note below) |
| Silent/phishing OAuth grant | Consent required on every first-time grant (Google consent screen not suppressed) |
| Lost encryption key in containers | Server refuses to start without a valid `ENCRYPTION_KEY` in HTTP/OAuth mode (no silent ephemeral key) |

> **Note on PKCE:** the OAuth authorization flow (including PKCE / `code_challenge`) is implemented by FastMCP, not by this server directly. We rely on the behavior of the pinned `fastmcp` version (currently `3.35.0`) and do not override `code_challenge_method`. Treat the PKCE guarantee as transitive through that dependency; it is re-verified whenever FastMCP is bumped.

## Supply Chain Security

MCP servers are high-value targets — they sit between AI assistants and your data. A compromised dependency could turn this server into a data exfiltration tool. We take this seriously.

### What We Do

| Protection | How |
|-----------|-----|
| **Pinned dependencies** | All versions in `package.json` are exact (no `^` or `~`). A compromised new release won't auto-install. |
| **Lockfile integrity** | `package-lock.json` is committed and CI uses `npm ci` (not `npm install`), ensuring the exact dependency tree is reproduced. |
| **npm provenance** | Every release is published with `--provenance` from GitHub Actions, creating a cryptographic attestation linking the npm package to its source commit. Verify with `npm audit signatures`. |
| **Automated vulnerability scanning** | `npm audit --audit-level=high` runs on every CI build. Known vulnerabilities block merges. |
| **Signature verification** | `npm audit signatures` runs in CI to verify all installed packages have valid registry signatures. |
| **Dependabot** | GitHub Dependabot monitors for vulnerable dependencies and opens PRs weekly. Major version bumps require manual review. |
| **Minimal dependency surface** | Only 5 production dependencies. Dev dependencies (vitest, typescript, etc.) are not shipped in the npm package. |
| **GitHub Actions pinned** | CI workflow actions are pinned to specific versions and monitored by Dependabot. |

### What You Can Do

**Verify provenance** of any installed version:
```bash
npm audit signatures
```

**Verify the package source** matches the GitHub repo:
```bash
# Check provenance attestation on npm
npm view @infamousendeavors/lunchmoney-mcp --json | jq '.dist.attestations'
```

**Pin your install** to a specific version:
```bash
npm install -g @infamousendeavors/lunchmoney-mcp@0.3.0
```

**Audit before running:**
```bash
npx @infamousendeavors/lunchmoney-mcp --version  # check version
npm audit                                    # check for known vulnerabilities
```

### Production Dependencies (5 total)

| Package | Purpose | Why We Trust It |
|---------|---------|----------------|
| `fastmcp` | MCP protocol framework | Active development, MCP ecosystem standard |
| `zod` | Input validation | 25k+ GitHub stars, widely audited |
| `keytar` | OS keychain access | Community-maintained, native OS keychain binding |
| `dotenv` | ENV file parsing | 30M+ weekly downloads, minimal surface area |
| `env-paths` | Platform data dirs | Zero dependencies, 50 lines of code |

Dev dependencies (`vitest`, `typescript`, `tsx`, `@types/node`, `@vitest/coverage-v8`) are NOT included in the published npm package — they are excluded via the `files` field in `package.json`.

## Reporting Vulnerabilities

If you discover a security vulnerability, please email joe at joe-garcia dot com instead of opening a public issue.
