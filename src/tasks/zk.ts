import "@elvis-krop/hardhat-deploy";
import { TASK_DEPLOY, TASK_DEPLOY_RUN_DEPLOY } from "@elvis-krop/hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
import { TASK_TEST_SETUP_TEST_ENVIRONMENT } from "hardhat/builtin-tasks/task-names";
import { subtask, task } from "hardhat/config";

task(TASK_DEPLOY).addFlag("nonDeterministicZk");

subtask(TASK_TEST_SETUP_TEST_ENVIRONMENT).setAction(async (taskArgs, hre, runSuper) => {
    if (hre.network.zksync) {
        // due to problems with zkSyncLocal node we modify the mocha configuration
        hre.config.mocha.retries = 5;
        hre.config.mocha.timeout = 90_000;

        await hre.run("deploy", {
            nonDeterministicZk: true,
            ...taskArgs
        });
    } else {
        await runSuper(taskArgs);
    }
});

subtask(TASK_DEPLOY_RUN_DEPLOY, "deploy run only")
    .setAction(async (taskArgs: { nonDeterministicZk?: boolean }, hre, runSuper) => {
        if (hre.network.zksync && !taskArgs.nonDeterministicZk) {
            await hre.run("run", {
                ...taskArgs,
                script: "./src/deploy-zk-deterministic.ts"
            });
        } else {
            await runSuper({
                ...taskArgs,
                ...(hre.network.zksync && { reset: true })
            });
        }
    });

export {};
