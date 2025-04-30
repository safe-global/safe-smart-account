// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {IStorageAccessible} from "../interfaces/IStorageAccessible.sol";

/**
 * @title Storage Accessible
 * @notice A generic base contract that allows callers to access all internal storage.
 * @dev See <https://github.com/gnosis/util-contracts/blob/bb5fe5fb5df6d8400998094fb1b32a178a47c3a1/contracts/StorageAccessible.sol>
 *      It removes a method from the original contract not needed for the Safe Smart Account contracts.
 * @author Gnosis Developers
 */
abstract contract StorageAccessible is IStorageAccessible {
    /**
     * @inheritdoc IStorageAccessible
     */
    function getStorageAt(uint256 offset, uint256 length) public view override returns (bytes memory) {
        // We use `<< 5` instead of the equivalent `* 32` as `SHL` opcode only uses 3 gas, while the `MUL` opcode uses 5 gas.
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
     * @inheritdoc IStorageAccessible
     */
    function simulateAndRevert(address targetContract, bytes memory calldataPayload) external override {
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            let success := delegatecall(gas(), targetContract, add(calldataPayload, 0x20), mload(calldataPayload), 0, 0)
            // Load free memory location.
            let ptr := mload(0x40)
            mstore(ptr, success)
            mstore(add(ptr, 0x20), returndatasize())
            returndatacopy(add(ptr, 0x40), 0, returndatasize())
            revert(ptr, add(returndatasize(), 0x40))
        }
        /* solhint-enable no-inline-assembly */
    }
}
