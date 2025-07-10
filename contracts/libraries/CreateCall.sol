// SPDX-License-Identifier: LGPL-3.0-only

pragma solidity >=0.7.0 <0.9.0;

/**
 * @title Create Call
 * @notice Allows Safes to use `CREATE*` opcodes and deploy contracts.
 * @author Richard Meissner - @rmeissner
 */
contract CreateCall {
    /**
     * @notice Emitted when a new contract is created.
     * @param newContract The address of the created contract.
     */
    event ContractCreation(address indexed newContract);

    /**
     * @notice Deploys a new contract using the create2 opcode.
     * @param value The value in wei to be sent with the contract creation.
     * @param deploymentData The initialisation code of the contract to be created.
     * @param salt The salt value to use for the contract creation.
     * @return newContract The address of the newly created contract.
     */
    function performCreate2(uint256 value, bytes memory deploymentData, bytes32 salt) public returns (address newContract) {
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            newContract := create2(value, add(deploymentData, 0x20), mload(deploymentData), salt)
        }
        /* solhint-enable no-inline-assembly */
        require(newContract != address(0), "Could not deploy contract");
        emit ContractCreation(newContract);
    }

    /**
     * @notice Deploys a new contract using the create opcode.
     * @param value The value in wei to be sent with the contract creation.
     * @param deploymentData The initialisation code of the contract to be created.
     * @return newContract The address of the newly created contract.
     */
    function performCreate(uint256 value, bytes memory deploymentData) public returns (address newContract) {
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            newContract := create(value, add(deploymentData, 0x20), mload(deploymentData))
        }
        /* solhint-enable no-inline-assembly */
        require(newContract != address(0), "Could not deploy contract");
        emit ContractCreation(newContract);
    }
}
