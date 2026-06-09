import type { Request, Response } from "express";
import { BadRequestError, handleApiError } from "./errors";
import { initSession, updateSession, readState, startSessionExpiryCheck, SESSION_STATUS } from "../state";
import { validateSessionId, validateQuoteQuery, validateWalletSummaryQuery, validateSwapBodyParams } from "./validation";
import { resolveToken, TOKEN_LIST, getERC20Contract, wrapEth, unwrapEth, getTokenBalance } from '../src/tokens/';
import { getQuote } from "../src/quote";
import { ADDRESSES, getLocalAccounts, getLocalWalletByAddress } from "../src/ethereum";
import { WalletBalance, WalletSummary, TokenSymbol } from "../shared/types";
import { formatTokenAmount, parseTokenAmount } from "../src/utils";
import { swapInputSingle } from "../src/swap";


export async function initSessionHandler(req: Request, res: Response) {
  try {
    const sessionId = validateSessionId(req.body.sessionId);

    console.log("[API] Initializing session with id:", sessionId);

    const port = await initSession(sessionId);

    if (typeof port !== "number") {
      throw new Error("Could not get port. Failed to initialize session.");
    }

    console.log(`[API] Initialized session with id: ${sessionId} and port: ${port}`);

    console.log(`[API] Kickstarting expiry check with id: ${sessionId}`);
    startSessionExpiryCheck(sessionId);

    res.json({ port });
  } catch (err) {
    handleApiError(res, err, "Failed to initialize session.");
  }
}

export async function sessionStatusHandler(req: Request, res: Response) {
  try {
    const sessionId = validateSessionId(req.query.sessionId);

    const status = SESSION_STATUS.get(sessionId);

    if (!status) {
      return res.json({
        phase: "idle",
        message: "Fork session has not started yet.",
      });
    }

    res.json(status);
  } catch (err) {
    handleApiError(res, err, "Failed to fetch fork status");
  }
}

export async function pingSessionHandler(req: Request, res: Response) {
  try {
    const sessionId = validateSessionId(req.body.sessionId);

    await updateSession(sessionId);

    res.json({ updated: true });
  } catch (err) {
    handleApiError(res, err, "Failed to ping session");
  }
}

export async function quoteHandler(req: Request, res: Response) {
  try {
    const params = validateQuoteQuery(req);

    const tokenIn = resolveToken(params.tokenIn);
    const tokenOut = resolveToken(params.tokenOut);
    const amount = params.amount;

    const quote = await getQuote({
      tokenIn,
      tokenOut,
      amount,
    });

    console.log("[API] Quote successful: ", quote, "\n");
    res.json(quote);

  } catch (err) {
    handleApiError(res, err, "Failed to quote");
  }
}

export async function getLocalAccountsListHandler(req: Request, res: Response) {
  try {

    const accounts = await getLocalAccounts();

    const addressList: string[] = [];

    accounts.forEach((acc) => addressList.push(acc.address));

    console.log("[API] Fetched account list: ", accounts, "\n");
    res.json(addressList);

  } catch (err) {
    handleApiError(res, err, "Unable to retrieve local accounts");
  }
}

export async function getTokenListHandler(req: Request, res: Response) {
  try {
    const symbols = TOKEN_LIST.map((token) => token.symbol);

    console.log(`[API] Fetched token list: ${symbols} \n`);
    res.json(symbols);

  } catch (err) {
    handleApiError(res, err, "Unable to retrieve token list");
  }
}

export async function getWalletSummaryHandler(req: Request, res: Response) {
  try {

    const { address, sessionId } = validateWalletSummaryQuery(req);

    const state = await readState(sessionId);

    if (state.initialized === false || state.state === null) {
      throw new Error(`State is not initialized. Invalid sessionId: ${sessionId}. Failed to get wallet summary.`);
    }
    const port = state.state.anvil.port

    const signer = await getLocalWalletByAddress(address, String(port));
    const provider = signer.provider
    if (!provider) {
      throw new Error("Could not get provider. Failed to fetch wallet summary.");
    }

    const balances = await Promise.all(

      TOKEN_LIST.map(async (token): Promise<WalletBalance | null> => {

        // special case for getting ETH balance
        if (token.address === ADDRESSES.MAINNET.ETH) {

          const balance = await provider.getBalance(signer.address)

          if (balance == 0n) {

            return null;
          }

          return {
            symbol: token.symbol!,
            balance: formatTokenAmount(balance, token.decimals).toString()
          }

        }

        const rawBalance = await getERC20Contract(token.address, signer).balanceOf(address);
        if (rawBalance == 0) {
          return null;
        }

        return {
          symbol: token.symbol!,
          balance: formatTokenAmount(rawBalance, token.decimals).toString()
        };
      })
    );

    const nonZeroBalances = balances.filter(
      (balance): balance is WalletBalance => balance !== null
    );

    let totalBalance = 0;

    const recordsEntries = await Promise.all(

      nonZeroBalances.map(async (token) => {

        const tokenIn = resolveToken(token.symbol);

        if (tokenIn.address == ADDRESSES.MAINNET.USDC) {

          const usdcBalance = Number(token.balance);
          totalBalance += usdcBalance;

          return [token.symbol, usdcBalance] as const;
        }

        const tokenOut = resolveToken("USDC");

        const quote = await getQuote({
          tokenIn: tokenIn,
          tokenOut: tokenOut,
          amount: token.balance
        });

        totalBalance += Number(quote.quotedAmountOut);

        return [token.symbol, quote.quotedAmountOut] as const;

      })
    );

    const records = Object.fromEntries(recordsEntries) as Record<TokenSymbol, string>;

    const walletSummary: WalletSummary = {
      balances: nonZeroBalances,
      tokenValuesUsd: records,
      totalUsd: totalBalance.toString()
    }
    console.log("[API] Fetched wallet summary: ", walletSummary, "\n");
    res.json(walletSummary);

  } catch (err) {
    handleApiError(res, err, "Failed to fetch wallet summary")
  }
}

