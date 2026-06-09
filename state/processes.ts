import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import { once } from "events";
import { fundLocalAccounts, waitForRpc, getLocalSignerByAddress, DEFAULT_SIGNER_ADDRESS } from "../src/ethereum";
import { deploySwapRouterSingle } from "../src/contracts";

export async function anvilSpawnListener(
  anvil: ChildProcess,
  port: number
) {

  try {
    await once(anvil, "spawn");
  
    console.log(`[STATE] Anvil was spawned with pid: ${anvil.pid} and port: ${port}`);
  
    console.log("[STATE] Waiting for anvil RPC to be ready...");
    await waitForRpc(String(port), 120, 1000);
  
    console.log("[STATE] Anvil RPC is ready.");
    
  } catch (err) {
    throw err;
  }

}

export async function prepareForkState(port: number): Promise<string> {

  console.log("\n[STATE] Funding local accounts...");
  const funded = await fundLocalAccounts(String(port));

  if(!funded) {
    throw new Error("Failed to fund accounts.");
  }

  console.log("[STATE] Deploying Swap Router Contract...");
  const signer = await getLocalSignerByAddress(DEFAULT_SIGNER_ADDRESS, String(port));
  const deployedSwapRouterAddress = await deploySwapRouterSingle(signer);

  if(!deployedSwapRouterAddress) {
    throw new Error("Could not deploy SwapRouterSingle Contract");
  }

  console.log("[STATE] Local accounts funded.");
  console.log("[STATE] Swap Router Contract Deployed.");

  return deployedSwapRouterAddress
}

export async function anvilStart(port: number): Promise<number> {

  const anvil: ChildProcess = spawn(
    "anvil",
    [
      "--fork-url",
      "mainnet_alchemy",
      "--fork-block-number",
      "-10",
      "--port",
      `${port}`
    ]
  );
  anvilCloseListener(anvil);

  try {
    await anvilSpawnListener(anvil, port);
  
    const pid = anvil.pid;
  
    if(typeof pid !== "number" || pid <= 0) {
      throw new Error("Anvil process did not expose a pid.");
    }
    
    return pid;

  } catch (err) {
    throw new Error(`Anvil failed to be spawned. Error occured: ${err}`);
  }

}

export function anvilCloseListener(anvil: ChildProcess) {
  anvil.on("close", (code, signal) => {
    console.log("[STATE] Anvil was closed with code: ", code, "and signal: ", signal, "\n");
  });
}

export function anvilKill(pid: number): void {
  try {
    process.kill(pid, "SIGTERM");
    console.log(`[STATE] Sent SIGTERM to Anvil process: ${pid}`);
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;

    if (nodeErr.code === "ESRCH") {
      console.warn(`[STATE] Anvil process ${pid} is already dead.`);
      return;
    }

    throw new Error(
      `Failed to kill Anvil process ${pid}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}