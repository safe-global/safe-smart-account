import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Wallet } from "zksync-web3";

function getZkDeployer(hre: HardhatRuntimeEnvironment) {
    const { accounts } = hre.network.config;
    let wallet: Wallet | null = null;

    if (typeof accounts === "string") throw new Error("Unsupported accounts config");

    if (Array.isArray(accounts)) {
        if (accounts.length > 0) {
            if (typeof accounts[0] === "string") wallet = new Wallet(accounts[0]);
            else if ("privateKey" in accounts[0]) wallet = new Wallet(accounts[0].privateKey);
        }
    } else if ("mnemonic" in accounts) {
        wallet = Wallet.fromMnemonic(accounts.mnemonic);
    }

    if (wallet === null) throw new Error("Cannot create a zk wallet");

    return new Deployer(hre, wallet);
}

export default getZkDeployer

