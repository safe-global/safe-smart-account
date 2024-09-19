import { Signer, BaseContract } from "ethers";
import { deployContractFromSource } from "./setup";

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
