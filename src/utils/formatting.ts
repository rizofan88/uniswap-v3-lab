import { formatUnits, parseUnits } from "ethers";

export function formatTokenAmount(amount: bigint, decimals: number): string {
  return formatUnits(amount, decimals);
}

export function parseTokenAmount(amount: string, decimals: number): bigint {
  return parseUnits(amount, decimals);
}

export function trimDecimals(value: string, decimals: number): string {
  const [whole, fraction = ""] = value.split(".");

  if (decimals === 0) return whole;

  return `${whole}.${fraction.slice(0, decimals)}`;
}

