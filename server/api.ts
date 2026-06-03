import express, { raw } from "express";
import cors from "cors";
import { getQuote } from "../src/quote";
import { swapInputSingle } from "../src/swap";
import { resolveToken, TOKEN_LIST, getERC20, wrapEth, getWETH, getTokenBalance  } from '../src/tokens/';
import { ADDRESSES, getLocalAccounts, getLocalWalletByAddress } from "../src/ethereum";
import { formatTokenAmount } from "../src/utils";
import { WalletBalance, WalletSummary, TokenSymbol } from "../shared/types";
import { initState, hasExpired, cleanSession, updateSession, readState } from "../state/state";
import { unwrapEth } from "../src/tokens/weth";

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    console.log(
      `[API] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`
    );
  });

  next();
});

app.get("/api/init-state", async (req, res) => {
 
  try {

    const sessionId = String(req.query.sessionId ?? "");
    console.log("[API] Initializing session with id: ", sessionId);

    if(!sessionId) {
      throw new Error("Missing session Id");
    }
    // initialize state
    const port = await initState(sessionId);
    console.log(`[API] Initialized session with id: ${sessionId} and port: ${port}`);

    console.log(`[API] Kickstarting expiry check with id: ${sessionId} \n`);
    // kickstart expired check interval
    await checkSession(sessionId);

    res.json(port);
    
  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown server error",
    });
  }
})

app.get("/api/ping-session", async (req, res) => {
  try {
    const sessionId = String(req.query.sessionId ?? "");

    if(!sessionId) {
      throw new Error("Missing session id");
    }

    const updated = await updateSession(sessionId);

    res.json(updated);
    //res.json(false);

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown server error",
    });
  }
});

async function checkSession(sessionId: string) {
  console.log(`[API] Expiry check kickstarted with id: ${sessionId} \n`);

  const intervalId = setInterval(async() => {
    
    const expired = await hasExpired(sessionId);

    if(expired) {
      console.log(`[API] Session expired. Cleaning session with id: ${sessionId} \n`);
      await cleanSession(sessionId);

      // stop interval
      clearInterval(intervalId);
    }
    
  }, 6_000);
}

app.get("/api/quote", async (req, res) => {

  try {
    
    const tokenInArg = String(req.query.tokenIn ?? "");
    const tokenOutArg = String(req.query.tokenOut ?? "");
    const amount = String(req.query.amount ?? "");

    if (!tokenInArg || !tokenOutArg || !amount) {
      return res.status(400).json({
        error: "Missing tokenIn, tokenOut or amount.",
      });
    }

    const tokenIn = resolveToken(tokenInArg);
    const tokenOut = resolveToken(tokenOutArg);

    const quote = await getQuote({
      tokenIn,
      tokenOut,
      amount,
    });

    console.log(`[API] Quote successful: ${quote} \n`);
    res.json(quote);
  
  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown server error",
    });
  }
});

app.get("/api/accounts", async (req, res) => { 
  
  try {
    const sessionId = String(req.query.sessionId ?? "");
    if(!sessionId) {
      throw new Error("Missing sessionId. Failed to fetch accounts.");
    }

    const state = await readState(sessionId);
    if(state.initialized === false && state.state === null) {
      throw new Error(`No session initialized with sessionId: ${sessionId}.`);
    }
    
    const port = state.state?.anvil.port

    const accounts = await getLocalAccounts();

    const addressList: string[] = [];

    accounts.forEach((acc) => addressList.push(acc.address));
    
    console.log(`[API] Fetched accounts: ${accounts} \n`);
    res.json(addressList);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: err instanceof Error ? err.message : "Unable to retrieve local accounts error",
    });
  }
});

app.get("/api/token_list", async (req, res) => {
  
  try {

    const symbols = TOKEN_LIST.map((token) => token.symbol);

    console.log(`[API] Fetched token list: ${symbols} \n`);
    res.json(symbols);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: err instanceof Error ? err.message : "Unable to retrieve token list error",
    });

  }
});

