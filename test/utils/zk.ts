import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as zk from "zksync-web3";

export const getZkContractFactoryByName = async (hre: HardhatRuntimeEnvironment, contractName: string, signer: zk.Signer | zk.Wallet) => {
    const artifact = await hre.artifacts.readArtifact(contractName)

    if (artifact.bytecode === "0x") {
        throw new Error(
            `You are trying to create a contract factory for the contract ${contractName}, which is abstract and can't be deployed.`
        );
    }

    return new zk.ContractFactory(artifact.abi, artifact.bytecode, signer, "create");
}
