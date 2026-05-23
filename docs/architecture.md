# Architecture

## Directory Layout

```txt
contracts/
  WethToDaiSwap.sol

scripts/
  swap.ts
  utils/
    abi.ts
    addresses.ts
    contracts.ts
    formatting.ts
    provider.ts
    tokens.ts

test/
  WethToDaiSwap.t.sol

docs/
  architecture.md

foundry.toml
hardhat.config.ts
package.json
tsconfig.json
README.md
.env.example
.gitignore
```

## Solidity Contracts

### `contracts/WethToDaiSwap.sol`

`WethToDaiSwap.sol` is the current Solidity contract used by the swap demo.

It performs a simple exact-input swap from WETH to DAI through the Uniswap V3 `SwapRouter`.

The contract flow is:

```txt
user
  |
  | 1. approves WETH to WethToDaiSwap.sol
  v
WethToDaiSwap.sol
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

The contract currently hardcodes:

```txt
WETH mainnet address
DAI mainnet address
Uniswap V3 fee tier 3000
```

This is acceptable for the current demo because the project runs against a local Ethereum mainnet fork.

The contract currently exposes:

```solidity
function swapWETHForDAI(uint256 amountIn) external returns (uint256 amountOut)
```

The caller must approve the `WethToDaiSwap` contract before calling this function.

Example approval flow:

```txt
WETH.approve(address(WethToDaiSwap), amountIn)
WethToDaiSwap.swapWETHForDAI(amountIn)
```

### Swap Safety

The current implementation uses:

```solidity
amountOutMinimum: 0
```

This is intentionally simple for a local fork demo.

In production, this is unsafe because the swap accepts any output amount. A production version should calculate a minimum acceptable output amount before the swap and pass it into the contract.

A safer function shape would be:

```solidity
function swapWETHForDAI(
    uint256 amountIn,
    uint256 amountOutMinimum
) external returns (uint256 amountOut)
```

Then the router params would use:

```solidity
amountOutMinimum: amountOutMinimum
```

This project keeps the current version minimal so the swap mechanics are easy to inspect.

## TypeScript Scripts

### `scripts/swap.ts`

`scripts/swap.ts` is the main script for running the current demo.

It performs the full execution flow:

```txt
1. load the local signer
2. create WETH and DAI contract instances
3. wrap ETH into WETH
4. print balances before the swap
5. deploy WethToDaiSwap.sol
6. approve WethToDaiSwap.sol to spend WETH
7. execute swapWETHForDAI
8. print balances after the swap
9. print WETH spent and DAI received
```

The script is intended to run on a local mainnet fork.

Example:

```bash
npx hardhat run scripts/swap.ts --network localhost
```

or:

```bash
npm run swap:local
```

It should not be used directly on real Ethereum mainnet.

### `scripts/utils/addresses.ts`

This file stores known mainnet addresses used by the scripts.

Current addresses include:

```txt
Uniswap V3 SwapRouter
Uniswap V3 Quoter
WETH
DAI
USDC
UNI
AAVE
```

The current swap demo only needs:

```txt
WETH
DAI
SwapRouter
```

The other token addresses are kept for future examples.

### `scripts/utils/abi.ts`

This file contains ABIs used by the TypeScript scripts.

It currently defines a minimal ERC20 ABI:

```ts
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];
```

It also defines a WETH ABI by extending the ERC20 ABI:

```ts
const WETH_ABI = [
  ...ERC20_ABI,
  "function deposit() payable",
  "function withdraw(uint256 amount)",
];
```

This keeps the scripts small and avoids importing large token artifacts.

If the repo later uses the Uniswap `Quoter` or `SwapRouter` directly from TypeScript, their full ABIs can also be imported here.

### `scripts/utils/contracts.ts`

This file creates ethers contract instances.

Current helpers:

```ts
getERC20(address, signerOrProvider)
getWETH(address, signerOrProvider)
```

These helpers centralize ABI usage so scripts do not need to manually construct contract objects each time.

Example use:

```ts
const weth = getWETH(ADDRESSES.MAINNET.WETH, signer);
const dai = getERC20(ADDRESSES.MAINNET.DAI, signer);
```

### `scripts/utils/provider.ts`

This file provides access to the Hardhat signer and provider.

Current helpers:

```ts
getSigner()
getProvider()
```

`getSigner()` returns the first local signer from Hardhat:

```ts
const [signer] = await ethers.getSigners();
```

This signer is used for:

```txt
deploying contracts
wrapping ETH into WETH
approving token transfers
executing swaps
reading balances
```

### `scripts/utils/formatting.ts`

This file provides helpers for token unit conversion.

Current helpers:

```ts
formatTokenAmount(amount, decimals)
parseTokenAmount(amount, decimals)
```

This is useful for tokens with different decimals.

Examples:

```ts
formatTokenAmount(wethBalance, 18)
formatTokenAmount(usdcBalance, 6)
parseTokenAmount("100", 6)
```

For WETH and DAI, `ethers.formatEther` also works because both use 18 decimals.

For USDC, these helpers are safer because USDC uses 6 decimals.

### `scripts/utils/tokens.ts`

This file defines Uniswap SDK `Token` objects.

Current tokens:

```txt
WETH
DAI
USDC
UNI
AAVE
```

This file is not required for the basic WETH → DAI swap script.

It becomes useful if the repo later adds:

```txt
SDK-based quoting
route construction
pool inspection
trade simulation
multi-hop swaps
```

## Tests

### `test/WethToDaiSwap.t.sol`

`WethToDaiSwap.t.sol` is the Foundry test file for the Solidity swap contract.

It should test the swap against a mainnet fork.

The expected test flow is:

```txt
1. deploy WethToDaiSwap.sol with the Uniswap V3 SwapRouter address
2. give the test account WETH
3. approve WethToDaiSwap.sol to spend WETH
4. call swapWETHForDAI
5. verify that the account received DAI
```

Run with:

```bash
forge test --fork-url http://127.0.0.1:8545 -vvv
```

or:

```bash
npm run test:forge
```

The test depends on forked mainnet state because the contract interacts with real mainnet deployments:

```txt
WETH
DAI
Uniswap V3 SwapRouter
Uniswap V3 pools
```

## Hardhat and Foundry Roles

This repo uses both Hardhat and Foundry.

Hardhat is used for:

```txt
TypeScript scripts
ethers integration
local fork script execution
deployment-style demos
```

Foundry is used for:

```txt
Solidity tests
fork-based contract testing
fast test execution
```

This split is intentional.

Hardhat makes TypeScript scripting convenient. Foundry makes Solidity tests fast and direct.

## Mainnet Fork Model

The project is designed to run against a local Ethereum mainnet fork.

The contracts and scripts use real Ethereum mainnet addresses, but execution happens locally.

This allows the project to interact with real deployed contracts without spending real funds.

Examples of forked contracts used by the project:

```txt
WETH
DAI
Uniswap V3 SwapRouter
Uniswap V3 pools
```

Typical local fork command:

```bash
anvil --fork-url "$MAINNET_RPC_URL"
```

Then run the script in another terminal:

```bash
npm run swap:local
```

## Environment Variables

The project needs a mainnet RPC URL for forking.

Local `.env` file:

```env
MAINNET_RPC_URL=https://mainnet.example/YOUR_API_KEY
```

The `.env` file should not be committed.

The repo should include:

```txt
.env.example
```

with a placeholder value.

Example `.env.example`:

```env
MAINNET_RPC_URL=https://mainnet.example/YOUR_API_KEY
```

## Generated Files

These files and directories are generated and should not be committed:

```txt
node_modules/
artifacts/
cache/
cache_hardhat/
out/
typechain-types/
scripts/cache_hardhat/
```

The npm lockfile should be committed:

```txt
package-lock.json
```

`package-lock.json` makes dependency installation more reproducible for other users and for future clones of the repo.

## Current Limitations

The current implementation is intentionally minimal.

Current limitations:

```txt
only supports WETH -> DAI
uses a fixed Uniswap V3 fee tier
uses amountOutMinimum = 0
does not query expected output before swapping
does not protect against slippage
does not support multi-hop swaps
does not support exact-output swaps
does not support flash swaps yet
does not include production-grade safety checks
```

These limitations are acceptable for a local fork demo.

They should not be copied into a production swap system without changes.

## Planned Extensions

The repo can grow into a broader Uniswap V3 lab.

Possible future contracts:

```txt
contracts/
  ExactInputSwap.sol
  ExactOutputSwap.sol
  MultiHopSwap.sol
  FlashSwap.sol
  PoolInspector.sol
```

Possible future scripts:

```txt
scripts/
  quote.ts
  exact-input.ts
  exact-output.ts
  multi-hop-swap.ts
  flash-swap.ts
  inspect-pool.ts
  simulate-arbitrage.ts
```

Possible future topics:

```txt
Uniswap V3 quoting
exact-input swaps
exact-output swaps
multi-hop swaps
pool state inspection
tick inspection
liquidity inspection
flash swaps
arbitrage simulation
slippage protection
gas comparison
event logging
deployment helpers
```
