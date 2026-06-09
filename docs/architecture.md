# Architecture

## Overview

This project is a local Ethereum mainnet-fork lab for experimenting with Uniswap V3 swaps.

The app is split into five main layers:

```text
React frontend
  ↓
Express API
  ↓
Session/state manager
  ↓
Per-session Anvil mainnet fork
  ↓
Uniswap V3 contracts on forked mainnet
```

The frontend does not talk directly to Ethereum. It talks to the local Express API.

The backend owns:

* fork creation;
* Anvil process management;
* port allocation;
* session files;
* local fork account access;
* quote requests;
* swap execution;
* wallet summaries;
* session expiry and cleanup.

Each browser session gets a `sessionId`. The backend maps that `sessionId` to a specific Anvil process and RPC port, so each user/browser session can interact with an isolated forked chain state.

This project is intended for local fork/demo purposes only. It is not a production wallet or production mainnet trading architecture.

---

## High-level request flow

```text
Browser
  ↓
React frontend
  ↓
/api/... request
  ↓
Express API
  ↓
Session lookup
  ↓
Anvil RPC for that session
  ↓
Forked Ethereum mainnet state
  ↓
Uniswap V3 SwapRouter / ERC20 contracts
```

In production deployment, Nginx sits in front of the frontend and backend:

```text
Browser
  ↓
Nginx
  ├── serves frontend/dist
  └── proxies /api/ to Express on 127.0.0.1:3001
          ↓
        Express API
          ↓
        Anvil fork processes
```

The backend should stay bound to localhost. Only Nginx should expose it publicly through `/api/`.

---

## Directory overview

```text
contracts/   Solidity swap helper contracts
src/         Core TypeScript quote, swap, token, provider, signer, and contract logic
server/      Express API entrypoint, route handlers, validation, and error helpers
state/       Session files, Anvil process management, port allocation, and cleanup
frontend/    React/Vite frontend
shared/      Shared frontend/backend types
scripts/     Standalone CLI quote and swap scripts
test/        Foundry tests
docs/        Architecture and project documentation
```

---

## Solidity contracts

### `contracts/WethToDaiSwap.sol`

`WethToDaiSwap.sol` is the original Solidity helper contract used by the swap demo.

It performs a simple exact-input WETH → DAI swap through the Uniswap V3 `SwapRouter`.

The basic contract flow is:

```text
user
  |
  | 1. approves WETH to WethToDaiSwap
  v
WethToDaiSwap
  |
  | 2. pulls WETH from user with transferFrom
  | 3. approves WETH to Uniswap V3 SwapRouter
  v
Uniswap V3 SwapRouter
  |
  | 4. swaps WETH for DAI
  v
user receives DAI
```

The original contract:

* ERC20 `transferFrom`;
* ERC20 approval to the router;
* Uniswap V3 exact-input swap execution;
* local mainnet-fork interaction with real mainnet contracts.

The current backend swap flow may also use or expect a more generic helper contract/artifact such as `SwapRouterSingle`, depending on the current branch and compiled artifacts.

If the backend expects `SwapRouterSingle`, make sure the Solidity source and generated artifact are present and compiled before running the backend.

---

## Swap safety

The demo swap logic is intentionally simplified.

A minimal local-fork demo may use:

```solidity
amountOutMinimum: 0
```

This makes the swap easier to test, but it is unsafe for production because it accepts any output amount.

A production swap flow should include:

* minimum output calculation;
* slippage tolerance;
* quote freshness checks;
* deadline management;
* user-side transaction signing;
* transaction simulation;
* chain/account validation;
* rate limiting and abuse protection;
* security review.

A safer contract function shape would be:

```solidity
function swapWETHForDAI(
    uint256 amountIn,
    uint256 amountOutMinimum
) external returns (uint256 amountOut)
```

The current project keeps the swap mechanics simple because the app executes against a forked chain, not real mainnet state.

---

## Core TypeScript structure

### `src/config/`

Environment loading and configuration validation.

Expected files include:

```text
src/config/env.ts
src/config/index.ts
```

