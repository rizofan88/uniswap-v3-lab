import "dotenv/config";

function requireEnv(name: string) {
  
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  
  return value;
}


export const env = {
  MAINNET_RPC_URL : requireEnv("MAINNET_RPC_URL"),
  UNISWAP_API_KEY : process.env.UNISWAP_API_KEY,
}
