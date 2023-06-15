import { DeploymentsManager } from "hardhat-deploy/dist/src/DeploymentsManager";
import hre from "hardhat";
import * as zk from "zksync-web3";
import getZkDeployer from "./zk-utils/getZkDeployer";
import getDeterministicDeployment from "./zk-utils/getDeterministicDeployment";
import getOrDeployZkSingletonFactory from "./zk-utils/getOrDeployZkSingletonFactory";

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

        const deterministicDeploymentInformation = await getDeterministicDeployment(hre);
        const singletonFactory = await getOrDeployZkSingletonFactory(deployer.zkWallet, deterministicDeploymentInformation);
        const deploymentManager = new DeploymentsManager(hre, hre.network);

        const salt = hre.ethers.constants.HashZero;
        for (const contractName of CONTRACTS_TO_DEPLOY) {
            const artifact = await hre.artifacts.readArtifact(contractName);
            const bytecodeHash = zk.utils.hashBytecode(artifact.bytecode);
            const input = new hre.ethers.utils.AbiCoder().encode([], []);
            const contractAddress = zk.utils.create2Address(singletonFactory.address, bytecodeHash, salt, input);

            let bytecode = await deployer.zkWallet.provider.getCode(contractAddress);
            if (bytecode !== "0x") {
                console.log(`reusing ${contractName} at ${contractAddress}`);

                if (!(await deploymentManager.deploymentsExtension.getOrNull(contractName))) {
                    const extendedArtifact = await hre.deployments.getExtendedArtifact(contractName);
                    await deploymentManager.saveDeployment(contractName, {
                        ...extendedArtifact,
                        address: contractAddress,
                        abi: artifact.abi,
                        bytecode,
                        deployedBytecode: artifact.deployedBytecode
                    });
                }

                continue;
            }

            process.stdout.write(`deploying ${contractName}`);
            const tx = await singletonFactory.deployContract(salt, bytecodeHash, input, {
                customData: {
                    factoryDeps: [artifact.bytecode]
                }
            });
            process.stdout.write(` (tx: ${tx.hash})...`);

            await tx.wait();
            const receipt = await deployer.zkWallet.provider.getTransactionReceipt(tx.hash);
            bytecode = await deployer.zkWallet.provider.getCode(contractAddress);

            if (bytecode !== artifact.bytecode || receipt.contractAddress !== contractAddress) {
                throw new Error(`Failed to deploy ${contractName}`);
            }

            process.stdout.write(`: deployed at ${receipt.contractAddress} with ${receipt.gasUsed} gas\n`);
            const extendedArtifact = await hre.deployments.getExtendedArtifact(contractName);
            await deploymentManager.saveDeployment(contractName, {
                ...extendedArtifact,
                address: contractAddress,
                abi: artifact.abi,
                transactionHash: tx.hash,
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
