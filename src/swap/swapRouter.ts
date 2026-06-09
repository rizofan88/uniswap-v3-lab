import { ethers } from "hardhat";
import { FeeAmount } from "@uniswap/v3-sdk";
import { ADDRESSES, getLocalWalletByAddress } from "../ethereum";
import { getERC20Contract, approveToken, resolveToken } from "../tokens";
import { formatTokenAmount, parseTokenAmount } from "../utils";
import { SwapResponse } from "../../shared/types";
import { SwapRouterSingle } from "../../typechain-types";


export async function swapInputSingle(
    tokenIn: string,
    tokenOut: string,
    recipient: string,
    amountIn: string,
    amountOutMin = "0",
    port = "8545",
    swapRouterDeployed?: string
): Promise<SwapResponse> {

    try {

        const signer = await getLocalWalletByAddress(recipient, port);

        const tokens = {
            in: resolveToken(tokenIn),
            out: resolveToken(tokenOut)
        }

        if (!tokenOut) {
            throw new Error("No Token found in list");
        }

        const amounts = {
            in: parseTokenAmount(amountIn, tokens.in.decimals),
            out: parseTokenAmount(amountOutMin, tokens.out.decimals),
        }

        const params = {
            tokenIn: tokens.in.address,
            tokenOut: tokens.out.address,
            fee: FeeAmount.MEDIUM,
            recipient: signer.address,
            deadline: 0,
            amountIn: amounts.in,
            amountOutMinimum: amounts.out,
            sqrtPriceLimitX96: 0
        }

        await signer.getNonce();

        const SwapRouterSingle = await ethers.getContractFactory("SwapRouterSingle", signer);
        let swapRouterSingle: SwapRouterSingle;

        if (swapRouterDeployed) {
            console.log("[SWAP] Reusing deployed address");
            swapRouterSingle = SwapRouterSingle
                .attach(swapRouterDeployed)
                .connect(signer) as SwapRouterSingle;
        } else {
            swapRouterSingle = await SwapRouterSingle.deploy(ADDRESSES.MAINNET.SWAP_ROUTER);
            await swapRouterSingle.waitForDeployment();
        }

        const swapContractAddress = await swapRouterSingle.getAddress();

        await approveToken(
            tokens.in.address,
            signer,
            swapContractAddress,
            params.amountIn
        );

        await signer.getNonce();

        const swapTxn = await swapRouterSingle.swapExactInputSingle(
            params.tokenIn,
            params.tokenOut,
            params.fee,
            params.recipient,
            params.deadline,
            params.amountIn,
            params.amountOutMinimum,
            params.sqrtPriceLimitX96
        );

        const receipt = await swapTxn.wait();

        if (!receipt) {
            throw new Error("Transaction receipt not found");
        }

        for (const log of receipt.logs) {

            if (log.address === tokens.out.address) {

                const parsed = await getERC20Contract(tokens.out.address, signer).interface.parseLog(log);

                if (parsed?.name === "Transfer") {

                    return {
                        from: parsed.args.from,
                        to: parsed.args.to,
                        amountRaw: parsed.args.value.toString(),
                        amountFormatted: formatTokenAmount(parsed.args.value, tokens.out.decimals),
                        txnHash: swapTxn.hash
                    };

                }
            }
        }
        throw new Error("Could not find transaction receipt");

    } catch (err) {
        console.error(err);
        throw new Error("Unable to perform swap");
    }
}