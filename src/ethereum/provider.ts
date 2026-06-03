import { ethers } from "hardhat";

export function getProvider() {
  return ethers.provider;
}

export function getLocalProvider(port = "8545") {
  return new ethers.JsonRpcProvider(`http://localhost:${port}`);
}

export async function assertRpcIsAlive(port: string): Promise<any> {

  const res = await fetch(
    `http://localhost:${port}`,
    {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_chainId",
        params: [],
        id : 1
      })
    }
  );

  if(!res.ok) {
    throw new Error(`Unable to connect to RPC endpoint with port ${port}`);
  }

  const data = await res.json();
  //console.log("\n[PROVIDER] Test was successful: ", data, "\n");

  if (data.error) {
    throw new Error(`RPC endpoint using port ${port} returned error: ${data.error.message}`);
  }

  if (!data.result) {
    throw new Error(`RPC endpoint using port ${port} did not return expected data`);
  }

}

export async function waitForRpc(
  port: string,
  attempts = 30,
  delayMs = 500
):Promise <void> {
  for(let i = 0; i < attempts; i++) {
    try {
      await assertRpcIsAlive(port);
      return;
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(`RPC on port ${port} did not become ready`);
}

/* (async () => {
  const isAlive = await assertRpcIsAlive("8545");
  console.log(isAlive)
})(); */