import { useEffect, useState } from "react";
import "./App.css";
import type {
  SwapResponse,
  QuoteResult,
  TokenSymbol,
  WalletSummary,
  WalletBalance,
  WalletValue,
  SessionStatus
} from "../../shared/types";


type TokenSelection = TokenSymbol | "";

type LocalAccount = {
  address: string;
  label: string;
};

async function initSession(sessionId: string) {

  console.log("Calling init session API.");

  const res = await fetch("/api/init-session", {
    method: "POST",
    headers: { "Content-type": "application/json" },
    body: JSON.stringify({ sessionId })
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error ?? "Failed to call initialize session api");
  }

  if (typeof data?.port !== "number") {
    throw new Error("Invalid init-session response from server.");
  }

  console.log("Port received:", data.port);

  return data.port;
}

async function fetchSessionStatus(sessionId: string): Promise<SessionStatus> {

  const res = await fetch(`/api/session-status?sessionId=${sessionId}`);

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error ?? "Failed to fetch session status.");
  }

  if (!data?.phase || !data?.message) {
    throw new Error("Invalid session status response.");
  }

  return data;
}

async function pingSession(sessionId: string) {

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("/api/ping-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId }),
    });


    if (res.ok) {
      return;
    }

    if (attempt === 0) {
      console.log("Not updated, trying to ping again.");
      await sleep(1_000);
    }
  }

  throw new Error(
    "Lost connection to the local fork session. Reload the page to start a new session."
  );

}

async function getForkAccounts(): Promise<LocalAccount[]> {

  const res = await fetch("/api/accounts");

  if (!res.ok) {
    throw new Error("Failed to connect account. Try again please.");
  }

  const accounts: string[] = await res.json();

  const ANVIL_ACCOUNTS: LocalAccount[] = accounts.map((address, index) => ({
    address,
    label: `Anvil Account ${index}`
  }));

  return ANVIL_ACCOUNTS;
}

async function fetchTokens(): Promise<TokenSymbol[]> {

  const res = await fetch("/api/token-list");

  if (!res.ok) {
    throw new Error("Failed to fetch token list");
  }

  const tokens = await res.json();

  return tokens;
}

async function fetchQuote(params: {
  tokenIn: TokenSymbol;
  tokenOut: TokenSymbol;
  amount: string;
}): Promise<QuoteResult> {
  console.log("Requesting quote:", params);

  const query = new URLSearchParams(params);
  const res = await fetch(`/api/quote?${query}`);

  if (!res.ok) {
    throw new Error("Failed to fetch quote.");
  }

  const data: QuoteResult = await res.json();

  return {
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    amountIn: params.amount,
    quotedAmountOut: data.quotedAmountOut,
    gasFeeUsd: data.gasFeeUsd,
  };
}

async function getWalletSummary(params: {
  sessionId: string
  address: string,
}): Promise<WalletSummary> {

  const query = new URLSearchParams(params);
  const res = await fetch(`/api/wallet-summary?${query}`);

  if (!res.ok) {
    throw new Error("Failed to fetch wallet summary");
  }

  const summary: WalletSummary = await res.json();

  return summary;

}

async function executeSwap(params: {
  sessionId: string;
  tokenIn: TokenSymbol;
  tokenOut: TokenSymbol;
  amount: string;
  account: string;
}): Promise<SwapResponse> {

  const res = await fetch("/api/swap", {
    method: "POST",
    headers: { "Content-type": "application/json" },
    body: JSON.stringify(params)
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data.error ?? "Swap Failed. Try again.");
  }

  return data;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatTokenDisplay(value: string | number, maxDecimals = 4) {
  const num = Number(value);

  if (!Number.isFinite(num)) return String(value);

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: maxDecimals,
  }).format(num);
}

