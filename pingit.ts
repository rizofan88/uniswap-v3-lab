import { DEFAULT_SIGNER_ADDRESS, getLocalProvider, getLocalSignerByAddress, getLocalWalletByAddress } from "./src/ethereum";
import { swapInputSingle } from "./src/swap";
import {exec} from "child_process";
import { ADDRESSES } from "./src/ethereum";
import dotenv from "dotenv";
dotenv.config({path: ".env.accounts"});
import { ethers } from "hardhat";
import { trimDecimals } from "./src/utils";

async function ping(sessionId: string) {
    
    const ids: string[] = [
        "1234",
        "makeitspecial",
        "hellother",
        "abcde",
    ]

    type Pings = {
        ping: NodeJS.Timeout;
        id: string;
    }

    const pings: Pings[] = [];

    for(const id of ids) {

        await fetch(`http://localhost:3001/api/init-state?sessionId=${id}`);

        const pingId = setInterval(async()=>{
            console.log("[PING] pinging for id: ", id, "\n");
            await fetch(`http://localhost:3001/api/ping-session?sessionId=${id}`);
    
        }, 5_000);

        pings.push({
            ping: pingId,
            id: id
        });

    }
    let base = 10_000;
    for (const ping of pings) {
        setTimeout(() => {
            clearInterval(ping.ping);
            console.log("[PING] Stopped ping of id: ", ping.id, "\n");
        }, (base += 5_000));

        
    }

}

(async (port: string, sessionId: string) => {
    
    /* const res = await fetch(`http://localhost:3001/api/swap`, {
        method: "POST",
        headers: {
            "Content-Type" : "application/json"
        },
        body: JSON.stringify({
            sessionId: sessionId,
            tokenIn: "WETH",
            tokenOut: "DAI",
            amount: "0.1",
            account: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
        }),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => null);

        throw new Error(
            error?.error ?? `Request failed with status ${res.status}`
        );
    } */
/*     try {
    const signer = getLocalSignerByAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    const swap = await swapInputSingle(
        "WETH",
        "UNI",
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "0.1"
    );
    console.log(swap);
    } catch(err) {
        throw new Error("Should stop");
        
    } */

        const API = "https://trade-api.gateway.uniswap.org/v1/quote";
        const response = await fetch(API, {
            method: "POST",
            headers: {
                "x-api-key": process.env.UNISWAP_API_KEY,
                "Content-Type": "application/json",
                "Accept": "application/json",
                "x-universal-router-version": "2.0",
                "x-erc20eth-enabled": "false",
                "x-permit2-disabled": "false",
            },
            body: JSON.stringify({
                tokenIn: ADDRESSES.MAINNET.WETH,
                tokenOut: ADDRESSES.MAINNET.ETH,
                tokenInChainId: 1,
                tokenOutChainId: 1,
                type: "EXACT_INPUT",
                amount: ethers.parseUnits("0.1", 18).toString(),
                swapper: DEFAULT_SIGNER_ADDRESS,
                slippageTolerance: 0.5,
                protocols: ["V3"],
            }),
        });
        const data = await response.json();
        
        const input = data.quote.input;
        const output = data.quote.output;
        console.log(data)
        console.log(input.amount)
        console.log(output.amount)
        const wei = Number(ethers.formatEther(data.quote.gasFee));
        const usd = await fetch(API, {
            method: "POST",
            headers: {
                "x-api-key": process.env.UNISWAP_API_KEY,
                "Content-Type": "application/json",
                "Accept": "application/json",
                "x-universal-router-version": "2.0",
                "x-erc20eth-enabled": "false",
                "x-permit2-disabled": "false",
            },
            body: JSON.stringify({
                tokenIn: ADDRESSES.MAINNET.ETH,
                tokenOut: ADDRESSES.MAINNET.USDC,
                tokenInChainId: 1,
                tokenOutChainId: 1,
                type: "EXACT_INPUT",
                amount: ethers.parseUnits("1", 18).toString(),
                swapper: DEFAULT_SIGNER_ADDRESS,
                slippageTolerance: 0.5,
                protocols: ["V3"],
            }),
        });
        const usdToEth = await usd.json();
        console.log(usdToEth);
        console.log("gas: ", wei * Number(ethers.formatUnits(usdToEth.quote.output.amount,6)));

})("8545", "1234");
