import { mkdirSync } from "fs";
import envPaths from "env-paths";
import { DiskStore, EncryptedTokenStorage, type TokenStorage } from "fastmcp/auth";
import type { CredentialStore } from "./credential-store.js";

const APP_NAME = "lunchmoney-mcp";

/**
 * Default cleanup interval for expired tokens (60 seconds).
 */
const DEFAULT_CLEANUP_INTERVAL_MS = 60_000;

/**
 * Get the platform-native data directory for session storage.
 * - macOS: ~/Library/Application Support/lunchmoney-mcp
 * - Linux: ~/.local/share/lunchmoney-mcp
 * - Windows: %LOCALAPPDATA%/lunchmoney-mcp/Data
 */
export function getDataDirectory(): string {
  return envPaths(APP_NAME).data;
}

export interface CreateSessionStoreOptions {
  /** Override the data directory (useful for testing) */
  directory?: string;
  /** Cleanup interval in milliseconds (default: 60000) */
  cleanupIntervalMs?: number;
}

/**
 * Create an encrypted, disk-backed session store for OAuth tokens.
 *
 * Sessions are persisted to the platform-native data directory as JSON files,
 * encrypted at rest with AES-256-GCM. The encryption key is stored in the
 * OS keychain via the credential store, never on the filesystem.
 *
 * @param credentialStore - Used to retrieve the encryption key from the OS keychain
 * @param options - Optional overrides for directory and cleanup interval
 * @returns An EncryptedTokenStorage wrapping a DiskStore
 */
export async function createSessionStore(
  credentialStore: CredentialStore,
  options?: CreateSessionStoreOptions
): Promise<TokenStorage> {
  const directory = options?.directory ?? getDataDirectory();
  const cleanupIntervalMs = options?.cleanupIntervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS;

  // Ensure the data directory exists
  mkdirSync(directory, { recursive: true });

  // Retrieve the encryption key. This store persists OAuth sessions to disk,
  // so an ephemeral key is not acceptable: require a stable key (keychain or
  // a valid ENCRYPTION_KEY), and refuse to start otherwise.
  const encryptionKey = await credentialStore.getEncryptionKey({
    requirePersistent: true,
  });

  // Create the disk-backed store
  const diskStore = new DiskStore({
    directory,
    cleanupIntervalMs,
    fileExtension: ".json",
  });

  // Wrap with AES-256-GCM encryption
  const encryptedStore = new EncryptedTokenStorage(diskStore, encryptionKey);

  return encryptedStore;
}
