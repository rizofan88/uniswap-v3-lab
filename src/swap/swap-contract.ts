import { ethers } from "hardhat";
import { ADDRESSES, getSigner } from "../ethereum";
import { getERC20, getWETH } from "../tokens";
import { trimDecimals } from "../utils";


export async function swapWethToDai() {

  const signer = await getSigner();

  const signerAddress = await signer.getAddress();

  const weth = getWETH(ADDRESSES.MAINNET.WETH, signer);
  const dai = getERC20(ADDRESSES.MAINNET.DAI, signer);

  const amountToWrap = ethers.parseEther("0.1");
  const amountToSwap = ethers.parseEther("0.1");

  console.log("\n--- Wrapping ETH into WETH ---");
  const wrapTx = await weth.deposit({ value: amountToWrap });
  await wrapTx.wait();

  console.log("\n--- Balances before swap ---");
  const wethBefore = await weth.balanceOf(signerAddress);
  const daiBefore = await dai.balanceOf(signerAddress);

  console.log("WETH:", ethers.formatEther(wethBefore));
  console.log("DAI:", ethers.formatEther(daiBefore));

  console.log("\n--- Deploying WethToDaiSwap contract ---");
  const WethToDaiSwap = await ethers.getContractFactory("WethToDaiSwap");

  const swap = await WethToDaiSwap.deploy(ADDRESSES.MAINNET.SWAP_ROUTER);
  await swap.waitForDeployment();

  const swapAddress = await swap.getAddress();

  console.log("\n--- WethToDaiSwap deployed at address ---");
  console.log(swapAddress);

  console.log("\n--- Approving WethToDaiSwap contract ---");
  const approveTx = await weth.approve(swapAddress, amountToSwap);
  await approveTx.wait();

  const allowance = await weth.allowance(signerAddress, swapAddress);
  console.log("Allowance:", ethers.formatEther(allowance), "WETH");

  console.log("\n--- Executing swap ---");
  const swapTx = await swap.swapWETHForDAI(amountToSwap);
  await swapTx.wait();

  console.log("\n--- Balances after swap ---");
  const daiAfter = await dai.balanceOf(signerAddress);
  const wethAfter = await weth.balanceOf(signerAddress);

  console.log("DAI:", ethers.formatEther(daiAfter));
  console.log("WETH:", ethers.formatEther(wethAfter));
  
  console.log("\n--- Swap result ---");
  console.log("DAI received:", ethers.formatEther(daiAfter - daiBefore));
  console.log("WETH spent:", ethers.formatEther(wethBefore - wethAfter), "\n");
  
}
