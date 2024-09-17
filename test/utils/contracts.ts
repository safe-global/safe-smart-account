import { Signer, BaseContract, ContractRunner } from "ethers";
import { deployContractFromSource } from "./setup";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { InterfaceAbi, Interface } from "ethers";
import { ContractFactory as zkContractFactory } from "zksync-ethers";

export const killLibSource = `
contract Test {
    function killme() public {
        selfdestruct(payable(msg.sender));
    }

    function expose() public returns (address handler) {
        bytes32 slot = 0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5;
        assembly {
            handler := sload(slot)
        }
    }

    function estimate(address to, bytes memory data) public returns (uint256) {
        uint256 startGas = gasleft();
        (bool success,) = to.call{ gas: gasleft() }(data);
        require(success, "Transaction failed");
        return startGas - gasleft();
    }

    address singleton;
    uint256 public value = 0;
    function updateAndGet() public returns (uint256) {
        value++;
        return value;
    }

    function trever() public returns (address handler) {
        revert("Why are you doing this?");
    }
}`;

export const killLibSourceZk = `
contract Test {
    function expose() public returns (address handler) {
        bytes32 slot = 0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5;
        assembly {
            handler := sload(slot)
        }
    }

    function estimate(address to, bytes memory data) public returns (uint256) {
        uint256 startGas = gasleft();
        (bool success,) = to.call{ gas: gasleft() }(data);
        require(success, "Transaction failed");
        return startGas - gasleft();
    }

    address singleton;
    uint256 public value = 0;
    function updateAndGet() public returns (uint256) {
        value++;
        return value;
    }

    function trever() public returns (address handler) {
        revert("Why are you doing this?");
    }
}`;

export const killLibContract = async (deployer: Signer, zkSync?: boolean) => {
    // selfdestruct is not supported by zkSync and compilation cannot be completed, therefore we have to ditch it
    if (zkSync) return deployContractFromSource(deployer, killLibSourceZk);

    return deployContractFromSource(deployer, killLibSource);
};

/**
 * Retrieves the sender address from the contract runner.
 * It is useful when using methods like `hre.ethers.getContractAt` which automatically attach
 * the contract to a runner. In different environments, the sender address can be different:
 * for example, at the moment of writing this comment, hardhat uses the first account from the
 * `hre.ethers.getSigners()` array as the sender address, but zkSync uses the 9th account.
 *
 * @param contract - The contract object.
 * @returns The sender address.
 * @throws Error if the contract runner is not defined or if the sender address cannot be retrieved.
 */
export const getSenderAddressFromContractRunner = (contract: BaseContract): string => {
    if (!contract.runner) {
        throw new Error("Failed to get sender address from contract runner, runner is not defined");
    }
    if ("address" in contract.runner && typeof contract.runner.address === "string") {
        return contract.runner.address;
    } else {
        throw new Error("Failed to get sender address from contract runner");
    }
};

/**
 * Creates a ContractFactory instance based on the current network environment.
 *
 * @param hre - The Hardhat Runtime Environment.
 * @param abi - The ABI (Application Binary Interface) of the contract.
 * @param bytecode - The bytecode of the contract.
 * @param contractRunner - Optional ContractRunner instance.
 * @returns A ContractFactory instance appropriate for the current network.
 */
export const getContractFactory = (
    hre: HardhatRuntimeEnvironment,
    abi: Interface | InterfaceAbi,
    bytecode: string,
    contractRunner?: ContractRunner,
) => {
    if (hre.network.zksync) {
        // we cannot use hre.zksyncEthers because it doesn't work
        // Update when https://github.com/matter-labs/hardhat-zksync/issues/1420 is fixed
        return new zkContractFactory(abi, bytecode, contractRunner);
    }

    return new hre.ethers.ContractFactory(abi, bytecode, contractRunner);
};
