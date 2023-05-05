import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { existsSync } from "fs";
import Mocha from "mocha";

async function runTests(hre: HardhatRuntimeEnvironment, testFolder: string) {
    const mocha = new Mocha({
        timeout: hre.config.mocha.timeout,
    });

    if (!existsSync(testFolder)) {
        console.log(`Test folder "${testFolder}" does not exist.`);
        process.exit(1);
    }

    mocha.addFile(testFolder);
    const failures = await new Promise<number>((resolve) => {
        mocha.run(resolve);
    });

    if (failures > 0) {
        process.exit(1);
    }
}

task("test", "Runs mocha tests").setAction(async (_, hre, superRun) => {
    if (hre.network.zksync) {
        console.log("Running zkSync tests");
        await runTests(hre, "./zktest");
    } else {
        await superRun();
    }
});

export {};
