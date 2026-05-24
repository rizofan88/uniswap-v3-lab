import { ethers } from "hardhat";
import type { ContractRunner } from "ethers";
import { ABI } from "../contracts";

export function getERC20(address: string, signerOrProvider: ContractRunner) {
  return new ethers.Contract(address, ABI.ERC20, signerOrProvider);
}

export function getWETH(address: string, signerOrProvider: ContractRunner) {
  return new ethers.Contract(address, ABI.WETH, signerOrProvider);
}
