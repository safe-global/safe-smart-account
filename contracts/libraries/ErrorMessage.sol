// SPDX-License-Identifier: LGPL-3.0-only

pragma solidity >=0.7.0 <0.9.0;

/**
 * @title Error Message - Contract which uses assembly to revert with a custom error message.
 * @author Shebin John - @remedcu
 * @notice The aim is to save gas using assembly to revert with a custom error message.
 */
abstract contract ErrorMessage {
    /**
     * @notice Function which uses assembly to revert with the passed error message.
     * @param error The error string to revert with.
     * @dev Currently it is expected that the `error` string is at max 5 bytes of length. Ex: "GSXXX"
     */
    function revertWithError(bytes5 error) internal pure {
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x08c379a000000000000000000000000000000000000000000000000000000000) // Selector for method "Error(string)"
            mstore(add(ptr, 0x04), 0x20) // String offset
            mstore(add(ptr, 0x24), 0x05) // Revert reason length (5 bytes for bytes5)
            mstore(add(ptr, 0x44), error) // Revert reason
            revert(ptr, 0x64) // Revert data length is 4 bytes for selector + offset + error length + error.
        }
        /* solhint-enable no-inline-assembly */
    }
}
