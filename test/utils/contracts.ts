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

export const killLibContract = async (deployer: Signer) => {
    return deployContractFromSource(deployer, killLibSource);
};

export const badSimulatorSource = `
interface ICompatibilityFallbackHandler {
    function simulate(address, bytes calldata) external returns (bytes memory);
}

contract Test {
    function simulateFallbackHandler(address fallbackHandler, uint256 mode) external {
        ICompatibilityFallbackHandler(fallbackHandler).simulate(address(0), abi.encode(mode));
    }

    function simulateAndRevert(address, bytes memory data) external {
        uint256 mode = abi.decode(data, (uint256));

        if (mode == 0) {
            // Return instead of revert.
            assembly {
                mstore(0, 1)
                mstore(32, 0)
                return(0, 64)
            }
        } else if (mode == 1) {
            // Revert with only success bool without appended data bytes.
            assembly {
                mstore(0, 1)
                revert(0, 32)
            }
        } else if (mode == 2) {
            // Revert with incomplete result data.
            assembly {
                mstore(0, 1)
                mstore(32, 100)
                revert(0, add(64, 50))
            }
        } else {
            // Revert with nothing!
            assembly {
                revert(0, 0)
            }
        }
    }
}`;

export const badSimulatorContract = async (deployer: Signer) => {
    return deployContractFromSource(deployer, badSimulatorSource);
};

/**
 * Retrieves the sender address from the contract runner.
 * It is useful when using methods like `hre.ethers.getContractAt` which automatically attach
 * the contract to a runner.
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
