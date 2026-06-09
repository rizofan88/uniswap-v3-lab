import { readState, writeState, deleteState } from "./state";
import { SessionInfo } from "./types";
import { stateHealth } from "./expiry";
import { getAvailablePort, markPortFree } from "./ports";
import { anvilStart, prepareForkState, anvilKill } from "./processes";
import { BadRequestError } from "../server/errors";
import { SessionStatus } from "../shared/types";

export const SESSION_STATUS = new Map<string, SessionStatus>();

function setSessionStatus(sessionId: string, status: SessionStatus) {
  SESSION_STATUS.set(sessionId, status);
}

export async function initSession(sessionId: string): Promise<number> {
  let allocatedPort: number | null = null;
  let sessionWritten = false;

  try {
    await stateHealth();

    const result = await readState(sessionId);

    if (result.initialized) {
      const port = result.state.anvil.port;

      if (typeof port !== "number") {
        throw new Error(`Session ${sessionId} is marked initialized but has no port`);
      }

      console.log("[API] Already initialized with port:", port);
      return port;
    }

    const port = getAvailablePort();
    allocatedPort = port;

    setSessionStatus(sessionId, {
      phase: "forking-mainnet",
      message: "Forking Ethereum mainnet...",
    });
    const pid = await anvilStart(port);

    setSessionStatus(sessionId, {
      phase: "funding-accounts",
      message: "Funding local Anvil accounts...",
    });
    const deployedSwapRouterAddress = await prepareForkState(port);

    const session: SessionInfo = {
      id: sessionId,
      state: "initialized",
      createdAt: Date.now(),
      lastSeen: Date.now(),
      anvil: {
        port: port,
        pid: pid
      },
      deployed: {
        SwapRouterSingle: {
          address: deployedSwapRouterAddress
        }
      }
    }

    await writeState(session);
    sessionWritten = true;

    setSessionStatus(sessionId, {
      phase: "ready",
      message: "Mainnet fork is ready.",
    });
    return port;
  } catch (err) {
    if (sessionWritten) {
      try {
        await cleanSession(sessionId);
      } catch (cleanupErr) {
        console.error(`[STATE] Failed to clean failed session ${sessionId}:`, cleanupErr);
      }
    } else if (allocatedPort !== null) {
      try {
        markPortFree(allocatedPort);
      } catch (portErr) {
        console.error(`[STATE] Failed to free allocated port ${allocatedPort}:`, portErr);
      }
    }

    throw new Error(
      `Could not initialize session ${sessionId}. Error occurred: ${err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

export async function updateSession(sessionId: string): Promise<void> {
  const result = await readState(sessionId);

  if (!result.initialized || result.state === null) {
    throw new BadRequestError("Invalid session id");
  }

  const state = result.state;

  state.lastSeen = Date.now();

  await writeState(state);

  console.log(`[STATE] Session id: ${sessionId} UPDATED`);
  console.log("[STATE] using port:", state.anvil.port, "\n");
}

export async function cleanSession(sessionId: string) {

  const result = await readState(sessionId);

  if (!result.initialized || result.state === null) {
    console.log(`[STATE] No session to clean up: ${sessionId}`);
    return;
  }

  const state = result.state;

  console.log(`[STATE] Killing anvil in session ${sessionId}, with port:`, state.anvil.port);

  anvilKill(state.anvil.pid);

  await deleteState(sessionId);

  console.log(`[STATE] Removed session file: ${sessionId}.json`);
  console.log("[STATE] marking", state.anvil.port, "as free.\n");

  markPortFree(state.anvil.port);

}

