import fs from "fs";
import pathMod from "path";

type PortEntry = {
    port: number; 
    status: "used" | "free"
}

type Ports = PortEntry[];

const PATH = pathMod.join("state/ports", "ports.json");

function isPortEntry(value: unknown): value is PortEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const entry = value as Partial<PortEntry>;

  return (
    typeof entry.port === "number" &&
    Number.isInteger(entry.port) &&
    entry.port > 0 &&
    (entry.status === "used" || entry.status === "free")
  );
}

function readPorts(): Ports {
  if (!fs.existsSync(PATH)) {
    return [];
  }

  const raw = fs.readFileSync(PATH, { encoding: "utf8" }).trim();

  if (raw.length === 0) {
    return [];
  }

  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed) || !parsed.every(isPortEntry)) {
    throw new Error("Invalid ports file format");
  }

  return parsed;
}


function writePorts(ports: Ports): void {
  try {
    fs.writeFileSync(PATH, JSON.stringify(ports, null, 2));
  } catch (error) {
    throw new Error("Could not write ports to file");
  }
}

export function getAvailablePort(): number {
  const ports = readPorts();

  const freeEntry = ports.find((entry) => entry.status === "free");

  if (freeEntry) {
    freeEntry.status = "used";
    writePorts(ports);
    return freeEntry.port;
  }

  const lastPort = ports.at(-1);
  const nextPort = lastPort ? lastPort.port + 1 : 8545;

  ports.push({
    port: nextPort,
    status: "used",
  });

  writePorts(ports);

  return nextPort;
}

export function markPortFree(port: number): void {
  const ports = readPorts();

  const entry = ports.find((entry) => entry.port === port);

  if (!entry) {
    throw new Error(`Cannot mark unknown port ${port} as free`);
  }

  entry.status = "free";

  writePorts(ports);
}
