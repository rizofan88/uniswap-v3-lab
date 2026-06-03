import { ethers } from "hardhat";
import { ADDRESSES } from "../ethereum";
import { Wallet, JsonRpcSigner } from "ethers"

export async function deploySwapRouterSingle(
    signer: Wallet | JsonRpcSigner
): Promise<string> {

    try {
        const SwapRouterSingle = await ethers.getContractFactory("SwapRouterSingle", signer);
        const swapRouterSingle = await SwapRouterSingle.deploy(ADDRESSES.MAINNET.SWAP_ROUTER);
        await swapRouterSingle.waitForDeployment();
    
        const address = await swapRouterSingle.getAddress();
        if(!address) {
            throw new Error("Could not fetch SwapRouterSingle address");
        }
        return address;

    } catch (err) {
        throw new Error("Could not deploy SwapRouterSingle Contract");
    }

}