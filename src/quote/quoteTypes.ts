import { Token } from "@uniswap/sdk-core";

export type QuoteParams = {
  tokenIn: Token;
  tokenOut: Token;
  amount: string;
  signer?: string;
  slippageTolerance?: number;
  protocols?: string[];
};

export type QuoteRow = {
    label: string;
    amount: string;
    symbol?: string;
};

