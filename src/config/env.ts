import "dotenv/config";

function requireEnv(name: string) {
  
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  
  return value;
}


export const env = {
  MAINNET_RPC_URL_CHAINNODES : requireEnv("MAINNET_RPC_URL_CHAINNODES"),
  MAINNET_RPC_URL_ALCHEMY: requireEnv("MAINNET_RPC_URL_ALCHEMY"),
  UNISWAP_API_KEY : requireEnv("UNISWAP_API_KEY"),
}
