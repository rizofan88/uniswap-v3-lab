import { Token } from "@uniswap/sdk-core";
import { ADDRESSES } from "../ethereum";

export const CHAIN_ID = 1;

export const WETH_TOKEN = new Token(
  CHAIN_ID,
  ADDRESSES.MAINNET.WETH,
  18,
  "WETH",
  "Wrapped Ether"
);

export const DAI_TOKEN = new Token(
  CHAIN_ID,
  ADDRESSES.MAINNET.DAI,
  18,
  "DAI",
  "Dai Stablecoin"
);

export const USDC_TOKEN = new Token(
  CHAIN_ID,
  ADDRESSES.MAINNET.USDC,
  6,
  "USDC",
  "USD Coin"
);

export const UNI_TOKEN = new Token(
  CHAIN_ID,
  ADDRESSES.MAINNET.UNI,
  18,
  "UNI",
  "Uniswap"
);

export const AAVE_TOKEN = new Token(
  CHAIN_ID,
  ADDRESSES.MAINNET.AAVE,
  18,
  "AAVE",
  "Aave Token"
);

export const TOKEN_LIST: Token[] = [
  WETH_TOKEN,
  DAI_TOKEN,
  USDC_TOKEN,
  UNI_TOKEN,
  AAVE_TOKEN
]