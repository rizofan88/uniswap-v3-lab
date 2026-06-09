import fs from "fs";
import fsPromise from "fs/promises";
import pathMod from "path"
import { SessionInfo, State } from "./types";

export const STATE_DIR = "state/sessions";

export async function readState(sessionId: string): Promise<State> {
  const path = pathMod.join(STATE_DIR, `${sessionId}.json`);

  const exists = fs.existsSync(path);

  if (exists) {

    const raw = await fsPromise.readFile(
      path,
      { encoding: "utf8" }
    );

    const parsed = JSON.parse(raw);

    if (parsed.state === "initialized") {
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

export async function writeState(session: SessionInfo): Promise<void> {
  const path = pathMod.join(STATE_DIR, `${session.id}.json`);

  try {
    await fsPromise.writeFile(
      path,
      JSON.stringify(session, null, 2)
    );
  } catch (err) {
    throw new Error(
      `Failed to write session file ${session.id}.json: ${err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

export async function deleteState(sessionId: string): Promise<void> {
  const path = pathMod.join(STATE_DIR, `${sessionId}.json`);

  try {
    await fsPromise.rm(path, { force: true });
  } catch (err) {
    throw new Error(
      `Failed to delete session file ${sessionId}.json: ${err instanceof Error ? err.message : String(err)
      }`
    );
  }
}