This layer centralizes access to environment variables such as:

```text
MAINNET_RPC_URL_ALCHEMY
UNISWAP_API_KEY
```

The `.env` file should not be committed.

---

### `src/ethereum/`

Ethereum provider, address, signer, and fork-account logic.

Expected files include:

```text
src/ethereum/addresses.ts
src/ethereum/forkAccounts.ts
src/ethereum/provider.ts
src/ethereum/signer.ts
```

This layer is responsible for:

* known Ethereum mainnet addresses;
* local provider creation;
* signer lookup;
* local fork account loading;
* default test account access.

The project uses real Ethereum mainnet contract addresses, but execution happens on a local Anvil fork.

---

### `src/tokens/`

Token metadata, token contract helpers, WETH helpers, and symbol resolution.

Expected files include:

```text
src/tokens/tokens.ts
src/tokens/resolveToken.ts
src/tokens/contracts.ts
src/tokens/methods.ts
src/tokens/weth.ts
```

The local token list currently supports symbols such as:

```text
ETH
WETH
DAI
USDC
UNI
AAVE
```

The token layer handles:

* symbol-to-token resolution;
* token address metadata;
* decimals;
* ERC20 contract instances;
* WETH wrapping and unwrapping helpers;
* balance fetching.

To add a new token:

1. Add its address and metadata.
2. Add it to the local token list.
3. Ensure quote logic supports it.
4. Ensure swap logic supports it.
5. Ensure wallet summary/balance fetching supports it.
6. Ensure the frontend can display it.

---

### `src/contracts/`

Contract ABIs, deployment helpers, and contract-related exports.

Expected files include:

```text
src/contracts/abi.ts
src/contracts/deployments.ts
src/contracts/index.ts
```

This layer keeps contract construction and deployment logic separate from route handlers and swap logic.

Typical responsibilities:

* minimal ERC20 ABI exports;
* WETH ABI exports;
* swap helper contract deployment;
* deployed contract address tracking;
* contract factory/helper functions.

---

### `src/quote/`

Uniswap quote API client and quote formatting.

Expected files include:

```text
src/quote/getQuote.ts
src/quote/printQuote.ts
src/quote/quoteTypes.ts
```

The quote flow supports exact-input quotes.

A typical quote request includes:

```text
tokenIn
tokenOut
amount
swapper/default signer
slippage tolerance
protocols
```

The quote result can include:

* input token;
* output token;
* input amount;
* quoted output amount;
* estimated gas fee in USD.

Quotes come from the Uniswap Quote API. Swaps execute against the local fork state, so the actual result may differ if fork state and quote assumptions are not identical.

---

### `src/swap/`

Swap execution logic and swap result types.

Expected files include:

```text
src/swap/swapContract.ts
src/swap/swapRouter.ts
src/swap/swapTypes.ts
src/swap/printSwap.ts
src/swap/index.ts
```

The swap layer is responsible for:

* validating token pair behavior at the execution level;
* preparing token approvals;
* executing the swap through the local helper contract;
* formatting the swap result for the API/frontend.

The backend API should call this layer rather than embedding blockchain logic directly inside route handlers.

---

### `src/utils/`

Formatting and generic utility helpers.

Expected files include:

```text
src/utils/formatting.ts
src/utils/index.ts
```

Common examples:

* token amount formatting;
* token amount parsing;
* BigInt-safe conversions;
* display helpers.

Ethereum values often use `bigint`. Raw `bigint` values cannot be returned directly through `res.json()`.

Convert them first:

```ts
value.toString()
```

or format them into frontend-safe strings.

---

## Backend API

The Express backend lives in:

```text
server/
```

Main files:

```text
server/api.ts
server/handlers.ts
server/validation.ts
server/errors.ts
```

The backend is responsible for:

* route registration;
* request validation;
* rate limit handling
* typed error responses;
* session initialization;
* session refreshing;
* token list responses;
* account responses;
* wallet summaries;
* quote responses;
* swap execution.

The API should return frontend-readable JSON errors.

Example shape:

```json
{
  "error": "Missing session id"
}
```

