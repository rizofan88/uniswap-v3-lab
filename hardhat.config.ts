import { HardhatUserConfig, task } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-foundry";
import {env} from './src/config/env'

task("show-paths", "Prints Hardhat's resolved paths", async (_args, hre) => {
  console.log("Hardhat paths:");
  console.log(hre.config.paths);
});

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
      },
      {
        version: "0.7.6",
      },
    ],
  },
  networks: {
    hardhat: {
      forking: {
        url: env.MAINNET_RPC_URL ?? "",
      },
    },
  },
};

export default config;