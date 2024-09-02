import { task } from "hardhat/config";
import { TASK_VERIFY_ZK_ALL } from "./zk";

task("deploy-contracts", "Deploys and verifies Safe Smart Account contracts").setAction(async (_, hre) => {
    await hre.run("deploy");
    await hre.run("local-verify");

    // sourcify is not supported on zkSync
    if (hre.network.zksync) {
        await hre.run(TASK_VERIFY_ZK_ALL);
    } else {
        await hre.run("sourcify");
        await hre.run("etherscan-verify", { forceLicense: true, license: "LGPL-3.0" });
    }
});

export {};