---

## API endpoints

### `POST /api/init-state`

Initializes or resumes a local fork session.

Expected body:

```json
{
  "sessionId": "string"
}
```

Example response:

```json
{
  "port": 8545
}
```

Depending on implementation, the response may also include session status information.

This endpoint is responsible for triggering the backend session initialization flow.

---

### `POST /api/ping-session`

Refreshes the session `lastSeen` timestamp.

Expected body:

```json
{
  "sessionId": "string"
}
```

Example response:

```json
{
  "updated": true
}
```

The frontend uses this to keep an active session alive.

---

### `GET /api/token_list`

Returns supported token symbols.

Example response:

```json
[
  "ETH",
  "WETH",
  "DAI",
  "USDC",
  "UNI",
  "AAVE"
]
```

Tokens are resolved from the local token list in:

```text
src/tokens/tokens.ts
```

---

### `GET /api/accounts`

Returns local funded fork accounts.

Example response shape:

```json
[
  {
    "index": 0,
    "address": "0xe0E3Fa968E5888Ce9458878C392fE1711c8FF54d",
    "key": "0x..."
  },
  {
    "index": 1,
    "address": "0x1e3124Ae9309f2e04D1737CFA5341ac1a746fEB4",
    "key": "0x..."
  }
]
```

These accounts are fork/demo accounts only. They should not be treated as production wallet accounts.

---

### `GET /api/wallet-summary`

Returns balances and estimated USD values for a selected local account.

Example query:

