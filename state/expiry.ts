import fsPromise from "fs/promises"
import pathMod from "path";
import { readState, STATE_DIR  } from "./state";
import { cleanSession } from "./session";
import { assertRpcIsAlive } from "../src/ethereum";
import { markPortFree } from "./ports";

const expiryIntervals = new Map<string, NodeJS.Timeout>();

export function startSessionExpiryCheck(sessionId: string): void {
  if (expiryIntervals.has(sessionId)) {
    console.log(`[API] Expiry check already running for id: ${sessionId}`);
    return;
  }

  console.log(`[API] Expiry check kickstarted with id: ${sessionId}\n`);

  const intervalId = setInterval(async () => {
    try {
      const expired = await hasExpired(sessionId);

      if (!expired) {
        return;
      }

      console.log(`[API] Session expired. Cleaning session with id: ${sessionId}\n`);

      await cleanSession(sessionId);

      clearInterval(intervalId);
      expiryIntervals.delete(sessionId);
    } catch (err) {
      console.error(`[API] Expiry check failed for session ${sessionId}:`, err);

      clearInterval(intervalId);
      expiryIntervals.delete(sessionId);
    }
  }, 6_000);

  expiryIntervals.set(sessionId, intervalId);
}

async function hasExpired(sessionId: string): Promise<boolean> {
    const MAX_SESSION_AGE_MS = 10 * 60 * 1000;
    const IDLE_TIMEOUT_MS = 3 * 30 * 1000;

    const now = Date.now();

    const state = (await readState(sessionId)).state;
    
    if(!state) {
      return false;
    }

    if(now - state.createdAt > MAX_SESSION_AGE_MS) {
      console.log("[STATE] Session too old\n")
      return true
    }

    if(now - state.lastSeen > IDLE_TIMEOUT_MS) {
      console.log("[STATE] Session expired\n")
      return true;
    }

    console.log(`[STATE] Session id: ${state.id} still active`)
    console.log("[STATE] using port: ", state.anvil.port, "\n");
    return false;
}

export async function stateHealth() {

  const files = await fsPromise.readdir(STATE_DIR, {encoding: "utf8"})
  
  for(const file of files) {
    
      const sessionId = pathMod.basename(file, ".json");
      let port;
    
    try {
      const state = await readState(sessionId);
      port = state.state?.anvil.port;
    
      await assertRpcIsAlive(String(port));

    } catch (err) {
      
      const path = pathMod.join(STATE_DIR, file);
      console.log(`[STATE] HEALTH CHECK: session ${sessionId} is dead.`);

      await markPortFree(port!);

      await fsPromise.rm(path);

      console.log("[STATE] HEALTH CHECK: removed dead session: ", sessionId);
    }
  }
}
