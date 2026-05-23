import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock keytar
const mockKeytar = vi.hoisted(() => ({
  getPassword: vi.fn(),
  setPassword: vi.fn(),
  deletePassword: vi.fn(),
}));
vi.mock("keytar", () => ({
  default: mockKeytar,
}));

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function createJsonResponse(data: unknown, status = 200, ok = true) {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    headers: new Headers({ "content-type": "application/json" }),
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  };
}

import { runSetupWizard, validateToken, installInputMask } from "../src/setup.js";
import { CredentialStore } from "../src/credential-store.js";
import type { ReadlineInterface } from "../src/setup.js";

describe("Setup wizard", () => {
  let mockRl: ReadlineInterface;
  let questionCallback: ((answer: string) => void) | null;
  let output: string[];
  let store: CredentialStore;

  beforeEach(() => {
    vi.resetAllMocks();
    output = [];
    questionCallback = null;

    mockRl = {
      question: vi.fn((_query: string, cb: (answer: string) => void) => {
        questionCallback = cb;
      }),
      close: vi.fn(),
    };

    store = new CredentialStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createRlFactory(tokenToProvide: string): () => ReadlineInterface {
    return () => ({
      question: vi.fn((_query: string, cb: (answer: string) => void) => {
        cb(tokenToProvide);
      }),
      close: vi.fn(),
    });
  }

  describe("validateToken", () => {
    it("returns user data for valid token", async () => {
      const mockUser = {
        id: 1,
        name: "Test User",
        email: "test@example.com",
        currency: "usd",
      };
      mockFetch.mockResolvedValue(createJsonResponse(mockUser));

      const user = await validateToken("valid-token");

      expect(user).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://dev.lunchmoney.app/v1/me",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer valid-token",
          }),
        })
      );
    });

    it("throws for invalid token", async () => {
      const errorResponse = {
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({ error: "Invalid API key" }),
        text: vi.fn().mockResolvedValue('{"error":"Invalid API key"}'),
      };
      mockFetch.mockResolvedValue(errorResponse);

      await expect(validateToken("bad-token")).rejects.toThrow();
    });

    it("throws for empty token", () => {
      expect(() => validateToken("")).rejects.toThrow(
        "Lunch Money API token is required"
      );
    });
  });

  describe("runSetupWizard", () => {
    it("completes successfully with valid token", async () => {
      const mockUser = {
        id: 1,
        name: "Test User",
        email: "test@example.com",
        currency: "usd",
      };
      mockFetch.mockResolvedValue(createJsonResponse(mockUser));
      mockKeytar.setPassword.mockResolvedValue(undefined);

      const rlFactory = createRlFactory("valid-token");
      const log = (msg: string) => output.push(msg);

      await runSetupWizard(rlFactory, store, log);

      expect(output.some((line) => line.includes("Setup"))).toBe(true);
      expect(output.some((line) => line.includes("Test User"))).toBe(true);
      expect(output.some((line) => line.includes("test@example.com"))).toBe(
        true
      );
      expect(
        output.some((line) => line.includes("validated and stored"))
      ).toBe(true);
    });

    it("handles empty token input", async () => {
      const rlFactory = createRlFactory("");
      const log = (msg: string) => output.push(msg);

      await runSetupWizard(rlFactory, store, log);

      expect(output.some((line) => line.includes("cancelled"))).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("handles invalid token", async () => {
      const errorResponse = {
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({ error: "Invalid API key" }),
        text: vi.fn().mockResolvedValue('{"error":"Invalid API key"}'),
      };
      mockFetch.mockResolvedValue(errorResponse);

      const rlFactory = createRlFactory("bad-token");
      const log = (msg: string) => output.push(msg);

      await runSetupWizard(rlFactory, store, log);

      expect(
        output.some((line) => line.includes("validation failed"))
      ).toBe(true);
      expect(mockKeytar.setPassword).not.toHaveBeenCalled();
    });

    it("handles keychain storage failure during setup", async () => {
      const mockUser = {
        id: 1,
        name: "Test User",
        email: "test@example.com",
        currency: "usd",
      };
      mockFetch.mockResolvedValue(createJsonResponse(mockUser));
      mockKeytar.setPassword.mockRejectedValue(new Error("Keychain locked"));

      const rlFactory = createRlFactory("valid-token");
      const log = (msg: string) => output.push(msg);

      await runSetupWizard(rlFactory, store, log);

      // Should show the error from setApiToken
      expect(
        output.some((line) => line.includes("validation failed") || line.includes("Failed"))
      ).toBe(true);
    });

    it("closes readline interface even on error", async () => {
      const closeFn = vi.fn();
      const rlFactory = () => ({
        question: vi.fn((_query: string, cb: (answer: string) => void) => {
          cb("some-token");
        }),
        close: closeFn,
      });

      const errorResponse = {
        ok: false,
        status: 500,
        statusText: "Server Error",
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockRejectedValue(new Error("Not JSON")),
        text: vi.fn().mockResolvedValue("Server error"),
      };
      mockFetch.mockResolvedValue(errorResponse);

      const log = (msg: string) => output.push(msg);

      await runSetupWizard(rlFactory, store, log);

      expect(closeFn).toHaveBeenCalled();
    });

    it("prints welcome message and instructions", async () => {
      const rlFactory = createRlFactory("");
      const log = (msg: string) => output.push(msg);

      await runSetupWizard(rlFactory, store, log);

      expect(
        output.some((line) => line.includes("Lunch Money MCP Server Setup"))
      ).toBe(true);
      expect(
        output.some((line) =>
          line.includes("https://my.lunchmoney.app/developers")
        )
      ).toBe(true);
    });
  });

  describe("installInputMask", () => {
    it("returns a no-op when the interface cannot mask (e.g. a mock or non-TTY)", () => {
      const rl = { question: vi.fn(), close: vi.fn() } as unknown as ReadlineInterface;

      const unmask = installInputMask(rl);

      expect(typeof unmask).toBe("function");
      expect(() => unmask()).not.toThrow();
    });

    it("suppresses echoed characters but lets newlines through, and restores on unmask", () => {
      const written: string[] = [];
      const original = (s: string) => {
        written.push(s);
      };
      const rl = {
        question: vi.fn(),
        close: vi.fn(),
        _writeToOutput: original,
      } as unknown as ReadlineInterface;

      const unmask = installInputMask(rl);

      const masked = rl as unknown as { _writeToOutput: (s: string) => void };
      masked._writeToOutput("s");
      masked._writeToOutput("ecret");
      masked._writeToOutput("\n");

      expect(written).toEqual(["\n"]); // typed chars suppressed, newline passed

      unmask();
      expect(masked._writeToOutput).toBe(original);
    });
  });
});
