import { ethers, BigNumberish } from "ethers";
import { SafeProxyFactory } from "../../typechain-types";

export const calculateProxyAddress = async (factory: SafeProxyFactory, singleton: string, inititalizer: string, nonce: number | string) => {
    const factoryAddress = await factory.getAddress();
    const deploymentCode = ethers.solidityPacked(["bytes", "uint256"], [await factory.proxyCreationCode(), singleton]);
    const salt = ethers.solidityPackedKeccak256(["bytes32", "uint256"], [ethers.solidityPackedKeccak256(["bytes"], [inititalizer]), nonce]);
    return ethers.getCreate2Address(factoryAddress, salt, ethers.keccak256(deploymentCode));
};

export const calculateProxyAddressWithCallback = async (
    factory: SafeProxyFactory,
    singleton: string,
    inititalizer: string,
    nonce: number | string,
    callback: string,
) => {
    const saltNonceWithCallback = ethers.solidityPackedKeccak256(["uint256", "address"], [nonce, callback]);
    return calculateProxyAddress(factory, singleton, inititalizer, saltNonceWithCallback);
};

export const calculateChainSpecificProxyAddress = async (
    factory: SafeProxyFactory,
    singleton: string,
    inititalizer: string,
    nonce: number | string,
    chainId: BigNumberish,
) => {
    const factoryAddress = await factory.getAddress();
    const deploymentCode = ethers.solidityPacked(["bytes", "uint256"], [await factory.proxyCreationCode(), singleton]);
    const salt = ethers.solidityPackedKeccak256(
        ["bytes32", "uint256", "uint256"],
        [ethers.solidityPackedKeccak256(["bytes"], [inititalizer]), nonce, chainId],
    );
    return ethers.getCreate2Address(factoryAddress, salt, ethers.keccak256(deploymentCode));
};
