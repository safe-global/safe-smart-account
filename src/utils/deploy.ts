import { HardhatRuntimeEnvironment } from "hardhat/types";

/**
 * Retrieves the deployer account based on the current network environment.
 *
 * @param hre - The Hardhat Runtime Environment.
 * @returns The deployer account address or private key.
 */
export const getDeployerAccount = async (hre: HardhatRuntimeEnvironment) => {
    let { deployer: deployerAccount } = await hre.getNamedAccounts();

    // hardhat-deploy only supports zksync (or zksync only supports hardhat-deploy) if the private key of the deployer is provided
    // it cannot fetch the private key from hardhat's environment
    if (hre.network.zksync) {
        if (process.env.ZKSYNC_DEPLOYER_PK) {
            deployerAccount = process.env.ZKSYNC_DEPLOYER_PK;
        } else {
            console.warn("Using default ZkSync deployer private key");
            deployerAccount = "0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110";
        }
    }

    return deployerAccount;
};
