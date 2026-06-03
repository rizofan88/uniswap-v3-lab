import { formatEther, JsonRpcSigner, Wallet } from "ethers";
import { getWETH } from "./contracts";
import { ADDRESSES } from "../ethereum";
import { parseTokenAmount, formatTokenAmount } from "../utils";
import { getLocalWalletByAddress } from "../ethereum";


export async function wrapEth(signer: Wallet | JsonRpcSigner, amount: string) {

    const amountRequested = parseTokenAmount(amount, 18);
    
    const weth = await getWETH(ADDRESSES.MAINNET.WETH, signer);
    const before = await weth.balanceOf(signer.address);

    const txn = await weth.deposit({value: amountRequested});
    const receipt = await txn.wait();
    
    if (!receipt) {
        throw new Error("Transaction receipt not found");
    }
        
    const after = await weth.balanceOf(signer.address);

    const amountWrapped =  Number(after-before);
    
    if(Number(amountRequested) !== amountWrapped){
        throw new Error("Failed to Wrap ETH");
    }

    return {
        wrapAmountRaw: amountWrapped,
        wrapAmountFormatted: formatTokenAmount(amountRequested, 18),
        txnHash: txn.hash
    }

}


export async function unwrapEth(signer: Wallet | JsonRpcSigner, amount: string) {
    
    const amountRequested = parseTokenAmount(amount, 18);
    
    const provider = signer.provider;
    if(!provider) {
        throw new Error("Could not fetch ETH balance before unwrap call");
    }
    
    const before = await signer.provider?.getBalance(signer.address);
   
    
    const weth = await getWETH(ADDRESSES.MAINNET.WETH, signer);

    const txn = await weth.withdraw(amountRequested);
    const receipt = await txn.wait();
    
    if (!receipt) {
        throw new Error("Transaction receipt not found");
    }
    

    const after = await signer.provider?.getBalance(signer.address);
   

    const gasPaid = Number(receipt.gasUsed * receipt.gasPrice);
    const amountUnwrapped =  Number(after-before) + gasPaid;
    
    if(Number(amountRequested) !== amountUnwrapped){
        throw new Error("Failed to Wrap ETH");
    }

    return {
        wrapAmountRaw: amountUnwrapped,
        wrapAmountFormatted: formatTokenAmount(amountRequested, 18),
        txnHash: txn.hash
    }
}
/* 
async function g() {
    const signer = await getLocalWalletByAddress("0xe0E3Fa968E5888Ce9458878C392fE1711c8FF54d")

    await wrapEth(signer, "0.1");
    await signer.getNonce();
    const res = await unwrapEth(signer, "0.1");
    const weth = await getWETH(ADDRESSES.MAINNET.WETH, signer);
    console.log(res);

}
g(); */
