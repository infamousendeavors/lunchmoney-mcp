# Contributing to lunchmoney-mcp

## Development Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/infamousendeavors/lunchmoney-mcp.git
   cd lunchmoney-mcp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build:
   ```bash
   npm run build
   ```

4. Run tests:
   ```bash
   npm test                # Run once
   npm run test:watch      # Watch mode
   npm run test:coverage   # With coverage report
   ```

## System Dependencies

This project uses `keytar` for OS keychain integration, which requires native compilation:

- **macOS:** Xcode Command Line Tools (`xcode-select --install`)
- **Linux:** `sudo apt-get install libsecret-1-dev`
- **Windows:** No additional dependencies (uses Windows Credential Manager)

## Project Structure

- `src/cli.ts` -- CLI entry point (arg parsing, routing)
- `src/server.ts` -- Server factory (FastMCP instance, tool registration)
- `src/credential-store.ts` -- OS keychain + ENV var fallback
- `src/auth-provider.ts` -- OAuth provider factory (when implemented)
- `src/setup.ts` -- Interactive setup wizard
- `src/tools/` -- MCP tool modules (one per Lunch Money API domain)
- `src/api/client.ts` -- Lunch Money API HTTP client
- `src/schemas/` -- Zod validation schemas
- `src/types/` -- TypeScript interfaces
- `tests/` -- Vitest test files (mirrors src/ structure)

## Writing Tests

- Every new module MUST have tests
- Follow the existing patterns in `tests/tools/plaid.test.ts`
- Mock `LunchMoneyClient` methods, not HTTP requests
- Test both success and error cases
- Coverage must stay above 90%

## Pull Request Guidelines

1. Create a feature branch from `main`
2. Write tests first (TDD preferred)
3. Ensure `npm run build` compiles cleanly
4. Ensure `npm test` passes all tests
5. Ensure `npm run test:coverage` shows >90%
6. Open a PR with a clear description of changes
7. Link related issues with "Closes #N"

## Code Style

- TypeScript strict mode
- ES modules (`import`/`export`, not `require`)
- Zod for input validation
- `formatErrorForMCP()` for error handling in tools
- Follow existing patterns -- consistency over cleverness
