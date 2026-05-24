import { env } from "../config";
import { ethers } from "hardhat";
import { QuoteResult, QuoteParams } from "./quoteTypes";
import { trimDecimals } from "../utils";
import { DEFAULT_SIGNER_ADDRESS } from "../ethereum";


const API = "https://trade-api.gateway.uniswap.org/v1/quote";

export async function getQuote({
    tokenIn,
    tokenOut,
    amount,
    signer = DEFAULT_SIGNER_ADDRESS,
    slippageTolerance = 0.5,
    protocols = ["V3"],
}: QuoteParams): Promise<QuoteResult> {

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
        gasFeeUsd: trimDecimals(data.quote.gasFeeUSD, 2),
    };
}
