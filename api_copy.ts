// server/api.ts
import express, { raw } from "express";
import cors from "cors";
import { getQuote } from "../src/quote";
import { swapInputSingle } from "../src/swap";
import { resolveToken, TOKEN_LIST, getERC20, wrapEth, getWETH, getTokenBalance  } from '../src/tokens/';
import { ADDRESSES, getLocalAccounts, getLocalWalletByAddress } from "../src/ethereum";
import { formatTokenAmount } from "../src/utils";
import { WalletBalance, WalletSummary, TokenSymbol } from "../shared/types";
import { initState, hasExpired, cleanSession, updateSession, readState } from "../state/state";

const app = express();

app.use(cors());
app.use(express.json());



let PORT: number | undefined;


app.get("/api/init-state", async (req, res) => {
 
  try {

    const sessionId = String(req.query.sessionId ?? "");
    console.log("[API] Initializing session with id: ", sessionId);

    if(!sessionId) {
      throw new Error("Missing session Id");
    }
    // initialize state
    const port = await initState(sessionId);
    console.log("[API] Initialized session with id: ", sessionId, "and port: ", port);

    console.log("[API] Calling check session with id: ", sessionId, "\n");
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

    console.log("[API] Pinging with id: ", sessionId);
    
    if(!sessionId) {
      throw new Error("Missing session id");
    }

    const updated = await updateSession(sessionId);
    console.log("[API] Updating session with id: ", sessionId, "\n");

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
  console.log("[API] Kickstarted expiry check with id: ", sessionId, "\n");

  const intervalId = setInterval(async() => {
    
    const expired = await hasExpired(sessionId);

    if(expired) {
      console.log("[API] Cleaning session with id: ", sessionId);
      await cleanSession(sessionId);

      console.log("[API] Stopping check function with id: ", sessionId, "\n");
      // stop interval
      clearInterval(intervalId);
    }
    
  }, 6_000);
}

app.get("/api/quote", async (req, res) => {

  try {
    console.log("GET /api/quote called");
    const tokenInArg = String(req.query.tokenIn ?? "");
    const tokenOutArg = String(req.query.tokenOut ?? "");
    const amount = String(req.query.amount ?? "");

    if (!tokenInArg || !tokenOutArg || !amount) {
      return res.status(400).json({
        error: "Missing tokenIn, tokenOut or amount",
      });
    }

    const tokenIn = resolveToken(tokenInArg);
    const tokenOut = resolveToken(tokenOutArg);

    const quote = await getQuote({
      tokenIn,
      tokenOut,
      amount,
    });

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
      throw new Error("No sessionId. Failed to fetch accounts.");
    }

    const state = await readState(sessionId);
    if(state.initialized === false && state.state === null) {
      throw new Error(`No session initialized with sessionId: ${sessionId}.`);
    }
    
    const port = state.state?.anvil.port

    const accounts = await getDefaultAccounts(String(port));
    res.json(accounts);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: err instanceof Error ? err.message : "Unable to retrieve default accounts error",
    });
  }
});

app.get("/api/token_list", async (req, res) => {
  
  try {

    const symbols = TOKEN_LIST.map((token) => token.symbol);
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
      throw new Error("Missing Address or Session Id");
    }
    
    const state = await readState(sessionId);
    const port = state.state?.anvil.port
    console.log("[API] Getting wallet summary with port: ", port, "\n");

    const signer = await getLocalSignerByAddress(address, String(port));
    
    const balances = await Promise.all(
      
    TOKEN_LIST.map(async (token):Promise<WalletBalance | null> => {

      // special case for getting ETH balance
      if(token.address === ADDRESSES.MAINNET.ETH) {
        
        const balance = formatTokenAmount(
          await signer.provider.getBalance(signer.address), 
          token.decimals
        );

        if (balance === "0") {
          return null;
        }

        return {
          symbol: token.symbol!,
          balance: balance
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
      throw new Error("Missing session id");
    }
    if (typeof tokenIn !== "string" || tokenIn.length === 0) {
      throw new Error("Missing tokenIn");
    }
    if (typeof tokenOut !== "string" || tokenOut.length === 0) {
      throw new Error("Missing tokenOut");
    }
    if (typeof amount !== "string" || Number(amount) <= 0) {
      throw new Error("Invalid amount");
    }
    if (typeof account !== "string" || account.length === 0) {
      throw new Error("Missing account");
    }

    const state = await readState(sessionId);

    if(state.initialized === false && state.state === null) {
      throw new Error(`State is not initialized. Invalid sessionId: ${sessionId}`);
    }

    const port = state.state?.anvil.port;
    const signer = await getLocalSignerByAddress(account, String(port));

    // check token if its eth, and if enough balance
    let tokenInChecked = tokenIn;

    // check balance before sending swap
    const tokenInstance = resolveToken(tokenIn);

    // in the special case where user wants to swap eth 
    // we will have to wrap it beforehand, then use WETH
    // as tokenIn, therefore the need of tokenInChecked variable
    if(tokenInstance.address === ADDRESSES.MAINNET.ETH) {
      const ethBalance = await signer.provider.getBalance(signer.address);

      if(ethBalance < Number(amount)) {
        throw new Error("Insufficient ETH balance");
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
      const balance = await getTokenBalance(tokenInstance.address, signer);

      if(balance < Number(amount)) {
        console.log("error");
        throw new Error(`Insufficient ${tokenIn} balance.`);
      }
    }

    const swapResponse = await swapInputSingle(
      tokenInChecked,
      tokenOut,
      account,
      amount,
      "0",
      String(port)
    );

    console.log("[API] Swap response: ", swapResponse);

    if(!swapResponse) {
      throw new Error("Swap failed");
    }

    return res.json(swapResponse);

  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to execute swap",
    });
  }
});

/* app.post("/api/post", (req,res) => {

  console.log(res.json(req.body));

  console.log("in", req.body.tokenIn);
  console.log("out", req.body.tokenOut);
  console.log("amount", req.body.amount);
  console.log("account", req.body.account);

  const params = {
    "in" :req.body.tokenIn,
    "out" :req.body.tokenOut,
    "amount" :req.body.amount,
    "account" :req.body.account
  }

  return res.json(params);
});
 */

const port = 3001;

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});

