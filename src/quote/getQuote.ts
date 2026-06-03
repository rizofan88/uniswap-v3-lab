import { env } from "../config";
import { ethers } from "hardhat";
import { QuoteParams } from  "./quoteTypes";
import { QuoteResult } from "../../shared/types";
import { trimDecimals } from "../utils";
import { DEFAULT_SIGNER_ADDRESS, ADDRESSES } from "../ethereum";


const API = "https://trade-api.gateway.uniswap.org/v1/quote";
    

export async function getQuote({
    tokenIn,
    tokenOut,
    amount,
    signer = DEFAULT_SIGNER_ADDRESS,
    slippageTolerance = 0.5,
    protocols = ["V3"],
}: QuoteParams): Promise<QuoteResult> {

    if(!env.UNISWAP_API_KEY) {
        throw new Error("Could not fetch Uniswap Api key.");
    }
    
    const response = await fetch(API, {
        method: "POST",
        headers: {
            "x-api-key": env.UNISWAP_API_KEY,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "x-universal-router-version": "2.0",
            "x-erc20eth-enabled": "false",
            "x-permit2-disabled": "false",
        },
        body: JSON.stringify({
            tokenIn: tokenIn.address,
            tokenOut: tokenOut.address,
            tokenInChainId: tokenIn.chainId,
            tokenOutChainId: tokenOut.chainId,
            type: "EXACT_INPUT",
            amount: ethers.parseUnits(amount, tokenIn.decimals).toString(),
            swapper: signer,
            slippageTolerance,
            protocols,
        }),
    });

    if (!response.ok) {
        throw new Error(`Quote request failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();

    const input = data.quote.input;
    const output = data.quote.output;

    let gasFeeUSD;

    if(!data.quote.gasFeeUSD) {
        console.log("Are we here?")
        const ethPrice = await getEthPrice();
        const wei = Number(ethers.formatEther(data.quote.gasFee));
        gasFeeUSD = wei * ethPrice;
    }else {
        gasFeeUSD = data.quote.gasFeeUSD;
        console.log("or are we here?");
    }

    return {
        tokenIn: input.token,
        tokenOut: output.token,
        amountIn: trimDecimals(
            ethers.formatUnits(input.amount, tokenIn.decimals),
            2
        ).toString(),
        quotedAmountOut: trimDecimals(
            ethers.formatUnits(output.amount, tokenOut.decimals),
            2
        ).toString(),
        gasFeeUsd: trimDecimals(String(gasFeeUSD), 2),
    };
}

export async function getEthPrice() {
    
    if(!env.UNISWAP_API_KEY) {
        throw new Error("Could not fetch Uniswap Api key.");
    }
    
    const ethPriceResponse = await fetch(API, {
        method: "POST",
        headers: {
            "x-api-key": env.UNISWAP_API_KEY,
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
    
    if (!ethPriceResponse.ok) {
        throw new Error(`Quote for eth price failed: ${ethPriceResponse.status} ${await ethPriceResponse.text()}`);
    }

    const usdToEth = await ethPriceResponse.json();

    return Number(ethers.formatUnits(usdToEth.quote.output.amount,6));
}

/* (async () => {
        

    const quote = await getQuote({
        tokenIn: resolveToken(ADDRESSES.MAINNET.ETH),
        tokenOut: resolveToken(ADDRESSES.MAINNET.UNI),
        amount: "0.1",
    })
    console.log(quote)
})()
 */