function formatUsd(value: string | number) {
  const num = Number(value);

  if (!Number.isFinite(num)) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(num);
}

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function makeSessionId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function App() {
  const [sessionId, setSessionId] = useState<string>();
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>({
    phase: "idle",
    message: "Preparing session...",
  });

  const [accounts, setAccounts] = useState<LocalAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<LocalAccount | null>(
    null
  );
  const [walletValue, setWalletValue] = useState<WalletValue | null>(null);

  const [balances, setBalances] = useState<WalletBalance[]>([]);

  const [tokens, setTokens] = useState<TokenSymbol[]>([]);
  const [tokenIn, setTokenIn] = useState<TokenSelection>("ETH");
  const [tokenOut, setTokenOut] = useState<TokenSelection>("DAI");
  const [amount, setAmount] = useState("0.1");

  const [quote, setQuote] = useState<QuoteResult | null>(null);

  const [statusMessage, setStatusMessage] = useState("");
  const [swapResult, setSwapResult] = useState<SwapResponse | null>(null);

  const [copiedTxHash, setCopiedTxHash] = useState(false);

  const [walletError, setWalletError] = useState("");
  const [swapError, setSwapError] = useState("");
  const [fatalError, setFatalError] = useState("");

  const [isConnecting, setIsConnecting] = useState(false);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [isSwapLoading, setIsSwapLoading] = useState(false);


  useEffect(() => {
    async function initFork() {
      try {
        setFatalError("");

        console.log("Getting session id.");
        let sessionId = sessionStorage.getItem("sessionId");

        if (sessionId) {
          setSessionId(sessionId);
          return;
        }

        sessionId = makeSessionId();
        sessionStorage.setItem("sessionId", sessionId);

        setSessionId(sessionId);

        console.log("Requesting init session.");
        const port = await initSession(sessionId);
        console.log("Session Port setted to: ", port);

      } catch (err) {
        setFatalError(
          err instanceof Error
            ? err.message
            : "Failed to initialize fork. Please reload the page."
        );
      }
    }

    initFork();
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    let timeout: number;

    async function poll() {
      try {
        const status = await fetchSessionStatus(sessionId);

        if (cancelled) return;

        setSessionStatus(status);

        if (status.phase === "ready" || status.phase === "error") {
          return;
        }

        timeout = window.setTimeout(poll, 5_000);
      } catch (err) {
        if (cancelled) return;

        setSessionStatus({
          phase: "error",
          message:
            err instanceof Error
              ? err.message
              : "Failed to fetch fork status.",
        });
      }
    }

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [sessionId]);

  useEffect(() => {
    async function loadTokens() {
      try {
        setFatalError("");
        const fetchedTokens = await fetchTokens();
        setTokens(fetchedTokens);
      } catch (err) {
        setFatalError("Failed to initialize fork data. Please reload the page.");
      }
    }

    loadTokens();
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    if (sessionStatus.phase !== "ready") return;

    console.log("Setting up ping session with sessionId:", sessionId);

    const interval = setInterval(() => {
      pingSession(sessionId).catch((err) => {
        console.error("Failed to ping session:", err);
      });
    }, 10_000);

    return () => clearInterval(interval);
  }, [sessionId, sessionStatus.phase]);


  async function handleConnectWallet() {
    try {
      setWalletError("");
      setIsConnecting(true);
      setIsConnecting(true);

      if (!sessionId) {
        throw new Error("Missing sessionId. Could not fetch accounts");
      }
      if (sessionStatus.phase !== "ready") {
        throw new Error("The local fork is still initializing. Please wait.");
      }

      const forkAccounts = await getForkAccounts();

      setAccounts(forkAccounts);

      const accountToUse = selectedAccount ?? forkAccounts[0];

      if (!accountToUse) {
        throw new Error("No local Anvil accounts found");
      }

      setSelectedAccount(accountToUse);

      const accountSummary: WalletSummary = await getWalletSummary({
        sessionId: sessionId,
        address: accountToUse.address
      });

      setBalances(accountSummary.balances);

      setWalletValue({
        tokenValuesUsd: accountSummary.tokenValuesUsd,
        totalUsd: accountSummary.totalUsd
      });

      setStatusMessage("Connected to local Anvil account");
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : "Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleSelectAccount(address: string) {
    try {
      setWalletError("");
      setQuote(null);

      const account = accounts.find((item) => item.address === address);

      if (!account) {
        throw new Error("Selected account not found");
      }
      if (!sessionId) {
        throw new Error("Missing sessionId. Could not select account.");
      }

      setSelectedAccount(account);

      const accountSummary = await getWalletSummary({
        sessionId: sessionId,
        address: account.address
      });

      setBalances(accountSummary.balances);

      setWalletValue({
        tokenValuesUsd: accountSummary.tokenValuesUsd,
        totalUsd: accountSummary.totalUsd
      });

      setStatusMessage(`Selected ${account.label}.`);
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : "Failed to select account");
    }
  }

  async function handleFetchQuote() {
    try {
      setSwapError("");
      setStatusMessage("");
      setSwapResult(null);
      setQuote(null);
      setIsQuoteLoading(true);

      if (!selectedAccount) {
        throw new Error("Connect a local wallet first");
      }

      if (!amount || Number(amount) <= 0) {
        throw new Error("Enter a valid amount");
      }

      if (tokenIn === tokenOut) {
        throw new Error("Choose two different tokens");
      }

      if (!tokenIn || !tokenOut) {
        throw new Error("Choose both tokens");
      }

      const quoteResult = await fetchQuote({
        tokenIn,
        tokenOut,
        amount,
      });

      setQuote(quoteResult);
      setStatusMessage("Quote loaded.");
    } catch (err) {
      setSwapError(err instanceof Error ? err.message : "Unknown quote error");
    } finally {
      setIsQuoteLoading(false);
    }
  }

  async function handleExecuteSwap() {
    try {
      setSwapError("");
      setWalletError("");
      setStatusMessage("");
      setSwapResult(null);
      setIsSwapLoading(true);

      if (!selectedAccount) {
        throw new Error("Connect a local wallet first");
      }

      if (!quote) {
        throw new Error("Get a quote before swapping");
      }

      if (!tokenIn || !tokenOut) {
        throw new Error("Choose both tokens");
      }

      if (!sessionId) {
        throw new Error("Missing sessionId. Could not call swap.");
      }

      const result = await executeSwap({
        sessionId: sessionId,
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        amount: amount,
        account: selectedAccount.address,
      });

      setSwapResult(result);
      setStatusMessage("Swap submitted");

      try {

        const updatedSummary = await getWalletSummary({
          sessionId: sessionId,
          address: selectedAccount.address
        });

        setBalances(updatedSummary.balances);

        setWalletValue({
          tokenValuesUsd: updatedSummary.tokenValuesUsd,
          totalUsd: updatedSummary.totalUsd
        });

      } catch (err) {
        console.log("error: ", err);
        setWalletError(
          err instanceof Error
            ? `Swap submitted but wallet error occured: ${err.message}`
            : "Swap submitted but unknown wallet error occured."
        )
      }

    } catch (err) {
      setSwapError(
        err instanceof Error
          ? err.message
          : "Unknown swap error."
      );
    } finally {
      setIsSwapLoading(false);
    }
  }

  async function handleCopyTxHash(hash: string) {
    try {
      setSwapError("");
      await navigator.clipboard.writeText(hash);

      setCopiedTxHash(true);

      setTimeout(() => {
        setCopiedTxHash(false);
      }, 1500);
    } catch {
      setSwapError("Failed to fetch transaction hash");
    }
  }

  const selectedTokenInRawBalance =
    balances.find((balance) => balance.symbol === tokenIn)?.balance ?? "0";

  const selectedTokenOutRawBalance =
    balances.find((balance) => balance.symbol === tokenOut)?.balance ?? "0";

  const selectedTokenInBalance = formatTokenDisplay(selectedTokenInRawBalance);
  const selectedTokenOutBalance = formatTokenDisplay(selectedTokenOutRawBalance);

  return (
    <main className="page swap-page">
      {fatalError && (
        <div className="fatal-error-backdrop">
          <div className="fatal-error-modal">
            <div className="fatal-error-icon">!</div>

            <h2>App connection lost</h2>

            <p>{fatalError}</p>

            <button type="button" onClick={() => {
              sessionStorage.removeItem("sessionId");
              window.location.reload()
            }}>
              Reload page
            </button>
          </div>
        </div>
      )}
      <header className="app-header">
        <div>
          <p className="eyebrow">Ethereum Mainnet Fork Demo</p>

          <div className="title-row">
            <div>
              <h1>Uniswap V3 Lab</h1>
              <p className="hero-text">
                Connect a local Anvil account, check token balances, request a
                quote, and execute a Uniswap V3 swap against a forked mainnet.
              </p>
            </div>
          </div>
        </div>

        <a
          className="button secondary"
          href="https://github.com/rizofan88/uniswap-v3-lab"
          target="_blank"
          rel="noreferrer"
        >
          View GitHub
        </a>
      </header>

      <section className="wallet-bar">
        {sessionStatus.phase !== "ready" && !fatalError && (
          <div className="session-status-card">
            <strong>Starting local mainnet fork</strong>
            <p>{sessionStatus.message}</p>
          </div>
        )}

        {!selectedAccount ? (
          <button
            className="button primary"
            onClick={handleConnectWallet}
            disabled={isConnecting || sessionStatus.phase !== "ready"}
          >
            {sessionStatus.phase !== "ready"
              ? "Preparing fork..."
              : isConnecting
                ? "Connecting..."
                : "Connect local wallet"}
          </button>
        ) : (
          <>
            <div className="connected-wallet">
              <span>Connected wallet</span>
              <strong>
                {selectedAccount.label} · {shortenAddress(selectedAccount.address)}
              </strong>
            </div>

            <select
              className="account-select"
              value={selectedAccount.address}
              onChange={(event) => handleSelectAccount(event.target.value)}
              disabled={sessionStatus.phase !== "ready"}
            >
              {accounts.map((account) => (
                <option key={account.address} value={account.address}>
                  {account.label} — {shortenAddress(account.address)}
                </option>
              ))}
            </select>
          </>
        )}
      </section>

      <section className="swap-workspace">
        <section className="swap-card full-swap-card">
          <div className="card-header">
            <h2>Swap</h2>
            <span className="status">Mainnet Fork</span>
          </div>

          <div className="token-box">
            <div className="token-box-header">
              <label>You pay</label>
              <span>Balance: {selectedTokenInBalance}</span>
            </div>

            <div className="token-row">
              <input
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setQuote(null);
                }}
                placeholder="0.0"
              />
              <select
                className="token-select"
                value={tokenIn}
                onChange={(event) => {
                  const nextToken = event.target.value as TokenSelection;

                  setTokenIn(nextToken);
                  setQuote(null);

                  if (nextToken && nextToken === tokenOut) {
                    setTokenOut("");
                  }
                }}
              >
                <option value="">Select</option>
                {tokens.map((token) => (
                  <option key={token} value={token}>
                    {token}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="arrow">↓</div>

          <div className="token-box">
            <div className="token-box-header">
              <label>You receive</label>
              <span>Balance: {selectedTokenOutBalance}</span>
            </div>

            <div className="token-row">
              <input
                value={quote?.quotedAmountOut ?? ""}
                readOnly
                placeholder="Quote required"
              />
              <select
                className="token-select"
                value={tokenOut}
                onChange={(event) => {
                  const nextToken = event.target.value as TokenSelection;

                  setTokenOut(nextToken);
                  setQuote(null);

                  if (nextToken && nextToken === tokenIn) {
                    setTokenIn("");
                  }
                }}
              >
                <option value="">Select</option>
                {tokens.map((token) => (
                  <option key={token} value={token}>
                    {token}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="details">
            <div>
              <span>Route</span>
              <strong>
                {tokenIn || "—"} → {tokenOut || "—"}
              </strong>
            </div>

            <div>
              <span>Estimated gas</span>
              <strong>{quote ? `$${quote.gasFeeUsd}` : "Quote required"}</strong>
            </div>

            <div>
              <span>Router</span>
              <strong>Uniswap V3 SwapRouter</strong>
            </div>

            <div>
              <span>Network</span>
              <strong>Mainnet fork</strong>
            </div>
          </div>

          {swapError && <p className="error-message">{swapError}</p>}
          {statusMessage && <p className="status-message">{statusMessage}</p>}
          {swapResult?.txnHash && (
            <div className="tx-hash-row">
              <span>Tx:</span>

              <code title={swapResult.txnHash}>
                {shortenAddress(swapResult.txnHash)}
              </code>

              <button
                type="button"
                className="copy-tx-button"
                onClick={() => handleCopyTxHash(swapResult.txnHash)}
              >
                {copiedTxHash ? "Copied" : "Copy"}
              </button>
            </div>
          )}

          <div className="swap-actions">

            <button
              className="quote-button"
              onClick={handleFetchQuote}
              disabled={isQuoteLoading || !selectedAccount || !tokenIn || !tokenOut}
            >
              {isQuoteLoading ? "Getting quote..." : "Get quote"}
            </button>

            <button
              className="swap-button"
              onClick={handleExecuteSwap}
              disabled={!quote || isSwapLoading || !selectedAccount}
            >
              {isSwapLoading ? "Swapping..." : "Execute swap"}
            </button>
          </div>
        </section>

        <aside className="wallet-panel">
          <div className="card-header">
            <h2>Wallet</h2>
            <span className="status">Local</span>
          </div>
          {walletError && <p className="error-message">{walletError}</p>}

          {selectedAccount ? (
            <>
              <div className="wallet-address-box">
                <span>Address</span>
                <strong>{selectedAccount.address}</strong>
              </div>

              <div className="balance-list">
                {balances.map((balance) => {
                  const usdValue = walletValue?.tokenValuesUsd[balance.symbol];

                  return (
                    <div className="balance-row token-balance-row" key={balance.symbol}>
                      <div className="balance-token">
                        <span>{balance.symbol}</span>
                        <strong>{formatTokenDisplay(balance.balance)}</strong>
                      </div>

                      <div className="balance-usd-value">
                        {usdValue !== undefined ? formatUsd(usdValue) : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="wallet-total-box">
                <span>Total:</span>
                <strong>{walletValue ? formatUsd(walletValue.totalUsd) : "—"}</strong>
              </div>
            </>
          ) : (
            <p className="empty-wallet">
              Connect one of the local Anvil accounts to view balances.
            </p>
          )}
        </aside>
      </section>
    </main>
  );
}

export default App;
