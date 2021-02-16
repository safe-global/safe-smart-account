import hre, { deployments, ethers, waffle } from "hardhat";

export const getSafeSingleton = async () => {
    const SafeDeployment = await deployments.get("GnosisSafe");
    const Safe = await hre.ethers.getContractFactory("GnosisSafe");
    return Safe.attach(SafeDeployment.address);
}