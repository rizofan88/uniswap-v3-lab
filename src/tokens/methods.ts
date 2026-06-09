import { JsonRpcSigner, Wallet } from "ethers";
import { getERC20Contract } from "./contracts";

export async function approveToken(
    token: string,
    signer: JsonRpcSigner | Wallet,
    spender: string,
    amount: bigint
): Promise<bigint> {

    const tokenContract = await getERC20Contract(token, signer);
    const approvedAmount = await tokenContract.approve(spender, amount);
    await approvedAmount.wait()

    if (!approvedAmount) {
        throw new Error(`Could not approve ${amount}`);
    }
    return approvedAmount;
}

export async function getTokenBalance(
    token: string,
    signer: JsonRpcSigner | Wallet
): Promise<bigint> {
    try {
        const tokenContract = await getERC20Contract(token, signer);
        const balance = await tokenContract.balanceOf(signer.address);
        return balance;
    } catch (err) {
        throw new Error("Could not fetch balance");
    }
}
