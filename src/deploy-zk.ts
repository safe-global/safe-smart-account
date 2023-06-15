import { DeploymentsManager } from "hardhat-deploy/dist/src/DeploymentsManager";
import hre from "hardhat";
import getZkDeployer from "./zk-utils/getZkDeployer";

const CONTRACTS_TO_DEPLOY = Object.freeze([
    "SimulateTxAccessor",
    "GnosisSafeProxyFactory",
    "DefaultCallbackHandler",
    "CompatibilityFallbackHandler",
    "CreateCall",
    "MultiSend",
    "MultiSendCallOnly",
    "SignMessageLib",
    "GnosisSafe",
    "GnosisSafeL2"
]);

;(async () => {
    try {
        if (!hre.network.zksync) throw new Error("This script can work only on zksync networks!");

        const deployer = getZkDeployer(hre);

        const deploymentManager = new DeploymentsManager(hre, hre.network);
        await deploymentManager.deletePreviousDeployments();

        for (const contractName of CONTRACTS_TO_DEPLOY) {
            const artifact = await deployer.loadArtifact(contractName);
            const deployedContract = await deployer.deploy(artifact, []);

            const receipt = await deployer.zkWallet.provider.getTransactionReceipt(deployedContract.deployTransaction.hash);
            console.log(`${artifact.contractName} was deployed to ${deployedContract.address} with ${receipt.gasUsed} gas`);

            const extendedArtifact = await hre.deployments.getExtendedArtifact(contractName);
            await deploymentManager.saveDeployment(contractName, {
                ...extendedArtifact,
                address: deployedContract.address,
                abi: artifact.abi,
                transactionHash: deployedContract.deployTransaction.hash,
                receipt,
                bytecode: artifact.bytecode,
                deployedBytecode: artifact.deployedBytecode
            });
        }

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
})();
