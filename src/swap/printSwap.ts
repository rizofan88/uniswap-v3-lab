import { SwapBalances } from "./swapTypes";
import { formatTokenAmount } from "../utils";

export function printSwap(
    balances: SwapBalances,
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    allowance: string,

) {

    console.log("\n--- Wrapping ETH into WETH ---");
    console.log("\n--- Balances before swap ---");

    console.log("WETH:", balances.inBefore);
    console.log("DAI:", balances.outBefore);

    console.log("\n--- Deploying WethToDaiSwap contract ---");


    console.log("\n--- WethToDaiSwap deployed at address ---");

    console.log("\n--- Approving WethToDaiSwap contract ---");

    console.log("Allowance:", allowance, "WETH");

    console.log("\n--- Executing swap ---");

    console.log("\n--- Balances after swap ---");

    console.log("DAI:", balances.outAfter.toString());
    console.log("WETH:", balances.inAfter.toString());

    console.log("\n--- Swap result ---");
    console.log("DAI received:", formatTokenAmount(
        balances.outAfter - balances.outBefore, 18).toString());
    console.log("WETH spent:", formatTokenAmount(
        balances.inBefore - balances.inAfter, 18).toString());

}