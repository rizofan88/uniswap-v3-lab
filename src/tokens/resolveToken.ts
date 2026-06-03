import { ethers } from "hardhat";
import { TOKEN_LIST } from "./tokens"
import { Token } from "@uniswap/sdk-core";


export function resolveToken(identifier: string) {

    const normalizedIdentifier = identifier.toLowerCase();

    const token = TOKEN_LIST.find((token) => {

        if (ethers.isAddress(identifier)) {
            return token.address.toLowerCase() === normalizedIdentifier;
        }
        
        return token.symbol?.toLowerCase() === normalizedIdentifier;
    });

    if (!token) {
        throw new Error(`Unsupported token: ${identifier}`);
    }

    return token;

}
