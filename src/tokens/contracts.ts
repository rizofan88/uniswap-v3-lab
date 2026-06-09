import { ethers } from "hardhat";
import type { ContractRunner } from "ethers";
import { ABI } from "../contracts";

export function getERC20Contract(address: string, signerOrProvider: ContractRunner) {
  return new ethers.Contract(address, ABI.ERC20, signerOrProvider);
}

export function getWETHContract(address: string, signerOrProvider: ContractRunner) {
  return new ethers.Contract(address, ABI.WETH, signerOrProvider);
}
