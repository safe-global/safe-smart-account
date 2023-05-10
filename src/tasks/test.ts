import "@nomiclabs/hardhat-ethers";
import "@elvis-krop/hardhat-deploy";
import { task } from "hardhat/config";

task("test", "Runs mocha tests").setAction(async (taskArgs: { testFiles: string[]; noCompile: boolean; }, hre, superRun) => {
  if (hre.network.zksync) {
    console.log("Running zkSync tests");
  }

  await superRun(taskArgs);
});

export {};
