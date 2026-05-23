import uniswapLogo from './assets/uniswap_logo.png'
import './App.css'

function App() {
  return (
    <main className="page">
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">Ethereum Mainnet Fork Demo</p>

          <img
            src={uniswapLogo}
            className="uniswap-logo"
            alt="Uniswap logo"
          />

          <h1>Uniswap V3 Lab</h1>

          <p className="hero-text">
            A Solidity and TypeScript project demonstrating a WETH to DAI swap
            through the Uniswap V3 SwapRouter using a local Ethereum mainnet fork.
          </p>

          <div className="hero-actions">
            <a
              className="button primary"
              href="https://github.com/rizofan88/uniswap-v3-lab"
              target="_blank"
              rel="noreferrer"
            >
              View GitHub
            </a>
          </div>
        </div>

        <section className="swap-card" id="demo">
          <div className="card-header">
            <h2>Swap Preview</h2>
            <span className="status">Demo</span>
          </div>

          <div className="token-box">
            <label>You pay</label>
            <div className="token-row">
              <input value="0.1" readOnly />
              <span className="token">WETH</span>
            </div>
          </div>

          <div className="arrow">↓</div>

          <div className="token-box">
            <label>You receive</label>
            <div className="token-row">
              <input value="204.00178826" readOnly />
              <span className="token">DAI</span>
            </div>
          </div>

          <div className="details">
            <div>
              <span>Route</span>
              <strong>WETH → DAI</strong>
            </div>

            <div>
              <span>Fee tier</span>
              <strong>0.3%</strong>
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

          <button className="swap-button" disabled>
            Run locally with script
          </button>
        </section>
      </section>

      <section className="info-section">
        <article className="info-card">
          <h3>What it demonstrates</h3>
          <p>
            The project wraps ETH into WETH, approves the Uniswap V3 router,
            executes a WETH to DAI swap, and checks token balances on a forked
            Ethereum mainnet environment.
          </p>
        </article>

        <article className="info-card">
          <h3>Tech stack</h3>
          <ul>
            <li>Solidity smart contract</li>
            <li>Foundry and Anvil</li>
            <li>Hardhat</li>
            <li>TypeScript scripts</li>
            <li>ethers v6</li>
            <li>Uniswap V3 periphery</li>
          </ul>
        </article>

        <article className="info-card">
          <h3>Local execution</h3>
          <pre>
            <code>{`npm install
npx hardhat run scripts/swap.ts`}</code>
          </pre>
        </article>
      </section>
    </main>
  )
}

export default App