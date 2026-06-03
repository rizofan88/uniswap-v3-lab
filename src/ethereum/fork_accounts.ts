import { ethers } from "hardhat";
import { assertRpcIsAlive, getLocalProvider } from "./provider";
import dotenv from "dotenv";
import fsPromise from "fs/promises";

type EnvAccounts = {
    index: number;
    address: string;
    key: string;
};

export async function getDefaultAccounts(port = "8545"): Promise<string[]> {
    try {
        await assertRpcIsAlive(port);
        
        const provider = new ethers.JsonRpcProvider(`http://127.0.0.1:${port}`);
        const accounts = await provider.send("eth_accounts", []);
    
        if(!accounts) {
            throw new Error("Failed to query accounts from local fork");
        }
        return accounts;
        
    } catch(err) {
        throw new Error("Unable to fetch accounts");
    }

    
}

export async function fundLocalAccounts( 
    port = "8545"
):Promise <boolean> {

    const accounts = await getLocalAccounts();

    const provider = getLocalProvider(port);

    const balance = ethers.parseEther("1000");
    const expected = ethers.toBeHex(balance);

    for(const acc of accounts) {
        
        try {
            
            await provider.send("anvil_setBalance", [acc.address, String(expected)]);
            const balance = await provider.send("eth_getBalance", [acc.address, "latest"]);
            console.log(acc.address, balance)

            if(balance != String(expected)) {
                console.log("Could not fund account: ", acc.address);
                return false;
            }

        } catch (err) {
            console.error("Could not fund account: ", acc.address, err);
        }
        
    }

    return true;
}

export async function getLocalAccounts(path = ".env.accounts"): Promise <EnvAccounts[]> {

    const toParse = await fsPromise.readFile(path, {encoding: "utf8"});

    const object = dotenv.parse(toParse);

    const accounts: EnvAccounts[] = [];

    for(const [envKey, value] of Object.entries(object)) {
        if(!envKey.startsWith("ADDRESS")) {
            continue;
        }

        const index = envKey.replace("ADDRESS", "");

        const privateKey = object[`KEY${index}`];

        if(!privateKey) {
            throw new Error(`No KEY${index} for address ${envKey} found.`);
        }

        accounts.push({
            index: Number(index),
            address: value,
            key: privateKey
        })

    }
    
    return accounts;

}


/* (async () => {
    await fundLocalAccounts(String(8545))
    
})(); */