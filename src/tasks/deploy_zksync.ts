import "hardhat-deploy";
import { task } from "hardhat/config";

task("deploy-zksync").setAction(async (_, hre, superRun) => {
    if (!hre.network.zksync) throw new Error(`Not zksync network!`);
    await superRun();
});

export {};