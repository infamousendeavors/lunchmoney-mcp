# lunchmoney-mcp

[![npm version](https://img.shields.io/npm/v/@infamousendeavors/lunchmoney-mcp.svg)](https://www.npmjs.com/package/@infamousendeavors/lunchmoney-mcp)
[![npm downloads](https://img.shields.io/npm/dm/@infamousendeavors/lunchmoney-mcp.svg)](https://www.npmjs.com/package/@infamousendeavors/lunchmoney-mcp)
[![GitHub downloads](https://img.shields.io/github/downloads/infamousendeavors/lunchmoney-mcp/total.svg)](https://github.com/infamousendeavors/lunchmoney-mcp/releases)
[![CI](https://github.com/infamousendeavors/lunchmoney-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/infamousendeavors/lunchmoney-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

The definitive MCP server for [Lunch Money](https://lunchmoney.app) -- manage your finances through any AI assistant that supports the Model Context Protocol.

37 tools covering every Lunch Money API endpoint. Runs locally via stdio or remotely over HTTP with OAuth 2.1. Credentials never touch disk in plain text.

## Quick Start

```bash
npx lunchmoney-mcp setup          # Store your API token in the OS keychain
npx lunchmoney-mcp                # Start the MCP server (stdio)
```

Then add it to your MCP client. For Claude Desktop, add this to your config:

```json
{
  "mcpServers": {
    "lunchmoney": {
      "command": "npx",
      "args": ["lunchmoney-mcp"]
    }
  }
}
```

That's it. Ask your AI assistant to "show my recent transactions" and you're off.

## Features

- **37 tools** -- full CRUD for transactions, categories, tags, budgets, recurring items, assets, and Plaid accounts
- **Two transport modes** -- stdio for local AI clients (Claude Desktop, Cursor) or HTTP for remote/multi-user deployments
- **Secure credential storage** -- API tokens in the OS keychain (macOS Keychain, GNOME Keyring, Windows Credential Manager); OAuth session tokens encrypted with AES-256-GCM
- **4 OAuth providers** -- Google, GitHub, CyberArk Identity, or any custom OAuth 2.1 provider
- **Deploy anywhere** -- Docker, systemd, Railway, Render, Fly.io with one-click configs included
- **278 tests** -- comprehensive test suite with >90% coverage

## Setup

### Local (stdio mode)

Best for single-user setups with Claude Desktop, Cursor, or other local MCP clients.

```bash
# Install globally (optional -- npx works too)
npm install -g lunchmoney-mcp

# Run the setup wizard to store your token securely
lunchmoney-mcp setup

# Start the server
lunchmoney-mcp
```

Your API token is stored in the OS keychain and never written to disk. Get a token at [my.lunchmoney.app/developers](https://my.lunchmoney.app/developers).

Alternatively, you can configure the token from within your AI assistant using the `configureLunchMoneyToken` tool -- no terminal required.

### Remote (HTTP mode)

Best for multi-user deployments, shared teams, or running on a server.

```bash
# Set required environment variables
export LUNCH_MONEY_API_TOKEN="your-token"
export AUTH_PROVIDER="google"  # or github, cyberark, custom
export GOOGLE_CLIENT_ID="..."
export GOOGLE_CLIENT_SECRET="..."
export BASE_URL="https://your-domain.com"

# Start the server
lunchmoney-mcp --http --port 8080
```

HTTP mode requires OAuth 2.1 for authentication. See [Authentication](#authentication) below.

### Environment Variable Fallback

For containers and CI where no OS keychain is available:

```bash
export LUNCH_MONEY_API_TOKEN="your-token"
lunchmoney-mcp
```

## Authentication

HTTP mode supports four OAuth providers. Set `AUTH_PROVIDER` and the corresponding credentials:

### Google

```bash
AUTH_PROVIDER=google
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

### GitHub

```bash
AUTH_PROVIDER=github
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
```

### CyberArk Identity

```bash
AUTH_PROVIDER=cyberark
CYBERARK_TENANT_URL=https://abc1234.id.cyberark.cloud
CYBERARK_CLIENT_ID=your-client-id    # or OAUTH_CLIENT_ID
CYBERARK_CLIENT_SECRET=your-secret   # or OAUTH_CLIENT_SECRET
```

### Custom OAuth

```bash
AUTH_PROVIDER=custom
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret
OAUTH_AUTH_URL=https://provider.com/authorize
OAUTH_TOKEN_URL=https://provider.com/token
OAUTH_SCOPES=openid,email  # optional, defaults to openid,email
```

## Deployment

Pre-built deployment configs are included in the repository.

### Docker

```bash
docker build -t lunchmoney-mcp .
docker run -p 8080:8080 \
  -e LUNCH_MONEY_API_TOKEN="your-token" \
  -e AUTH_PROVIDER=google \
  -e GOOGLE_CLIENT_ID="..." \
  -e GOOGLE_CLIENT_SECRET="..." \
  -e BASE_URL="https://your-domain.com" \
  lunchmoney-mcp
```

Or with Docker Compose:

```bash
docker compose up
```

### systemd

A systemd service file is included at `deploy/lunchmoney-mcp.service`. Copy it to `/etc/systemd/system/` and configure the environment variables.

### Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template)

The included `railway.json` configures the build and start commands automatically. Set your environment variables in the Railway dashboard.

### Render

The included `render.yaml` defines the service as a private worker. Set your environment variables in the Render dashboard.

### Fly.io

```bash
fly launch
fly secrets set LUNCH_MONEY_API_TOKEN="your-token"
fly secrets set AUTH_PROVIDER=google GOOGLE_CLIENT_ID="..." GOOGLE_CLIENT_SECRET="..."
fly deploy
```

## Tools Reference

### Setup (1 tool)

| Tool | Description |
|------|-------------|
| `configureLunchMoneyToken` | Configure and validate your Lunch Money API token |

### User (1 tool)

| Tool | Description |
|------|-------------|
| `getUser` | Get account details including email, name, and currency preferences |

### Categories (7 tools)

| Tool | Description |
|------|-------------|
| `getCategories` | List all categories including groups and parent categories |
| `getCategory` | Get a single category by ID |
| `createCategory` | Create a new spending or income category |
| `updateCategory` | Update an existing category's properties |
| `deleteCategory` | Delete a category by ID |
| `createCategoryGroup` | Create a new category group with optional category IDs |
| `addToGroup` | Add existing categories to a category group |

### Tags (4 tools)

| Tool | Description |
|------|-------------|
| `getTags` | List all transaction tags |
| `createTag` | Create a new tag for categorizing transactions |
| `updateTag` | Update an existing tag's name |
| `deleteTag` | Delete a tag by ID |

### Transactions (10 tools)

| Tool | Description |
|------|-------------|
| `getTransactions` | List transactions with filtering (date range, category, tags, status) |
| `getTransaction` | Get a single transaction by ID |
| `createTransaction` | Create a new transaction (expense, income, or transfer) |
| `updateTransaction` | Update an existing transaction's properties |
| `deleteTransaction` | Delete a transaction by ID |
| `bulkUpdateTransactions` | Bulk update multiple transactions with the same changes |
| `getTransactionGroup` | Retrieve a transaction group with all child transactions |
| `createTransactionGroup` | Group multiple transactions under a single parent |
| `deleteTransactionGroup` | Delete a group, restoring individual transactions |
| `unsplitTransactions` | Reverse a split, merging child transactions back into parent |

### Recurring Items (4 tools)

| Tool | Description |
|------|-------------|
| `getRecurringItems` | List all recurring expense and income items |
| `createRecurringItem` | Create a new recurring expense or income item |
| `updateRecurringItem` | Update an existing recurring item's properties |
| `deleteRecurringItem` | Delete a recurring item by ID |

### Budgets (4 tools)

| Tool | Description |
|------|-------------|
| `getBudgets` | List all budgets with category assignments and date ranges |
| `createBudget` | Create a new budget for a category with amount and date range |
| `updateBudget` | Update an existing budget's amount, category, or date range |
| `deleteBudget` | Delete a budget by ID |

### Assets (4 tools)

| Tool | Description |
|------|-------------|
| `getAssets` | List all manually-managed assets |
| `createAsset` | Create a new manually-managed asset |
| `updateAsset` | Update an existing asset's properties including balance |
| `deleteAsset` | Delete an asset by ID |

### Plaid Accounts (2 tools)

| Tool | Description |
|------|-------------|
| `getPlaidAccounts` | List all Plaid-connected accounts with balances |
| `fetchPlaidAccounts` | Trigger a Plaid sync to update account balances |

## CLI Reference

```
lunchmoney-mcp                  # Start in stdio mode (default)
lunchmoney-mcp --http           # Start in HTTP mode with OAuth
lunchmoney-mcp --http --port 3000  # HTTP mode on custom port
lunchmoney-mcp setup            # Run the interactive setup wizard
lunchmoney-mcp --version        # Print version
```

The server also reads the `PORT` environment variable when `--port` is not specified.

## Security

Credentials are stored in your OS keychain and never written to disk in plain text. OAuth session tokens are encrypted with AES-256-GCM, with the encryption key stored in the keychain.

For full details on the two-tier credential architecture, threat model, and deployment security, see [SECURITY.md](SECURITY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, testing guidelines, and pull request requirements.

## License

[MIT](LICENSE) -- Copyright (c) 2026 Joe Garcia

Based on [lunch-money-mcp](https://github.com/gilbitron/lunch-money-mcp) by Gilbert Pellegrom, MIT License.
