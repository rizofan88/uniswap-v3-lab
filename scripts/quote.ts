import { getQuote, printQuote } from '../src/quote';
import { resolveToken } from '../src/tokens';

async function main() {
    const [, , tokenInArg, tokenOutArg, amount] = process.argv;

    if (!tokenInArg || !tokenOutArg || !amount) {
        throw new Error(
            "Usage: npm run quote -- <tokenIn> <tokenOut> <amount>\n" +
            "Example: npm run quote -- WETH DAI 0.1"
        );
    }
    
    const tokenIn = resolveToken(tokenInArg);
    const tokenOut = resolveToken(tokenOutArg);

    const quote = await getQuote({
        tokenIn, 
        tokenOut, 
        amount}
    );

    printQuote(quote, tokenIn, tokenOut);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});



