import { TASK_VERIFY_VERIFY } from "@matterlabs/hardhat-zksync-verify/dist/src/constants";
import { subtask } from "hardhat/config";

const TASK_VERIFY_ZK_ALL = "verify:verify-zk-all";

subtask(TASK_VERIFY_ZK_ALL).setAction(async (_, hre) => {
    if (!hre.network.zksync) throw new Error("Current subtask works only for zk networks!");

    console.log(`\nRunning zk verification on block explorer`);

    const deployedContracts = await hre.deployments.all();
    for (const [contract, deployment] of Object.entries(deployedContracts)) {
        try {
            console.log(`\nVerifying ${contract} at ${deployment.address}...`);
            await hre.run(TASK_VERIFY_VERIFY, { address: deployment.address, constructorArguments: deployment.args || [] });
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
