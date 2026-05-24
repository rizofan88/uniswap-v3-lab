# Uniswap V3 Lab

A mainnet-fork Ethereum project for experimenting with Uniswap V3 integrations using Solidity, Foundry, Hardhat, and TypeScript.

Current examples include:

- A WETH → DAI exact-input swap through a deployed Solidity helper contract.
- A TypeScript quote client that calls the Uniswap Quote API to estimate exact-input swap output and gas fees.
- Token metadata helpers for resolving symbols such as `WETH`, `DAI`, and `AAVE` into Uniswap SDK `Token` objects.

## What this demonstrates

- Solidity contract integration with Uniswap V3 `SwapRouter`
- Mainnet-fork testing with Foundry and Anvil
- TypeScript scripts using ethers v6
- Uniswap quote API integration for exact-input swap estimates
- WETH wrapping, ERC20 approval, and swap execution
- Clean separation of addresses, ABIs, token metadata, and contract helpers

## Tech stack

**Smart contracts and local fork**

- Solidity
- Foundry / Forge / Anvil
- Hardhat
- Uniswap V3 periphery

**TypeScript tooling**

- TypeScript
- ethers v6
- Uniswap Quote API

**Frontend / project page**

- React
- Vite
- GitHub Pages

## Project structure

```text
src/
  config/       Environment variable loading and validation
  contracts/    Contract ABIs and contract-related exports
  ethereum/     Ethereum addresses, provider, and signer helpers
  quote/        Uniswap quote API client, quote types, and CLI output formatting
  swap/         WETH → DAI swap demo logic
  tokens/       Token metadata, token contract helpers, and symbol resolution
  utils/        Generic formatting and printing helpers

contracts/
  WethToDaiSwap.sol      Solidity contract that performs the WETH → DAI swap

test/
  WethToDaiSwap.t.sol    Foundry mainnet-fork tests

scripts/
  swap.ts                TypeScript script that deploys and calls the WethToDaiSwap contract
  quote.ts               TypeScript script that executes the quote query with provided arguments

frontend/
  React / Vite project page deployed with GitHub Pages

foundry.toml             Foundry configuration
hardhat.config.ts        Hardhat configuration for TypeScript scripts
```

## Setup

Install node dependencies:

```bash
npm install
```

Install Foundry if you don't already have it:

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

Add forge test utilities.

In project root run:

```bash
mkdir -p lib/
git clone https://github.com/foundry-rs/forge-std lib/forge-std
```

Create a `.env` file:

```bash
cp .env.example .env
```

Add a valid Ethereum mainnet RPC URL and Uniswap API key:

```env
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
UNISWAP_API_KEY="YOUR_API_KEY"
```

Then load them in the environment:

```bash
source .env
```

## Run local mainnet fork

Foundry RPC aliases are configured in `foundry.toml`:

```toml
[rpc_endpoints]
mainnet = "${MAINNET_RPC_URL}"
localhost = "http://127.0.0.1:8545"
```

The npm scripts use the `mainnet` alias, so `.env` must define the same variable name used in `foundry.toml`.

If you rename MAINNET_RPC_URL, update foundry.toml also.

Start a local fork:

```bash
npm run fork
```

This runs:

```bash
anvil --fork-url mainnet \
  --fork-block-number -10 \
  --fork-chain-id 1 \
  --chain-id 1
```

And starts a local fork at:

```text
http://127.0.0.1:8545
```

Keep this terminal running while executing the tests or TypeScript scripts from another terminal.

## Run Forge tests

In a second terminal:

```bash
npm run test:forge
```

This runs the command: 

```bash
forge test --fork-url localhost -vvv
```

## Run TypeScript swap script

```bash
npm run swap:local
```

This runs the command:

```bash
npx hardhat run scripts/swap.ts --network localhost
```

## Query Uniswap quote API

```bash
npm run quote -- <tokenIn> <tokenOut> <amount>
```
The quote command resolves token symbols from the local token list in:

```text
src/tokens/tokens.ts
```

Only tokens defined in that file are supported by the CLI. To add another token, add a new `Token` definition to `src/tokens/tokens.ts` and include it in `TOKEN_LIST`.

## Example output

```bash
forge test --fork-url localhost -vvv
```

```text
[⠊] Compiling...
[⠒] Compiling 26 files with Solc 0.8.30
[⠑] Solc 0.8.30 finished in 2.58s
Compiler run successful!

Ran 7 tests for test/WethToDaiSwap.t.sol:WethToDaiSwapTest
[PASS] testDeploys() (gas: 2484)
[PASS] testSwapConsumesExactWethAmount() (gas: 169808)
[PASS] testSwapOutputsDai() (gas: 169748)
[PASS] testSwapRevertsWithoutApproval() (gas: 50744)
[PASS] testUserCanApproveSwapContract() (gas: 68695)
[PASS] testUserCanSwapWETHForDAI() (gas: 172148)
[PASS] testUserCanWrapEthIntoWeth() (gas: 42221)
Suite result: ok. 7 passed; 0 failed; 0 skipped; finished in 15.56ms (8.04ms CPU time)

Ran 1 test suite in 701.03ms (15.56ms CPU time): 7 tests passed, 0 failed, 0 skipped (7 total tests)
```


```bash
npx hardhat run scripts/swap.ts --network localhost
```

```text
--- Wrapping ETH into WETH ---

--- Balances before swap ---
WETH: 0.1
DAI: 204.001788267463093592

--- Deploying WethToDaiSwap contract ---

--- WethToDaiSwap deployed at address ---
0xa68E430060f74F9821D2dC9A9E2CE3aF7d842EBe

--- Approving WethToDaiSwap contract ---
Allowance: 0.1 WETH

--- Executing swap ---

--- Balances after swap ---
DAI: 408.002728227362767699
WETH: 0.0

--- Swap result ---
DAI received: 204.000939959899674107
WETH spent: 0.1
```

```bash
npx tsx scripts/quote.ts WETH DAI 0.1
```

```text
--- Quote ---
Input:      0.1  WETH
Output:  210.09  DAI
Fees:     $0.01  
-------------
```

## Frontend 

This repository includes a small React/Vite frontend in `frontend/`.

The frontend is a static project page for the Uniswap V3 swap demo. It presents the WETH → DAI swap flow, the local mainnet-fork execution model, and the project tech stack.

It does not execute swaps directly in the browser. The actual swap logic is run locally through the Hardhat/TypeScript scripts.

### Run the frontend locally

```bash
cd frontend
npm install
npm run dev
```

### Build the frontend

```bash
cd frontend
npm run build
```

The build artifact is generated in `frontend/dist`.

## Notes

This project is for local fork/demo purposes only. It does not implement production slippage protection.

For real mainnet swaps, you would first query the quote provider for the expected output amount, apply a slippage tolerance, and pass the result as `amountOutMinimum` in the `SwapRouter` params.