```http
GET /api/wallet-summary?account=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

Example response shape:

```json
{
  "balances": [
    {
      "symbol": "ETH",
      "balance": "999.799503890230764172"
    },
    {
      "symbol": "DAI",
      "balance": "319.667557677475406776"
    }
  ],
  "tokenValuesUsd": {
    "ETH": "1594028.54",
    "DAI": "319.62"
  },
  "totalUsd": "1594348.16"
}
```

The frontend uses this to display the wallet panel.

---

### `GET /api/quote`

Returns an exact-input quote.

Example query:

```http
GET /api/quote?tokenIn=WETH&tokenOut=DAI&amount=0.1
```

Example response shape:

```json
{
  "tokenIn": "WETH",
  "tokenOut": "DAI",
  "amountIn": "0.1",
  "quotedAmountOut": "210.09",
  "gasFeeUsd": "0.02"
}
```

The quote endpoint uses the quote layer, not the local Anvil swap result.

---

### `POST /api/swap`

Executes a swap on the session's Anvil fork.

Expected body:

```json
{
  "sessionId": "string",
  "tokenIn": "WETH",
  "tokenOut": "DAI",
  "amount": "0.1",
  "account": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
}
```

Example response shape:

```json
{
  "from": "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
  "to": "0xe0E3Fa968E5888Ce9458878C392fE1711c8FF54d",
  "amountRaw": "159827156350211868962",
  "amountFormatted": "159.827156350211868962",
  "txnHash": "0x2fc090971e9513296a3fe621d3d89d069aaf2d7f573d6af9938fbc67448a98d1"
}
```

The transaction executes only on the local fork.

---

## Session lifecycle

The app uses a session-based fork model.

### 1. Frontend creates or reuses a session ID

The frontend checks browser `sessionStorage`.

```text
sessionStorage["sessionId"]
```

If no session exists, the frontend creates one and stores it.

---

### 2. Frontend calls `POST /api/init-session`

The frontend sends the session ID to the backend.

The backend validates the session ID before creating or resuming state.

---

### 3. Backend runs state health checks

Before starting new fork state, the backend can inspect existing session files and ports.

The health check should detect:

* dead Anvil processes;
* stale session files;
* occupied ports;
* expired sessions.

This prevents stale state from accumulating.

---

### 4. Backend allocates a port

The backend uses the local port state file to find an available Anvil port.

Example range:

```text
8545
8546
8547
...
```

Port allocation lives in:

```text
state/ports/ports.ts
```

The assigned port is saved into the session state.

---

### 5. Backend starts Anvil

The backend spawns an Anvil process for the session.

Process management lives in:

```text
state/processes.ts
```

The fork uses Ethereum mainnet as its source.

The Anvil RPC endpoint should be local-only.

Example:

```text
127.0.0.1:8545
```

---

### 6. Backend waits for RPC readiness

After spawning Anvil, the backend repeatedly checks whether the RPC endpoint is ready.

A simple readiness check is a JSON-RPC call such as:

```text
eth_chainId
```

Only after the RPC is alive should the backend continue preparing fork state.

---

### 7. Backend prepares fork state

After the fork is alive, the backend prepares the local testing environment.

This can include:

* funding local accounts;
* preparing local signers;
* deploying the swap helper contract;

The deployed contract state is stored so later API calls can reuse it.

---

### 8. Backend writes the session file

Session files live under:

```text
state/sessions/
```

A session file should contain information such as:

* session ID;
* initialization state;
* last seen timestamp;
* Anvil port;
* Anvil process ID;
* deployed contract addresses.

Example conceptual shape:

```json
{
  "id": "session-id",
  "state": "initialized",
  "lastSeen": 1710000000000,
  "anvil": {
    "port": 8545,
    "pid": 12345
  },
  "deployed": {
    "SwapRouterSingle": {
      "address": "0x..."
    }
  }
}
```

---

### 9. Frontend uses the active session

Once initialized, the frontend can:

* fetch token symbols;
* fetch local fork accounts;
* connect a local account;
* fetch wallet balances;
* fetch quotes;
* execute swaps;
* ping the session to keep it alive.

---

### 10. Expiry cleanup

Expired or dead sessions should be cleaned up.

Cleanup should keep these pieces in sync:

* stop or detect dead Anvil processes;
* remove stale session files;
* mark assigned ports as free.

This prevents port leaks, stale processes, and invalid session state.

---

## State management

The `state/` directory contains local runtime management code.

Expected files:

```text
state/state.ts
state/session.ts
state/processes.ts
state/ports.ts
state/expiry.ts
state/types.ts
state/index.ts
```

### `state/state.ts`

High-level state orchestration.

Typical responsibilities:

* initialize session state;
* run health checks;
* prepare fork state;
* coordinate port allocation, process spawning, and session writing.

---

### `state/session.ts`

Session file helpers.

Typical responsibilities:

* read session file;
* write session file;
* update `lastSeen`;
* remove session file;

---

### `state/processes.ts`

Anvil process management.

Typical responsibilities:

* spawn Anvil;
* track process ID;
* detect whether an Anvil RPC is alive;
* remove processes.

---

### `state/ports.ts`

Port state management.

Typical responsibilities:

* read the port state file;
* find an available port;
* mark a port as used;
* mark a port as free.

---

### `state/expiry.ts`

Session expiry logic.

Typical responsibilities:

* scan sessions;
* compare `lastSeen` against timeout rules;
* clean expired sessions;
* release ports associated with expired sessions.

---

## Frontend architecture

The frontend lives in:

```text
frontend/
```

The main app code is in:

```text
frontend/src/App.tsx
```

The frontend is responsible for:

* creating or reusing a browser session ID;
* calling `POST /api/init-state`;
* displaying fork initialization status;
* fetching the supported token list;
* fetching available local accounts;
* letting the user select/connect a local fork account;
* displaying wallet balances and USD values;
* requesting quotes;
* executing swaps;
* displaying transaction hashes;
* exposing separate error states.

Important frontend state categories include:

* session state;
* fork initialization status;
* selected account;
* wallet summary;
* selected token pair;
* quote state;
* swap state;
* fatal errors;
* wallet errors;
* quote errors;
* swap errors.

The frontend uses `sessionStorage`, so the same browser tab/session can reuse the same backend fork session.

---

## Local development proxy

During local development, the Vite dev server proxies API requests.

Typical frontend dev URL:

```text
http://localhost:5173
```

Backend API URL:

```text
http://localhost:3001
```

The Vite proxy maps:

```text
/api
```

to:

```text
http://localhost:3001
```

This allows frontend code to call:

```text
/api/init-state
/api/quote
/api/swap
```

without hardcoding the backend origin.

In production, Nginx performs the equivalent proxying.

---

## Deployment architecture

Production deployment is designed around:

```text
Browser
  ↓
