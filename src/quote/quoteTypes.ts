import { Token } from "@uniswap/sdk-core";

export type QuoteResult = {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  quotedAmountOut: string;
  gasFeeUsd: string;
  
};
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

