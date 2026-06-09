import { abi as SWAP_ROUTER_ABI } from "@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json";
import { abi as SWAP_PARAMS_ABI } from "../../out/SwapParams.sol/SwapParams.json"

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

const WETH_ABI = [
  ...ERC20_ABI,
  "function deposit() payable",
  "function withdraw(uint256 amount)",
];

export const ABI = {
  ERC20: ERC20_ABI,
  WETH: WETH_ABI,
  SWAP_ROUTER: SWAP_ROUTER_ABI,
  SWAP_PARAMS: SWAP_PARAMS_ABI
};