export async function swapHandler(req: Request, res: Response) {
  try {
    const { sessionId, tokenIn, tokenOut, amount, account } = validateSwapBodyParams(req);

    const state = await readState(sessionId);

    if (state.initialized === false || state.state === null) {
      throw new Error(`State is not initialized. Invalid sessionId: ${sessionId}. Failed to swap tokens.`);
    }

    const port = state.state.anvil.port;
    const signer = await getLocalWalletByAddress(account, String(port));
    const provider = signer.provider;
    if (!provider) {
      throw new Error("Could not get provider. Failed to swap tokens.");
    }

    let tokenInChecked = tokenIn;
    let tokenOutChecked = tokenOut;
    let needToUnwrap = false;

    const tokenInObj = resolveToken(tokenIn);
    const tokenOutObj = resolveToken(tokenOut);

    const rawAmount = parseTokenAmount(amount, tokenInObj.decimals);

    // In the special case where tokenIn == ETH
    // we have 2 scenarios to take care of:
    // 1. TokenOut is any token but WETH ->
    // we wrap ETH to WETH, set WETH as tokenIn and perform swap.
    // 2. TokenOut is WETH ->
    // We wrap ETH to WETH and return.
    if (tokenInObj.address === ADDRESSES.MAINNET.ETH) {
      const ethBalance = await provider.getBalance(signer.address);

      if (ethBalance < rawAmount) {
        throw new BadRequestError("Insufficient ETH balance");
      }

      if (tokenOutObj.address === ADDRESSES.MAINNET.WETH) {
        
        const wrappedData = await wrapEth(signer, amount);

        const wrapResponse = {
          from: tokenInObj.address,
          to: tokenOutObj.address,
          amountRaw: wrappedData.wrapAmountRaw,
          amountFormatted: wrappedData.wrapAmountFormatted,
          txnHash: wrappedData.txnHash
        }
        console.log("[API] Swap successful: ", wrapResponse, "\n");
        return res.json(wrapResponse);
      }

      try {
        await wrapEth(signer, amount);
        tokenInChecked = "WETH";
      } catch (err) {
        console.error(err);
        throw new Error("[API] Unable to wrap ETH");
      }
    } else {
      
      const balance = await getTokenBalance(tokenInObj.address, signer);

      if (balance < rawAmount) {
        throw new BadRequestError(`Insufficient ${tokenIn} balance.`);
      }
      
      const isWethToEth =
        tokenInObj.address === ADDRESSES.MAINNET.WETH &&
        tokenOutObj.address === ADDRESSES.MAINNET.ETH;
      
      const isTokenToEth =
        tokenInObj.address !== ADDRESSES.MAINNET.WETH &&
        tokenOutObj.address === ADDRESSES.MAINNET.ETH;
      
      if(isTokenToEth) {
        tokenOutChecked = "WETH"
        needToUnwrap = true;
      }

      if (isWethToEth) {
        
        const unwrappedData = await unwrapEth(signer, amount);

        const unwrapResponse = {
          from: tokenInObj.address,
          to: tokenOutObj.address,
          amountRaw: unwrappedData.wrapAmountRaw,
          amountFormatted: unwrappedData.wrapAmountFormatted,
          txnHash: unwrappedData.txnHash
        }
        console.log(`[API] Swap successful: ${unwrapResponse} \n`);
        return res.json(unwrapResponse);
      }

    }

    const swapResponse = await swapInputSingle(
      tokenInChecked,
      tokenOutChecked,
      account,
      amount,
      "0",
      String(port),
      state.state.deployed.SwapRouterSingle.address
    );

    if (!swapResponse) {
      throw new Error("Swap failed.");
    }

    if(needToUnwrap) {
      const unwrappedData = await unwrapEth(signer, swapResponse.amountFormatted);
      
      if(unwrappedData) {
        swapResponse.to = ADDRESSES.MAINNET.ETH;
      }

    }

    console.log("[API] Swap successful: ", swapResponse, "\n");
    res.json(swapResponse);

  } catch (err) {
    handleApiError(res, err, "Failed to swap");
  }
}