app.get("/api/wallet-summary", async (req, res) => {
  
  try {
    const address = String(req.query.address ?? "");
    const sessionId = String(req.query.sessionId ?? "");
    
    if(!address || !sessionId) {
      throw new Error("Missing Address or Session Id. Failed to fetch wallet summary.");
    }
    
    const state = await readState(sessionId);
    const port = state.state?.anvil.port

    const signer = await getLocalWalletByAddress(address, String(port));
    const provider = signer.provider
    if(!provider) {
      throw new Error("Could not get provider. Failed to fetch wallet summary.");
    }
    
    const balances = await Promise.all(
      
      TOKEN_LIST.map(async (token):Promise<WalletBalance | null> => {

        // special case for getting ETH balance
        if(token.address === ADDRESSES.MAINNET.ETH) {
          
          const balance = await provider.getBalance(signer.address)

          if (balance == 0n) {
            
            return null;
          }

          return {
            symbol: token.symbol!,
            balance: formatTokenAmount(balance, token.decimals).toString()
          }

        }

        const rawBalance = await getERC20(token.address, signer).balanceOf(address);
        

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

        if(tokenIn.address == ADDRESSES.MAINNET.USDC) {

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

        return [token.symbol, quote.quotedAmountOut] as const ;
        
      })
    );

    const records = Object.fromEntries(recordsEntries) as Record<TokenSymbol, string>;

    const walletSummary: WalletSummary = {
      balances: nonZeroBalances,
      tokenValuesUsd: records,
      totalUsd: totalBalance.toString()
    }
    console.log(`[API] Fetched wallet summary: ${walletSummary} \n`);
    res.json(walletSummary);
    
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to fetch balances",
    });
  } 
});

app.post("/api/swap", async (req, res) => {
  try {

    const { sessionId, tokenIn, tokenOut, amount, account } = req.body;
    
    if (typeof sessionId !== "string" || sessionId.length === 0) {
      throw new Error("Missing session id: Failed to swap tokens.");
    }
    if (typeof tokenIn !== "string" || tokenIn.length === 0) {
      throw new Error("Missing tokenIn: Failed to swap tokens.");
    }
    if (typeof tokenOut !== "string" || tokenOut.length === 0) {
      throw new Error("Missing tokenOut: Failed to swap tokens.");
    }
    if (typeof amount !== "string" || Number(amount) <= 0) {
      throw new Error("Invalid amount: Failed to swap tokens.");
    }
    if (typeof account !== "string" || account.length === 0) {
      throw new Error("Missing account: Failed to swap tokens.");
    }

    const state = await readState(sessionId);

    if(state.initialized === false && state.state === null) {
      throw new Error(`State is not initialized. Invalid sessionId: ${sessionId}. Failed to swap tokens.`);
    }

    const port = state.state?.anvil.port;
    const signer = await getLocalWalletByAddress(account, String(port));
    const provider = signer.provider;
    if(!provider) {
      throw new Error("Could not get provider. Failed to swap tokens.");
    }
    
    // check token if its eth, and if enough balance
    let tokenInChecked = tokenIn;

    // check balance before sending swap
    const tokenInObj = resolveToken(tokenIn);
    const tokenOutObj = resolveToken(tokenOut);

    // in the special case where user wants to swap eth 
    // we will have to wrap it beforehand, then use WETH
    // as tokenIn, therefore the need of tokenInChecked variable
    if(tokenInObj.address === ADDRESSES.MAINNET.ETH) {
      const ethBalance = await provider.getBalance(signer.address);

      if(ethBalance < Number(amount)) {
        throw new Error("Insufficient ETH balance");
      }

      // Wrap check
      if(tokenOutObj.address === ADDRESSES.MAINNET.WETH) {
        // if tokenOut is weth then we shall wrap the requested eth amount
        const wrappedData = await wrapEth(signer, amount);
        
        const wrapResponse =  { // we'll return an object conforming with expected json output
          from: tokenInObj.address,
          to: tokenOutObj.address,
          amountRaw: wrappedData.wrapAmountRaw,
          amountFormatted: wrappedData.wrapAmountFormatted,
          txnHash: wrappedData.txnHash
        }
        console.log(`[API] Swap successful: ${wrapResponse} \n`);
        return res.json(wrapResponse);

      }

      try {
        await wrapEth(signer, amount);
        tokenInChecked = "WETH";
      } catch(err) {
        console.error(err);
        throw new Error("[API] eth check");
      }
    } else {
      // if not ETH, every other token can be checked with this function
      const balance = await getTokenBalance(tokenInObj.address, signer);

      if(balance < Number(amount)) {
        console.log("error");
        throw new Error(`Insufficient ${tokenIn} balance.`);
      }
      const isWethToEth = 
        tokenInObj.address === ADDRESSES.MAINNET.WETH && 
        tokenOutObj.address === ADDRESSES.MAINNET.ETH ;
      
      if(isWethToEth) {
        //unwrap
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
      tokenOut,
      account,
      amount,
      "0",
      String(port),
      state.state?.deployed.SwapRouterSingle.address
    );

    

    if(!swapResponse) {
      throw new Error("Swap failed.");
    }

    console.log(`[API] Swap successful: ${swapResponse} \n`);
    return res.json(swapResponse);

  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to execute swap",
    });
  }
});

const port = 3001;

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});