Nginx
  ├── serves static frontend files
  └── proxies /api/ to Express on localhost
          ↓
        Express API
          ↓
        Anvil fork processes
```

The frontend build output is:

```text
frontend/dist
```

This can be copied or deployed to:

```text
/var/www/uniswap-frontend
```

Example Nginx server block:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_SERVER_IP;

    root /var/www/uniswap-frontend;
    index index.html;

    location ~* \.(env|ini|log|conf|bak|sql|sqlite|db)$ {
        return 404;
    }

    location ~ /\.(?!well-known) {
        return 404;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

The Express API should remain bound to:

```text
127.0.0.1:3001
```

Anvil RPC ports should also stay local.

Only Nginx should be public.

---

## Process management

### Nginx

Nginx is normally managed as a systemd service:

```bash
sudo systemctl status nginx
sudo systemctl reload nginx
sudo systemctl restart nginx
```

Nginx should stay running in the background and start on reboot if enabled.

---

### Backend API

The Express backend can be managed with PM2 or systemd.

PM2 example:

```bash
pm2 start npm --name uni -- run api
pm2 save
pm2 startup
```

Systemd is also a valid production-style option.

A systemd service would define:

* project working directory;
* user;
* startup command;
* restart policy;
* environment file if needed.

---

## Firewall model

A typical UFW setup exposes only SSH and HTTP/HTTPS:

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

The Express API port should not be public.

The Anvil RPC ports should not be public.

Expected public exposure:

```text
22    SSH
80    HTTP
443   HTTPS
```

Expected private/local-only exposure:

```text
3001  Express API
8545+ Anvil fork RPC ports
```

---

## HTTPS model

For a domain-based deployment, HTTPS can be added with Certbot.

Typical flow:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx
```

This requires a real domain pointing to the server IP.

If accessing the site directly through an IP address, browsers will usually show it as not secure because normal public TLS certificates are issued for domain names, not raw IP addresses.

---

## Hardhat and Foundry roles

This repo uses both Hardhat and Foundry.

Hardhat is used for:

* TypeScript scripts;
* ethers integration;
* local fork script execution;
* deployment-style demos.

Foundry is used for:

* Solidity tests;
* fork-based contract testing;
* fast test execution.

This split is intentional.

Hardhat makes TypeScript scripting convenient. Foundry makes Solidity tests fast and direct.

---

## Mainnet fork model

The project runs against a local Ethereum mainnet fork.

Contracts and scripts use real Ethereum mainnet addresses, but execution happens locally.

This allows the project to interact with real deployed contracts without spending real funds.

Examples of forked mainnet contracts used by the project:

```text
WETH
DAI
USDC
UNI
AAVE
Uniswap V3 SwapRouter
Uniswap V3 pools
```

A manual fork can be started with Anvil:

```bash
anvil --fork-url "$MAINNET_RPC_URL_ALCHEMY" \
  --fork-chain-id 1 \
  --chain-id 1
```

The app can also spawn Anvil automatically through the backend session system.

Manual forks are mainly useful for direct testing and standalone scripts.

---

## Scripts

The `scripts/` directory contains standalone TypeScript scripts.

### `scripts/swap.ts`

Runs a local swap demo from the command line.

Typical command:

```bash
npx hardhat run scripts/swap.ts --network localhost
```

or:

```bash
npm run swap:local
```

The script is intended to run against a local mainnet fork.

It should not be used directly on real Ethereum mainnet.

---

### `scripts/quote.ts`

Runs a quote request from the command line.

Typical command:

```bash
npx tsx scripts/quote.ts WETH DAI 0.1
```

or:

```bash
npm run quote -- WETH DAI 0.1
```

The script resolves token symbols from the local token list.

---

## Tests

The `test/` directory contains Foundry tests.

### `test/WethToDaiSwap.t.sol`

