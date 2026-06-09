import { QuoteRow } from "./quoteTypes";
import { QuoteResult } from "../../shared/types";
import { Token } from "@uniswap/sdk-core";

export function printQuote(quote: QuoteResult, tokenIn: Token, tokenOut: Token) {
    console.log("\n--- Quote ---");

    printQuoteRows([
        {
            label: "Input:",
            amount: quote.amountIn,
            symbol: tokenIn.symbol,
        },
        {
            label: "Output:",
            amount: quote.quotedAmountOut,
            symbol: tokenOut.symbol,
        },
        {
            label: "Fees:",
            amount: `$${quote.gasFeeUsd}`,
        },
    ]);

    console.log("-------------\n");
}

export function printQuoteRows(rows: QuoteRow[]) {
    const labelWidth = Math.max(...rows.map((row) => row.label.length));
    const amountWidth = Math.max(...rows.map((row) => row.amount.length));

    for (const row of rows) {
        console.log(
            `${row.label.padEnd(labelWidth)}  ${row.amount.padStart(amountWidth)}  ${row.symbol ?? ""}`
        );
    }
}