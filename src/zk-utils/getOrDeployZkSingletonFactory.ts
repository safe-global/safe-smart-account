import { DeterministicDeploymentInfo } from "@elvis-krop/hardhat-deploy/dist/types";
import { ethers } from "ethers";
import * as zk from "zksync-web3";
import { factoryABI } from "./constants";

async function getOrDeployZkSingletonFactory(zkWallet: zk.Wallet, deploymentInfo: DeterministicDeploymentInfo): Promise<zk.Contract> {
    const {
        factory: factoryAddress,
        deployer: factoryDeployerAddress,
        funding,
        signedTx
    } = deploymentInfo;

    const bytecode = await zkWallet.provider.getCode(factoryAddress);

    if (bytecode == "0x") {
        process.stdout.write(`\tsending eth to create2 contract deployer address (${factoryDeployerAddress})`);
        const transferTx = await zkWallet.sendTransaction({
            to: factoryDeployerAddress,
            value: ethers.utils.parseEther(ethers.utils.formatEther(funding.toString()))
        });
        process.stdout.write(` (tx: ${transferTx.hash})...\n`);
        await transferTx.wait();

        process.stdout.write(`deploying create2 deployer contract (at ${factoryAddress}) using deterministic deployment`);
        const sentTx = await zkWallet.provider.sendTransaction(signedTx);
        process.stdout.write(` (tx: ${sentTx.hash})...\n`);
        await sentTx.wait();

        const receipt = await zkWallet.provider.getTransactionReceipt(sentTx.hash);
        const deployedAddress = receipt.contractAddress;

        if (deployedAddress !== factoryAddress) {
            console.table({ deployedAddress, factoryAddress });
            throw new Error("Failed to deploy deployer factory: deployed address is not the same as expected factory address");
        }
    } else {
        process.stdout.write(`\tcreate2 deployer contract already deployed at ${factoryAddress}\n\n`);
    }

    return new zk.Contract(factoryAddress, factoryABI, zkWallet);
}

export default getOrDeployZkSingletonFactory;
