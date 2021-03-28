import { HardhatRuntimeEnvironment as HRE } from "hardhat/types";

export const contractFactory = (hre: HRE, contractName: string) => hre.ethers.getContractFactory(contractName);

export const contractInstance = async (hre: HRE, contractName: string) => {
    const deployment = await hre.deployments.get(contractName);
    const contract = await contractFactory(hre, contractName)
    return contract.attach(deployment.address)
}
export const safeSingleton = async (hre: HRE, l2: boolean) => contractInstance(hre, l2 ? "GnosisSafeL2" : "GnosisSafe")
export const proxyFactory = async (hre: HRE) => contractInstance(hre, "GnosisSafeProxyFactory")