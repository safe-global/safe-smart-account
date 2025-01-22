import { ethers, BigNumberish } from "ethers";
import * as zk from "zksync-ethers";
import { SafeProxyFactory } from "../../typechain-types";

/**
 * Extracts the bytecode hash from the ZkSync deployer call header. (Returned by .creationCode())
 *
 * @param proxyCreationCode - The proxy creation code returned by the factory.
 * @returns The bytecode hash as a string.
 *
 * @remarks
 * The ZkSync deployer call header typically consists of:
 * - The deployer contract method signature
 * - The salt (for `create2`) or zero (for `create1`)
 * - The hash of the bytecode of the contract being created
 * - The offset of the constructor arguments
 * - The length of the constructor arguments
 *
 * @see {@link https://github.com/matter-labs/era-compiler-llvm-context/blob/8809df8ecd952972a9cba078b5f368df5c153c58/src/eravm/evm/create.rs#L140-L145}
 */
export const getZkSyncBytecodeHashFromDeployerCallHeader = (proxyCreationCode: string): string => {
    const decodedHeader = new ethers.AbiCoder().decode(["bytes32", "bytes32", "bytes"], "0x" + proxyCreationCode.slice(10));
    return decodedHeader[1];
};

export const calculateProxyAddress = async (
    factory: SafeProxyFactory,
    singleton: string,
    initializer: string,
    nonce: number | string,
    zkSync: boolean = false,
) => {
    const salt = ethers.solidityPackedKeccak256(["bytes32", "uint256"], [ethers.solidityPackedKeccak256(["bytes"], [initializer]), nonce]);
    const factoryAddress = await factory.getAddress();
    const proxyCreationCode = await factory.proxyCreationCode();

    if (zkSync) {
        const bytecodeHash = getZkSyncBytecodeHashFromDeployerCallHeader(proxyCreationCode);
        const input = new ethers.AbiCoder().encode(["address"], [singleton]);
        return zk.utils.create2Address(factoryAddress, bytecodeHash, salt, input);
    }

    const deploymentCode = ethers.solidityPacked(["bytes", "uint256"], [proxyCreationCode, singleton]);
    return ethers.getCreate2Address(factoryAddress, salt, ethers.keccak256(deploymentCode));
};

export const calculateProxyAddressWithCallback = async (
    factory: SafeProxyFactory,
    singleton: string,
    initializer: string,
    nonce: number | string,
    callback: string,
    zkSync: boolean = false,
) => {
    const saltNonceWithCallback = ethers.solidityPackedKeccak256(["uint256", "address"], [nonce, callback]);
    return calculateProxyAddress(factory, singleton, initializer, saltNonceWithCallback, zkSync);
};

export const calculateChainSpecificProxyAddress = async (
    factory: SafeProxyFactory,
    singleton: string,
    initializer: string,
    nonce: number | string,
    chainId: BigNumberish,
    zkSync: boolean = false,
) => {
    const salt = ethers.solidityPackedKeccak256(
        ["bytes32", "uint256", "uint256"],
        [ethers.solidityPackedKeccak256(["bytes"], [initializer]), nonce, chainId],
    );
    const factoryAddress = await factory.getAddress();
    const proxyCreationCode = await factory.proxyCreationCode();

    if (zkSync) {
        const bytecodeHash = getZkSyncBytecodeHashFromDeployerCallHeader(proxyCreationCode);
        const input = new ethers.AbiCoder().encode(["address"], [singleton]);
        return zk.utils.create2Address(factoryAddress, bytecodeHash, salt, input);
    }

    const deploymentCode = ethers.solidityPacked(["bytes", "uint256"], [await factory.proxyCreationCode(), singleton]);
    return ethers.getCreate2Address(factoryAddress, salt, ethers.keccak256(deploymentCode));
};
