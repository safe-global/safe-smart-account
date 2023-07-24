import { task } from "hardhat/config";
import { TASK_VERIFY_ZK_ALL } from "./zk";

task("deploy-contracts", "Deploys and verifies Safe contracts").setAction(async (_, hre) => {
    await hre.run("deploy");
    await hre.run("local-verify");
    await hre.run("sourcify");

    if (!hre.network.zksync) {
        await hre.run("etherscan-verify", { forceLicense: true, license: "LGPL-3.0" });
    } else {
        await hre.run(TASK_VERIFY_ZK_ALL);
    }
});

export {};
