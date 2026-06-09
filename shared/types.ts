export type TokenSymbol = string;

export type WalletBalance = {
  symbol: string;
  balance: string;
}

export type WalletSummary = {
  balances: WalletBalance[];
  totalUsd: string;
  tokenValuesUsd: Record<TokenSymbol, string>;
};

export type WalletValue = {
  totalUsd: string;
  tokenValuesUsd: Record<TokenSymbol, string>;
};

export type SwapResponse = {
  from: string,
  to: string,
  amountRaw: string,
  amountFormatted: string,
  txnHash: string
}

export type QuoteResult = {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  quotedAmountOut: string;
  gasFeeUsd: string;

};

export type SessionStatus = {
  phase:
  | "starting"
  | "forking-mainnet"
  | "waiting-for-rpc"
  | "funding-accounts"
  | "deploying-router"
  | "loading-tokens"
  | "ready"
  | "idle"
  | "error";
  message: string;
  error?: string;
};