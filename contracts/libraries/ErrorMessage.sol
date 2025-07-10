// SPDX-License-Identifier: LGPL-3.0-only

pragma solidity >=0.7.0 <0.9.0;

/**
 * @title Error Message
 * @notice Revert with with Safe error codes.
 * @dev This contract specializes in reverting for the Safe 5-byte error codes (`GS***`).
 *      This is conceptually very similar to error codes introduced in Solidity version 0.8.
 *      The implementation using assembly saves a lot of gas and code size.
 * @author Shebin John - @remedcu
 */
abstract contract ErrorMessage {
    /**
     * @notice Revert with a Safe 5-byte error code `GS***`.
     * @dev This function behaves in the same way as the built-in Solidity `revert("GS***")` but
     *      it only works for revert messages that are exactly 5 bytes long.
     * @param error The error string to revert with.
     */
    function revertWithError(bytes5 error) internal pure {
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x08c379a000000000000000000000000000000000000000000000000000000000) // Selector for method "Error(string)".
            mstore(add(ptr, 0x04), 0x20) // String offset.
            mstore(add(ptr, 0x24), 0x05) // Revert reason length (5 bytes for bytes5).
            mstore(add(ptr, 0x44), error) // Revert reason.
            revert(ptr, 0x64) // Revert data length is 4 bytes for selector + offset + error length + error.
        }
        /* solhint-enable no-inline-assembly */
    }
}
