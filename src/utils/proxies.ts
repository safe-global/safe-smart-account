import { ethers, BigNumberish } from "ethers";
import { SafeProxyFactory } from "../../typechain-types";

export const calculateProxyAddress = async (factory: SafeProxyFactory, singleton: string, initializer: string, nonce: number | string) => {
    const salt = ethers.solidityPackedKeccak256(["bytes32", "uint256"], [ethers.solidityPackedKeccak256(["bytes"], [initializer]), nonce]);
    const factoryAddress = await factory.getAddress();
    const proxyCreationCode = await factory.proxyCreationCode();

    const deploymentCode = ethers.solidityPacked(["bytes", "uint256"], [proxyCreationCode, singleton]);
    return ethers.getCreate2Address(factoryAddress, salt, ethers.keccak256(deploymentCode));
};

export const calculateChainSpecificProxyAddress = async (
    factory: SafeProxyFactory,
    singleton: string,
    initializer: string,
    nonce: number | string,
    chainId: BigNumberish,
) => {
    const salt = ethers.solidityPackedKeccak256(
        ["bytes32", "uint256", "uint256"],
        [ethers.solidityPackedKeccak256(["bytes"], [initializer]), nonce, chainId],
    );
    const factoryAddress = await factory.getAddress();
    const proxyCreationCode = await factory.proxyCreationCode();
    const deploymentCode = ethers.solidityPacked(["bytes", "uint256"], [proxyCreationCode, singleton]);
    return ethers.getCreate2Address(factoryAddress, salt, ethers.keccak256(deploymentCode));
};
