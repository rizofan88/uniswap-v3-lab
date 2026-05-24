import { swapWethToDai } from "../src/swap";

async function main() {
  await swapWethToDai();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
