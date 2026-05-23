import { ethers } from "hardhat";

export async function getSigner() {
  const [signer] = await ethers.getSigners();
  
  if (!signer) {
    throw new Error("No signer available");
  }
  
  return signer;
}

export function getProvider() {
  return ethers.provider;
}