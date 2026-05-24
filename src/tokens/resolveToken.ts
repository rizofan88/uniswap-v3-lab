import { TOKEN_LIST } from "./tokens"


export function resolveToken(symbol: string) {

    const token = TOKEN_LIST.find(
        (token) => token.symbol?.toUpperCase() === symbol.toUpperCase()
    );

    if (!token) {
        throw new Error(`Unsupported token: ${symbol}`);
    }

    return token;

}
