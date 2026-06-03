import fs, { read } from "fs";
import fsPromise from "fs/promises";
import pathMod from "path"

import { getAvailablePort, markPortFree } from "./ports";
import { spawn, exec, ChildProcess } from "child_process";
import { ADDRESSES, assertRpcIsAlive, DEFAULT_SIGNER_ADDRESS, fundLocalAccounts, getLocalSignerByAddress, getSigner, waitForRpc } from "../src/ethereum";
import { deploySwapRouterSingle } from "../src/contracts";

const stateDir = "state/sessions";

type SessionInfo = {
  id: string;
  state: "initialized" | "null";
  lastSeen: number;
  anvil: {port: number, pid: number};
  deployed: Record<string, {address: string}>
}

type State = {
  initialized: boolean;
  state: SessionInfo | null;
}

// one helper function to read file and return parsed json
// has two return params, init: boolean, parsed: JSON
export async function readState(sessionId: string): Promise<State> {
  
  const path = pathMod.join(stateDir, `${sessionId}.json`);

  const exists = fs.existsSync(path);

  if(exists) {
    
    const raw = fs.readFileSync(
      path, 
      {encoding: "utf8"}
    );  
    
    const parsed = JSON.parse(raw);

    if( parsed.state === "initialized") {
      return {
        initialized: true,
        state: parsed
      };
    }
  }
  
  return {
    initialized: false,
    state: null
  };

}

export async function initState(sessionId: string) {
  
  await stateHealth();

  // read boolean of readState return value
  const state = await readState(sessionId);

  if(state.initialized) {
    console.log("[API] Already initialized with port: ", state.state?.anvil.port);
    return state.state?.anvil.port;
  }

  const path = pathMod.join(stateDir, `${sessionId}.json`);
  console.log("init path: ", path);
  
  const port =  getAvailablePort();

  const anvil: ChildProcess = spawn(
    "anvil",
    [
      "--fork-url",
      "mainnet",
      "--port",
      `${port}`
    ]
  );

  let deployedSwapRouterAddress;
  
  const stream = fs.createWriteStream(`/dev/ttys008`);
  
  anvil.on("spawn",() => {
    void(async () => {
      try {
        console.log(`[STATE] Anvil was spawned with pid: ${anvil.pid} and port: ${port}`);
       
        console.log("[STATE] Waiting for anvil RPC to be ready...");
        await waitForRpc(String(port));

        console.log("[STATE] Funding local accounts...");
        const funded = await fundLocalAccounts(String(port));
        const signer = await getLocalSignerByAddress(DEFAULT_SIGNER_ADDRESS);
        deployedSwapRouterAddress = await deploySwapRouterSingle(signer);

        if(!deployedSwapRouterAddress) {
          throw new Error("Could not deploy SwapRouterSingle Contract");
        }

        if(!funded) {
          throw new Error("Failed to fund accounts.");
        }
        console.log("[STATE] Local accounts funded.");
        fs.writeFileSync(
          path,
          JSON.stringify(
            {
              id: sessionId,
              state: "initialized",
              lastSeen: Date.now(),
              anvil: {port: port, pid: pid},
              deployed: {
                SwapRouterSingle: {
                  address: deployedSwapRouterAddress
                }
              }
            }
          )
        );
      } catch (err) {
        console.error("[STATE] Failed to initialize Anvil:", err);
      }
    })();
  });
  
  // catch output for debugging
  anvil.stdout?.pipe(stream);
  

  anvil.on("close", (code, signal) => {
    console.log("[STATE] Anvil was closed with code: ", code, "and signal: ", signal, "\n");
    anvil.stdout?.unpipe(stream)
    stream.end()
  })

  const pid = anvil.pid;
  // start anvil fork and store PID
  // do you want to already deploy swap contract?
  // if yes store


  
  return port;
}

export async function updateSession(sessionId: string): Promise<boolean> {

  const state = (await readState(sessionId)).state

  if(!state) {
    throw new Error("No state to update");
  }

  const path = pathMod.join(stateDir, `${sessionId}.json`);

  state.lastSeen = Date.now();

  fs.writeFileSync(path, JSON.stringify(state));
  console.log(`[STATE] Session id: ${state.id} UPDATED`);
  console.log("[STATE] using port: ", state.anvil.port, "\n");
  
  return true;

}

export async function hasExpired(sessionId: string): Promise<boolean> {
    const now = Date.now();

    const state = (await readState(sessionId)).state;
    
    if(!state) {
      return false;
    }

    if(now - state.lastSeen > 30_000) {
      console.log("[STATE] Session expired\n")
      return true;
    }

    console.log(`[STATE] Session id: ${state.id} still active`)
    console.log("[STATE] using port: ", state.anvil.port, "\n");
    return false;
}

export async function cleanSession(sessionId: string) {
  
  const state = (await readState(sessionId)).state;

  if(state?.state == null) {
    throw new Error("No state to clean up");
  }

  console.log(`[STATE] Killing anvil in session ${state.id}, with port: `, state.anvil.port);
  // kill anvil
  process.kill(state.anvil.pid);
  
  console.log(`[STATE] rm session file: ${state.id}`);
  // rm file
  exec(`rm ${stateDir}/${state.id}.json`);

  console.log("[STATE] marking ", state.anvil.port, "as free.", "\n");
  // free port
  await markPortFree(state.anvil.port);

}

async function stateHealth() {

  const files = await fsPromise.readdir(stateDir, {encoding: "utf8"})
  
  for(const file of files) {
    
      const sessionId = pathMod.basename(file, ".json");
      let port;
    
    try {
      const state = await readState(sessionId);
      port = state.state?.anvil.port;
    
      const isAlive = await assertRpcIsAlive(String(port));
      
      if(isAlive) {
        console.log("Session: ", sessionId, "is alive with port: ", port);
        continue;
      }
    
    } catch (err) {
      
      const path = pathMod.join(stateDir, file);
      console.log("session is dead: ", sessionId);
      console.log("Attempting to remove path: ", path);

      await markPortFree(port!);

      await fsPromise.rm(path);

      console.log("Removed dead session: ", sessionId);
    }
  }
}



/* initState("1234").then((port)=>console.log("port", port));

setTimeout(() => {
  readState("1234").then((state) => {
    console.log("id", state.state?.id);
    console.log("anvil", state.state?.anvil.pid);
    console.log("time", state.state?.lastSeen);
    console.log("port", state.state?.port);
    console.log("deployed", state.state?.deployed);
    console.log("router", state.state?.deployed["SwapRouter"]);
    console.log("address of router", state.state?.deployed["SwapRouter"].address);
  })
  
}, 5_000);


const id = setInterval(() => {
  hasExpired("1234").then((bool) => {
    if(bool) {
      console.log("Session expired");
      cleanState("1234").then(() => console.log("State cleande"));
      clearInterval(id);
    } else {
      console.log("hasnt expired");
    }
  })
}, 9_000) */

