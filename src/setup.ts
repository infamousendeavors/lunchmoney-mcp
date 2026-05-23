import * as readline from "readline";
import { LunchMoneyClient } from "./api/client.js";
import { CredentialStore } from "./credential-store.js";
import type { User } from "./types/index.js";

export interface ReadlineInterface {
  question(query: string, callback: (answer: string) => void): void;
  close(): void;
}

export function createReadlineInterface(): ReadlineInterface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Suppress the terminal echo of typed input on a readline interface, so a
 * secret (the API token) is not printed as it is typed. Returns an `unmask`
 * function that restores the original behavior.
 *
 * Works by swapping the interface's internal `_writeToOutput`: while masked,
 * only newlines pass through (so Enter still breaks the line) and every echoed
 * keystroke is swallowed. If the interface does not expose `_writeToOutput`
 * (a test mock, or a non-TTY stream), this is a no-op.
 */
export function installInputMask(rl: ReadlineInterface): () => void {
  const internal = rl as unknown as { _writeToOutput?: (s: string) => void };
  const original = internal._writeToOutput;
  if (typeof original !== "function") {
    return () => {};
  }
  internal._writeToOutput = (stringToWrite: string) => {
    if (stringToWrite === "\n" || stringToWrite === "\r\n" || stringToWrite === "\r") {
      original.call(internal, stringToWrite);
    }
    // otherwise: swallow the echoed character
  };
  return () => {
    internal._writeToOutput = original;
  };
}

function askQuestion(
  rl: ReadlineInterface,
  query: string,
  options: { mask?: boolean } = {}
): Promise<string> {
  return new Promise((resolve) => {
    let unmask: (() => void) | undefined;
    rl.question(query, (answer: string) => {
      unmask?.();
      resolve(answer.trim());
    });
    // Install the mask after the prompt is written so the prompt stays visible
    // but the typed token does not echo.
    if (options.mask) {
      unmask = installInputMask(rl);
    }
  });
}

export async function validateToken(token: string): Promise<User> {
  const client = new LunchMoneyClient(token);
  return client.get<User>("/me");
}

export async function runSetupWizard(
  rlFactory?: () => ReadlineInterface,
  credentialStore?: CredentialStore,
  log?: (msg: string) => void
): Promise<void> {
  const print = log || console.log;
  const store = credentialStore || new CredentialStore();
  const rl = rlFactory ? rlFactory() : createReadlineInterface();

  try {
    print("");
    print("=== Lunch Money MCP Server Setup ===");
    print("");
    print("This wizard will help you configure your Lunch Money API token.");
    print("You can get a token at: https://my.lunchmoney.app/developers");
    print("");

    const token = await askQuestion(rl, "Enter your Lunch Money API token (input hidden): ", {
      mask: true,
    });

    if (!token) {
      print("No token provided. Setup cancelled.");
      return;
    }

    print("");
    print("Validating token...");

    try {
      const user = await validateToken(token);
      await store.setApiToken(token);

      print("");
      print(`Token validated and stored successfully!`);
      print(`  Name: ${user.name}`);
      print(`  Email: ${user.email}`);
      print(`  Currency: ${user.currency}`);
      print("");
      print("You can now start the MCP server:");
      print("  npx lunchmoney-mcp        (stdio mode)");
      print("  npx lunchmoney-mcp --http  (HTTP mode)");
      print("");
    } catch (error) {
      print("");
      if (error instanceof Error) {
        print(`Token validation failed: ${error.message}`);
      } else {
        print("Token validation failed. Please check your token and try again.");
      }
      print("Get a new token at: https://my.lunchmoney.app/developers");
      print("");
    }
  } finally {
    rl.close();
  }
}
