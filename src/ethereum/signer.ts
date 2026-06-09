import { ethers } from "hardhat";
import type { Wallet } from "ethers"
import { getDefaultAccounts, getLocalAccounts } from "./forkAccounts";
import { assertRpcIsAlive, getLocalProvider } from "./provider";


export async function getSigner() {
  const [signer] = await ethers.getSigners();

  if (!signer) {
    throw new Error("No signer available");
  }
  return signer;
}

export async function getLocalSignerByAddress(address: string, port = "8545") {

  try {

    await assertRpcIsAlive(port);
    const provider = new ethers.JsonRpcProvider(`http://localhost:${port}`);

    const accounts: string[] = await getDefaultAccounts(port);

    const match = accounts.find(
      (account) => account.toLocaleLowerCase() === address.toLocaleLowerCase()
    );

    if (!match) {
      throw new Error(`Address ${address} is not an unlocked local fork account`);
    }

    return provider.getSigner(match);


  } catch (err) {

    throw new Error(`Unable to get provider with address: ${address} and port: ${port}. ${err}`);
  }
}

export async function getLocalWalletByAddress(address: string, port = "8545"): Promise<Wallet> {
  const accounts = await getLocalAccounts();
  const provider = await getLocalProvider(port);

  for (const acc of accounts) {
    if (acc.address === address) {
      return new ethers.Wallet(acc.key, provider);
    }
  }
  throw new Error(`Could not create Wallet instance of account ${address}`);

}

export const DEFAULT_SIGNER_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