Mainnet-fork tests for the original WETH → DAI helper contract.

Expected test flow:

```text
1. deploy the swap helper contract
2. give the test account WETH
3. approve the helper contract to spend WETH
4. execute the swap
5. verify that DAI was received
```

Run with:

```bash
forge test --fork-url localhost -vvv
```

or:

```bash
npm run test:forge
```

The tests depend on forked mainnet state because they interact with real mainnet deployments.

---

## Environment variables

The project needs a mainnet RPC URL for forking and a Uniswap API key for quote requests.

Example `.env`:

```env
MAINNET_RPC_URL_ALCHEMY=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
UNISWAP_API_KEY="YOUR_UNISWAP_API_KEY"
```

Optional fork account data can live in `.env.accounts`:

```env
ADDRESS0=0x...
KEY0=0x...
ADDRESS1=0x...
KEY1=0x...
```

Load local environment files when needed:

```bash
source .env
source .env.accounts
```

Do not commit real `.env` files or private keys.

---

## Generated/runtime files

These files and directories are generated or runtime state and should generally not be committed:

```text
node_modules/
artifacts/
cache/
cache_hardhat/
out/
typechain-types/
frontend/dist/
```

Runtime state files such as session files and port state are local server state.

The npm lockfile should be committed:

```text
package-lock.json
```

`package-lock.json` makes dependency installation more reproducible.

---

## Security notes

This project intentionally uses local fork accounts and backend signing for demo purposes.

That is acceptable for a controlled fork lab, but it is not a production wallet architecture.

Do not expose:

```text
.env
.env.accounts
private keys
Anvil RPC ports
backend internals
state files
```

The production deployment should expose only:

```text
Nginx HTTP/HTTPS entrypoint
```

The backend should be reachable only through Nginx.

The Anvil RPC ports should be reachable only locally by the backend.

---

## Current limitations

This project is intended for fork/demo use only.

Important limitations:

* the frontend uses local fork accounts, not a real browser wallet;
* the backend controls signing through local fork/private-key signers;
* swaps execute on a fork, not real Ethereum mainnet;
* runtime session files and port state are local server state;
* stale Anvil processes must be cleaned up by session health/expiry logic;
* slippage handling is simplified for demo purposes;
* quote results can differ from local fork swap output;
* the app is not designed for production mainnet swaps as-is.

For real mainnet swaps, the app would need:

* real wallet integration;
* transaction construction for user signing;
* proper slippage calculation;
* deadline management;
* quote freshness checks;
* transaction simulation;
* chain/account validation;
* production-grade error handling;
* rate limiting and abuse protection;
* security review.

---

## Development notes

### BigInt serialization

Ethereum values often use `bigint`.

Do not return raw `bigint` values directly through `res.json()`.

Convert them first:

```ts
value.toString()
```

or format them before returning the response.

---

### Shared frontend/backend types

Shared API response types should live in:

```text
shared/types.ts
```

This avoids duplicating response shapes between the Express API and React frontend.

---

### Error handling

Backend route handlers should throw typed/custom errors where possible.

The API should return JSON error responses that the frontend can display directly.

Example:

```json
{
  "error": "Invalid token symbol"
}
```

---

### Session cleanup

Session cleanup should keep these in sync:

* session file removed;
* Anvil process stopped or confirmed dead;
* assigned port marked free.

This prevents port leaks and stale sessions.

---

### API proxy

In local development, Vite proxies:

```text
/api
```

to:

```text
http://localhost:3001
```

In production, Nginx performs the same role.

---

## Summary

The project is now more than a simple WETH → DAI script.

It is a session-based Uniswap V3 fork lab with:

* Solidity helper contracts;
* Foundry fork tests;
* TypeScript quote and swap logic;
* Express API routes;
* per-session Anvil fork lifecycle management;
* local account funding and selection;
* React frontend interaction;
* wallet summaries;
* quote and swap UI;
* Nginx-ready deployment structure.

The core architectural idea is that the browser interacts with a safe local API, while the backend manages isolated forked Ethereum state for each browser session.

