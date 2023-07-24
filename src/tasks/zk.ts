import "hardhat-deploy";
import { TASK_DEPLOY } from "hardhat-deploy";
import { TASK_VERIFY_VERIFY } from "@matterlabs/hardhat-zksync-verify/dist/src/constants";
import "@nomiclabs/hardhat-ethers";
import { TASK_TEST_SETUP_TEST_ENVIRONMENT } from "hardhat/builtin-tasks/task-names";
import { subtask } from "hardhat/config";

subtask(TASK_TEST_SETUP_TEST_ENVIRONMENT).setAction(async (taskArgs, hre, runSuper) => {
    if (hre.network.zksync) {
        // due to problems with zkSyncLocal node we modify the mocha configuration
        hre.config.mocha.retries = 3;
        hre.config.mocha.timeout = 90_000;
        hre.config.mocha.slow = 30_000;

        await hre.run(TASK_DEPLOY, { nonDeterministicZk: true, ...taskArgs });
    } else {
        await runSuper(taskArgs);
    }
});

const TASK_VERIFY_ZK_ALL = "verify:verify-zk-all";

subtask(TASK_VERIFY_ZK_ALL).setAction(async (_, hre) => {
    if (!hre.network.zksync) throw new Error("Current subtask works only for zk networks!");

    console.log(`\nRunning zk verification on block explorer`);
    const deployedContracts = await hre.deployments.all();

    for (const contract of Object.keys(deployedContracts)) {
        const deployment = await hre.deployments.get(contract);

        try {
            console.log(`\nVerifying ${contract} at ${deployment.address}...`);
            await hre.run(TASK_VERIFY_VERIFY, { address: deployment.address });
        } catch (error) {
            if (error instanceof Error && error.message.includes("contract is already verified")) {
                console.log(`\x1b[32m${contract} is already verified!\x1b[0m`);
            } else {
                // Re-throw error if it is not about verified issue
                throw error;
            }
        }
    }
});

export { TASK_VERIFY_ZK_ALL };
