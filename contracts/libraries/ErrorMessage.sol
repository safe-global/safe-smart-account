// SPDX-License-Identifier: LGPL-3.0-only

pragma solidity >=0.7.0 <0.9.0;

/**
 * @title Error Message - Contract which uses assembly to revert with a custom error message.
 * @author Shebin John - @remedcu
 * @notice The aim is to save gas using assembly to revert with custom error message.
 */
abstract contract ErrorMessage {
    /**
     * @notice Function which uses assembly to revert with the passed error message.
     * @param error The error string to revert with.
     * @dev Currently it is expected that the `error` string is at max 32 bytes of length.
     */
    function revertWithError(string memory error) internal pure {
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x08c379a000000000000000000000000000000000000000000000000000000000) // Selector for method "Error(string)"
            mstore(add(ptr, 0x04), 0x20) // String offset
            // First 32 bytes (0x20) is the length of the `error`, and the rest is the actual `error`.
            mstore(add(ptr, 0x24), mload(error)) // Revert reason length
            mstore(add(ptr, 0x44), mload(add(error, 0x20))) // Revert reason
            revert(ptr, 0x64) // Revert data length is 4 bytes for selector + offset + errorLength + error.
        }
        /* solhint-enable no-inline-assembly */
    }
}
