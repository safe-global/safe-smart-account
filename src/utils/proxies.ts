import { ethers, Contract } from "ethers"
import hre from "hardhat";
import { utils } from "zksync-web3";
import { getSafeProxyRuntimeCode } from "../../test/utils/setup";

export const calculateProxyAddress = async (factory: Contract, singleton: string, inititalizer: string, nonce: number | string) => {
    const salt = ethers.utils.solidityKeccak256(
        ["bytes32", "uint256"],
        [ethers.utils.solidityKeccak256(["bytes"], [inititalizer]), nonce]
    )
    if (!hre.network.zksync){
        const deploymentCode = ethers.utils.solidityPack(["bytes", "uint256"], [await getSafeProxyRuntimeCode(), singleton])
        return ethers.utils.getCreate2Address(factory.address, salt, ethers.utils.keccak256(deploymentCode))
    } else {
        const bytecodehash = utils.hashBytecode(await getSafeProxyRuntimeCode())
        const input = new ethers.utils.AbiCoder().encode(['address'],[singleton])
        return utils.create2Address(factory.address, bytecodehash, salt, input)
    }
}

export const calculateProxyAddressWithCallback = async (factory: Contract, singleton: string, inititalizer: string, nonce: number | string, callback: string) => {
    const saltNonceWithCallback = ethers.utils.solidityKeccak256(
        ["uint256", "address"],
        [nonce, callback]
    )
    return calculateProxyAddress(factory, singleton, inititalizer, saltNonceWithCallback)
}