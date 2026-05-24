import { ethers } from "hardhat";

export async function getSigner() {
  const [signer] = await ethers.getSigners();
  
  if (!signer) {
    throw new Error("No signer available");
  }
  
  return signer;
}

export const DEFAULT_SIGNER_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
