// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title StorageAccessible - A generic base contract that allows callers to access all internal storage.
 * @notice See https://github.com/gnosis/util-contracts/blob/bb5fe5fb5df6d8400998094fb1b32a178a47c3a1/contracts/StorageAccessible.sol
 *         It removes a method from the original contract not needed for the Safe Smart Account contracts.
 * @author Gnosis Developers
 */
abstract contract StorageAccessible {
    /**
     * @notice Reads `length` bytes of storage in the current contract
     * @param offset - the offset in the current contract's storage in words to start reading from
     * @param length - the number of words (32 bytes) of data to read
     * @return the bytes that were read.
     */
    function getStorageAt(uint256 offset, uint256 length) public view returns (bytes memory) {
        // We use `<< 5` instead of `* 32` as SHR / SHL opcode only uses 3 gas, while DIV / MUL opcode uses 5 gas.
        bytes memory result = new bytes(length << 5);
        for (uint256 index = 0; index < length; ++index) {
            /* solhint-disable no-inline-assembly */
            /// @solidity memory-safe-assembly
            assembly {
                let word := sload(add(offset, index))
                mstore(add(add(result, 0x20), mul(index, 0x20)), word)
            }
            /* solhint-enable no-inline-assembly */
        }
        return result;
    }

    /**
     * @dev Performs a delegatecall on a targetContract in the context of self.
     * Internally reverts execution to avoid side effects (making it static).
     *
     * This method reverts with data equal to `abi.encode(bool(success), bytes(response))`.
     * Specifically, the `returndata` after a call to this method will be:
     * `success:bool || response.length:uint256 || response:bytes`.
     *
     * @param targetContract Address of the contract containing the code to execute.
     * @param calldataPayload Calldata that should be sent to the target contract (encoded method name and arguments).
     */
    function simulateAndRevert(address targetContract, bytes memory calldataPayload) external {
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            let success := delegatecall(gas(), targetContract, add(calldataPayload, 0x20), mload(calldataPayload), 0, 0)
            // Load free memory location
            let ptr := mload(0x40)
            mstore(ptr, success)
            mstore(add(ptr, 0x20), returndatasize())
            returndatacopy(add(ptr, 0x40), 0, returndatasize())
            revert(ptr, add(returndatasize(), 0x40))
        }
        /* solhint-enable no-inline-assembly */
    }
}
