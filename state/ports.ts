import fs from "fs";

type PortEntry = {
    port: number; 
    status: "used" | "free"
}

type Ports = PortEntry[];

const PATH = "state/ports.json";

function readPorts(): Ports {

    if(!fs.existsSync(PATH)) {
        throw new Error("Ports File doesnt exit");
    }

    const raw = fs.readFileSync(
        PATH,
        {encoding: "utf8"}
    );

    if(!raw) {
        throw new Error("Ports file is empty");
    }

    const ports = JSON.parse(raw);

    return ports
}

export function getAvailablePort(): number {

    if(!fs.existsSync(PATH)) {
        fs.writeFileSync(
            PATH,
            JSON.stringify(
                [
                    {port: 8545, status: "used"},
                ]
            )
        );
        return 8545;
    }

    const ports: Ports = readPorts();

    let freePort = 0;

    for(const entry of ports) {
        if(entry.status === "free") {
            freePort = entry.port
            entry.status = "used"
            break;
        }
    }

    const lastPort = ports.at(-1);
    if (!lastPort) {
        throw new Error("Ports file has no entries");
    }

    if(freePort == 0){
        freePort = lastPort.port + 1;

        ports.push({
            port: freePort,
            status: "used"
        })
    }
    
    fs.writeFileSync(PATH, JSON.stringify(ports));

    return freePort;
}

export async function markPortFree(port: number): Promise<boolean> {

    const ports = readPorts();

    const entry = ports.find((entry) => entry.port === port);

    if(!entry) {
        return false;
    }

    entry.status = "free";

    fs.writeFileSync(PATH, JSON.stringify(ports));

    return true;
}
