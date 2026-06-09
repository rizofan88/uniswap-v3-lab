export type SessionInfo = {
  id: string;
  state: "initialized" | "null";
  createdAt: number;
  lastSeen: number;
  anvil: { port: number, pid: number };
  deployed: Record<string, { address: string }>
}

export type State =
  | {
    initialized: true;
    state: SessionInfo;
  }
  | {
    initialized: false;
    state: null;
  };

