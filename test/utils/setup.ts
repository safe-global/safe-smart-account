import hre, { deployments, ethers, waffle } from "hardhat";

export const defaultCallbackHandlerDeployment = async () => {
    return await deployments.get("DefaultCallbackHandler");
}

export const defaultCallbackHandlerContract = async () => {
    return await hre.ethers.getContractFactory("DefaultCallbackHandler");
}

export const getSafeSingleton = async () => {
    const SafeDeployment = await deployments.get("GnosisSafe");
    const Safe = await hre.ethers.getContractFactory("GnosisSafe");
    return Safe.attach(SafeDeployment.address);
}

export const getFactory = async () => {
    const FactoryDeployment = await deployments.get("GnosisSafeProxyFactory");
    const Factory = await hre.ethers.getContractFactory("GnosisSafeProxyFactory");
    return Factory.attach(FactoryDeployment.address);
}

export const getSafeTemplate = async () => {
    const singleton = await getSafeSingleton()
    const factory = await getFactory()
    const template = await factory.callStatic.createProxy(singleton.address, "0x")
    await factory.createProxy(singleton.address, "0x").then((tx: any) => tx.wait())
    const Safe = await hre.ethers.getContractFactory("GnosisSafe");
    return Safe.attach(template);

}

export const getDefaultCallbackHandler = async () => {
    return (await defaultCallbackHandlerContract()).attach((await defaultCallbackHandlerDeployment()).address);
}