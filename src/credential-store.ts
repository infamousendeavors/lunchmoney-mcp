import keytar from 'keytar';

const SERVICE_NAME = 'lunchmoney-mcp';

export class CredentialStore {
  async getApiToken(): Promise<string | null> {
    // Try keychain first
    try {
      const token = await keytar.getPassword(SERVICE_NAME, 'api-token');
      if (token) return token;
    } catch {
      // Keychain unavailable (Docker, CI, etc.)
    }
    // Fall back to ENV var
    return process.env.LUNCH_MONEY_API_TOKEN || null;
  }

  async setApiToken(token: string): Promise<void> {
    try {
      await keytar.setPassword(SERVICE_NAME, 'api-token', token);
    } catch (error) {
      throw new Error('Failed to store token in keychain. Use LUNCH_MONEY_API_TOKEN env var instead.');
    }
  }

  async deleteApiToken(): Promise<void> {
    try {
      await keytar.deletePassword(SERVICE_NAME, 'api-token');
    } catch {
      // Ignore if keychain unavailable
    }
  }

  /**
   * Resolve the AES-256-GCM encryption key for the session store.
   *
   * Resolution order:
   *  1. OS keychain (generated and persisted on first use).
   *  2. `ENCRYPTION_KEY` env var, validated as exactly 64 lowercase hex
   *     characters (32 bytes). An invalid value is a hard error.
   *  3. Ephemeral random key — only allowed when `requirePersistent` is
   *     false (stdio mode, which has no persisted sessions). In HTTP/OAuth
   *     mode we refuse to start rather than silently invalidate every
   *     stored session on the next restart.
   *
   * @param requirePersistent - true in HTTP/OAuth mode, where an ephemeral
   *   key would silently drop all persisted sessions on restart.
   */
  async getEncryptionKey({ requirePersistent = false } = {}): Promise<string> {
    try {
      let key = await keytar.getPassword(SERVICE_NAME, 'encryption-key');
      if (!key) {
        // Generate and store a new key
        const crypto = await import('crypto');
        key = crypto.randomBytes(32).toString('hex');
        await keytar.setPassword(SERVICE_NAME, 'encryption-key', key);
      }
      return key;
    } catch (error) {
      // Keychain unavailable (Docker, CI, headless). Surface it instead of
      // swallowing — a silent fall-through here is how sessions vanish.
      console.error(
        `[lunchmoney-mcp] OS keychain unavailable for the encryption key (${
          (error as Error).message
        }). Falling back to the ENCRYPTION_KEY env var.`
      );
    }

    const envKey = process.env.ENCRYPTION_KEY;
    if (envKey !== undefined) {
      if (!/^[0-9a-f]{64}$/.test(envKey)) {
        throw new Error(
          'ENCRYPTION_KEY must be exactly 64 lowercase hex characters (32 bytes). Generate one with: openssl rand -hex 32'
        );
      }
      return envKey;
    }

    if (requirePersistent) {
      throw new Error(
        'No encryption key available: the OS keychain is unavailable and ENCRYPTION_KEY is not set. ' +
          'Refusing to start in HTTP/OAuth mode because an ephemeral key would silently invalidate every ' +
          'stored session on restart. Set ENCRYPTION_KEY (openssl rand -hex 32).'
      );
    }

    // stdio mode: no persisted sessions, so an ephemeral key is acceptable.
    const crypto = await import('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  async clear(): Promise<void> {
    try {
      await keytar.deletePassword(SERVICE_NAME, 'api-token');
      await keytar.deletePassword(SERVICE_NAME, 'encryption-key');
    } catch {
      // Ignore
    }
  }
}
